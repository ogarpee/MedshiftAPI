"use client";

import { apiFetch as fetch } from "../../session-fetch";

import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ClinicalRole, OnboardingStatus, RequiredWorkerDocumentCategories } from "@medshift/shared-types";
import { MedShiftLogo, StatusBadge } from "@medshift/ui-components";
import { WorkerDocumentsField } from "../../worker-documents-field";
import type { WorkerDocumentRecord } from "../../worker-documents-field";
import { GooglePlacesSearch } from "../../google-places-search";
import type { GooglePlaceSelection } from "../../google-places-search";
import { OnboardingMap } from "../../onboarding-map";
import { useToast } from "../../toast-provider";

const legacyDraftKey = "medshift.workerOnboardingDraft";
const draftKey = (userId: string) => `medshift.workerOnboardingDraft.${userId}`;
const weekDays = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
const shiftTypes = ["DAY", "EVENING", "NIGHT", "WEEKEND"];
const steps = [
  { title: "Identity", caption: "Legal name and clinical role" },
  { title: "Service Area", caption: "Map location and search radius" },
  { title: "Availability", caption: "Days and shift preferences" },
  { title: "Documents", caption: "Secure verification uploads" },
  { title: "Review", caption: "Submit for verification" }
];

type WorkerDraft = {
  availableDays: string[];
  documents: WorkerDocumentRecord[];
  firstName: string;
  lastName: string;
  latitude: string;
  longitude: string;
  maxDistanceKm: string;
  preferredShiftTypes: string[];
  title: ClinicalRole;
};

type WorkerProfile = {
  id: string;
  firstName?: string;
  lastName?: string;
  title?: ClinicalRole;
  documents?: WorkerDocumentRecord[];
  location?: { type: "Point"; coordinates: [number, number] };
  onboarding?: { verificationStatus?: OnboardingStatus; rejectedReason?: string };
  preferences?: {
    availableDays?: string[];
    maxDistanceKm?: number;
    preferredShiftTypes?: string[];
  };
  updatedAt?: string;
};

type ServerDraft = {
  currentStep: number;
  data: Partial<ReturnType<typeof buildPayload>>;
  profileId?: string | null;
  updatedAt: string;
};

type LocalDraft = {
  currentStep: number;
  data: WorkerDraft;
  pendingSync: boolean;
  updatedAt: string;
};

type AuthUser = { sub: string };
type SaveState = "idle" | "saving" | "saved" | "device" | "error";

type OnboardingApiStatus = {
  completed?: boolean;
  nextStep?: string;
  profileId?: string | null;
  rejectedReason?: string | null;
  verificationStatus?: OnboardingStatus;
};

const initialDraft: WorkerDraft = {
  availableDays: ["MONDAY", "TUESDAY", "WEDNESDAY"],
  documents: [],
  firstName: "",
  lastName: "",
  latitude: "51.0447",
  longitude: "-114.0719",
  maxDistanceKm: "25",
  preferredShiftTypes: ["DAY"],
  title: ClinicalRole.Hca
};

export default function WorkerOnboardingPage() {
  const { notify } = useToast();
  const apiUrl = useMemo(() => process.env.NEXT_PUBLIC_API_URL ?? "", []);
  const googlePlacesApiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  const [currentStep, setCurrentStep] = useState(0);
  const [draft, setDraft] = useState<WorkerDraft>(initialDraft);
  const [profileId, setProfileId] = useState("");
  const [status, setStatus] = useState<OnboardingApiStatus>({ verificationStatus: OnboardingStatus.Incomplete });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isStepSaving, setIsStepSaving] = useState(false);
  const [userId, setUserId] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [baseline, setBaseline] = useState<WorkerDraft | null>(null);
  const [loadError, setLoadError] = useState("");
  const initializedRef = useRef(false);
  const skipNextAutosaveRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const latestSaveRevisionRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    void loadOnboarding();

    async function loadOnboarding() {
      try {
        setIsLoading(true);
        setLoadError("");
        const authResponse = await fetch(`${apiUrl}/auth/me`);
        if (!authResponse.ok) throw new Error("Sign in or complete registration before starting worker onboarding.");
        const authUser = (await authResponse.json()) as AuthUser;
        const localKey = draftKey(authUser.sub);
        const local = readLocalDraft(localKey) ?? readLegacyDraft();
        const [statusResponse, profileResponse, serverDraftResponse] = await Promise.all([
          fetch(`${apiUrl}/worker-profiles/onboarding-status`),
          fetch(`${apiUrl}/worker-profiles/me`),
          fetch(`${apiUrl}/worker-profiles/onboarding-draft`)
        ]);
        if (cancelled) return;
        if (!statusResponse.ok) throw new Error("Worker onboarding status could not be loaded. Retry before editing or submitting changes.");
        const nextStatus = statusResponse.ok ? ((await statusResponse.json()) as OnboardingApiStatus) : { verificationStatus: OnboardingStatus.Incomplete };
        let profile = profileResponse.ok ? ((await profileResponse.json()) as WorkerProfile) : null;
        if (!profile && nextStatus.profileId) {
          const fallbackProfileResponse = await fetch(`${apiUrl}/worker-profiles/${nextStatus.profileId}`);
          if (fallbackProfileResponse.ok) profile = (await fallbackProfileResponse.json()) as WorkerProfile;
          else throw new Error("Your existing worker profile could not be loaded. Retry before editing or submitting changes.");
        }
        const serverDraft = serverDraftResponse.ok ? await readNullableJson<ServerDraft>(serverDraftResponse) : null;
        const profileDraft = profile ? draftFromProfile(profile) : null;
        let resolvedDraft = initialDraft;
        let resolvedStep = 0;
        let shouldPushLocal = false;

        if (local?.pendingSync) {
          resolvedDraft = reconcileDraftDocuments({ ...initialDraft, ...local.data }, profileDraft);
          resolvedStep = clampStep(local.currentStep);
          shouldPushLocal = true;
        } else if (serverDraft) {
          resolvedDraft = draftFromPayload(serverDraft.data, profileDraft ?? initialDraft);
          resolvedStep = clampStep(serverDraft.currentStep);
        } else if (profileDraft) {
          resolvedDraft = profileDraft;
          resolvedStep = 4;
        } else if (local) {
          resolvedDraft = reconcileDraftDocuments({ ...initialDraft, ...local.data }, profileDraft);
          resolvedStep = clampStep(local.currentStep);
          shouldPushLocal = true;
        }

        skipNextAutosaveRef.current = true;
        setUserId(authUser.sub);
        setProfileId(profile?.id ?? serverDraft?.profileId ?? "");
        setStatus(nextStatus);
        setBaseline(profileDraft);
        setDraft(resolvedDraft);
        setCurrentStep(resolvedStep);
        setSaveState(serverDraft || profileDraft ? "saved" : local ? "device" : "idle");
        window.localStorage.setItem(
          localKey,
          JSON.stringify({
            currentStep: resolvedStep,
            data: resolvedDraft,
            pendingSync: shouldPushLocal,
            updatedAt: new Date().toISOString()
          } satisfies LocalDraft)
        );
        window.localStorage.removeItem(legacyDraftKey);
        initializedRef.current = true;
        if (shouldPushLocal) void persistServerDraft(authUser.sub, resolvedDraft, resolvedStep);
      } catch (error) {
        if (!cancelled) {
          const errorMessage = error instanceof Error ? error.message : "Worker onboarding could not be loaded.";
          setLoadError(errorMessage);
          setSaveState("error");
          notify(errorMessage, "error");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    return () => {
      cancelled = true;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [apiUrl, notify]);

  useEffect(() => {
    if (!initializedRef.current || !userId) return;
    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false;
      return;
    }
    const local: LocalDraft = { currentStep, data: draft, pendingSync: true, updatedAt: new Date().toISOString() };
    window.localStorage.setItem(draftKey(userId), JSON.stringify(local));
    setSaveState("saving");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => void persistServerDraft(userId, draft, currentStep), 700);
  }, [currentStep, draft, userId]);

  useEffect(() => {
    function saveWhenHidden() {
      if (document.visibilityState === "hidden" && initializedRef.current && userId) {
        void persistServerDraft(userId, draft, currentStep);
      }
    }
    document.addEventListener("visibilitychange", saveWhenHidden);
    return () => document.removeEventListener("visibilitychange", saveWhenHidden);
  }, [currentStep, draft, userId]);

  function updateDraft(nextDraft: WorkerDraft) {
    setDraft(nextDraft);
  }

  const updateLocationDraft = useCallback(
    (coordinates: { latitude: string; longitude: string }) => {
      setDraft((currentDraft) => {
        const nextDraft = { ...currentDraft, latitude: coordinates.latitude, longitude: coordinates.longitude };
        return nextDraft;
      });
    },
    []
  );

  const handlePlaceSelect = useCallback((selection: GooglePlaceSelection) => {
    updateLocationDraft({ latitude: selection.latitude, longitude: selection.longitude });
  }, [updateLocationDraft]);

  async function goToStep(step: number) {
    if (isStepSaving) return;
    const validationMessage = validateStep(currentStep);

    if (step > currentStep && validationMessage) {
      notify(validationMessage, "error");
      return;
    }

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setIsStepSaving(true);
    setCurrentStep(step);
    try {
      await persistServerDraft(userId, draft, step, `Step ${currentStep + 1} saved.`);
    } finally {
      setIsStepSaving(false);
    }
  }

  async function nextStep() {
    await goToStep(Math.min(steps.length - 1, currentStep + 1));
  }

  function saveDraft(successMessage = "Draft saved. You can come back later.") {
    void persistServerDraft(userId, draft, currentStep, successMessage);
  }

  function persistServerDraft(activeUserId: string, activeDraft: WorkerDraft, step: number, successMessage?: string) {
    if (!activeUserId) return;
    const revision = ++latestSaveRevisionRef.current;
    const localKey = draftKey(activeUserId);
    window.localStorage.setItem(localKey, JSON.stringify({ currentStep: step, data: activeDraft, pendingSync: true, updatedAt: new Date().toISOString() } satisfies LocalDraft));
    setSaveState("saving");
    const saveOperation = async () => {
      try {
        const response = await fetch(`${apiUrl}/worker-profiles/onboarding-draft`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currentStep: step, data: buildPayload(activeDraft) })
        });
        if (!response.ok) throw new Error(formatApiMessage(await readApiResponse(response), "Draft could not be synced."));
        if (revision === latestSaveRevisionRef.current) {
          window.localStorage.setItem(localKey, JSON.stringify({ currentStep: step, data: activeDraft, pendingSync: false, updatedAt: new Date().toISOString() } satisfies LocalDraft));
          setSaveState("saved");
          if (successMessage) notify(successMessage, "success");
        }
      } catch (error) {
        if (revision === latestSaveRevisionRef.current) {
          const errorMessage = error instanceof Error ? error.message : "Draft could not be synced.";
          setSaveState("device");
          if (successMessage) notify(errorMessage, "error");
        }
      }
    };
    const queuedSave = saveQueueRef.current.then(saveOperation, saveOperation);
    saveQueueRef.current = queuedSave.catch(() => undefined);
    return queuedSave;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationMessage = validateAll();

    if (validationMessage) {
      notify(validationMessage, "error");
      return;
    }

    if (loadError) {
      notify("Reload your existing worker profile before submitting changes.", "error");
      return;
    }

    setIsSubmitting(true);

    try {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      await persistServerDraft(userId, draft, currentStep);
      const response = await fetch(`${apiUrl}/worker-profiles/me`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(buildPayload(draft))
      });
      const result = await readApiResponse(response);

      if (!response.ok) {
        const errorMessage = formatApiMessage(result, "Worker onboarding could not be submitted.");
        notify(errorMessage, "error");
        return;
      }

      const profile = result as WorkerProfile;
      const submittedDraft = draftFromProfile(profile);
      setProfileId(profile.id);
      setDraft(submittedDraft);
      setStatus({
        completed: profile.onboarding?.verificationStatus === OnboardingStatus.Approved,
        profileId: profile.id,
        rejectedReason: profile.onboarding?.rejectedReason ?? null,
        verificationStatus: profile.onboarding?.verificationStatus ?? OnboardingStatus.PendingReview
      });
      initializedRef.current = false;
      if (userId) window.localStorage.removeItem(draftKey(userId));
      await fetch(`${apiUrl}/worker-profiles/onboarding-draft`, { method: "DELETE" });
      setBaseline(submittedDraft);
      setCurrentStep(4);
      setSaveState("saved");
      notify("Worker onboarding submitted for review.", "success");
      window.setTimeout(() => { initializedRef.current = true; }, 0);
    } catch {
      const errorMessage = "Unable to reach the MedShift API. Try again after checking the API server.";
      notify(errorMessage, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  function validateStep(step: number) {
    if (step === 0 && (draft.firstName.trim().length < 2 || draft.lastName.trim().length < 2)) {
      return "Enter your legal first and last name.";
    }

    if (step === 1) {
      const longitude = Number(draft.longitude);
      const latitude = Number(draft.latitude);
      const radius = Number(draft.maxDistanceKm);

      if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
        return "Enter a valid longitude between -180 and 180.";
      }

      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
        return "Enter a valid latitude between -90 and 90.";
      }

      if (!Number.isFinite(radius) || radius < 1 || radius > 250) {
        return "Choose a search radius between 1 and 250 km.";
      }
    }

    if (step === 2 && (!draft.availableDays.length || !draft.preferredShiftTypes.length)) {
      return "Select at least one available day and preferred shift type.";
    }

    if (step === 3) {
      if (!RequiredWorkerDocumentCategories.every((category) => draft.documents.some((document) => document.category === category))) {
        return "Upload your government ID, professional certificate or licence, and background-check document.";
      }
    }

    return "";
  }

  function validateAll() {
    for (let index = 0; index < steps.length - 1; index += 1) {
      const validationMessage = validateStep(index);

      if (validationMessage) {
        setCurrentStep(index);
        return validationMessage;
      }
    }

    return "";
  }

  async function viewDocument(document: WorkerDocumentRecord) {
    const response = await fetch(`${apiUrl}/uploads/worker-documents/${document.id}/access-url`);
    const result = await readApiResponse(response);
    if (!response.ok || !result || typeof result !== "object" || typeof (result as { url?: unknown }).url !== "string") {
      notify(formatApiMessage(result, "Unable to open this document."), "error");
      return;
    }
    window.open((result as { url: string }).url, "_blank", "noopener,noreferrer");
  }

  return (
    <main className="onboarding-standalone-page">
      <section className="onboarding-wizard-shell">
        <aside className="onboarding-step-rail">
          <div className="onboarding-rail-brand">
            <MedShiftLogo href="/" />
          </div>
          <div className="onboarding-status-chip">
            <StatusBadge tone={status.verificationStatus === OnboardingStatus.Approved ? "green" : "gold"}>
              {formatStatusLabel(status.verificationStatus ?? OnboardingStatus.Incomplete)}
            </StatusBadge>
          </div>
          <h2>Complete your worker profile</h2>
          <small className={`draft-sync-state ${saveState}`}>{formatSaveState(saveState)}</small>
          <div className="step-list">
            {steps.map((step, index) => (
              <button className={getStepButtonClass(index, currentStep)} disabled={isStepSaving} key={step.title} type="button" onClick={() => void goToStep(index)}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{step.title}</strong>
                <small>{step.caption}</small>
              </button>
            ))}
          </div>
          <div className="onboarding-draft-actions">
            <button className="draft-button" type="button" onClick={() => saveDraft()}>Save draft</button>
            {!loadError && (saveState === "error" || saveState === "device") ? <button className="draft-button" type="button" onClick={() => void persistServerDraft(userId, draft, currentStep, "Draft synchronized.")}>Retry sync</button> : null}
          </div>
        </aside>

        <form className="onboarding-step-card" onSubmit={handleSubmit}>
          {currentStep === 0 ? (
            <section>
              <StepHeading eyebrow="Step 1" title="Identity and clinical role" />
              <div className="onboarding-field-grid">
                <label>
                  Legal first name
                  <input value={draft.firstName} onChange={(event) => updateDraft({ ...draft, firstName: event.target.value })} minLength={2} maxLength={80} name="firstName" placeholder="Sarah" required />
                </label>
                <label>
                  Legal last name
                  <input value={draft.lastName} onChange={(event) => updateDraft({ ...draft, lastName: event.target.value })} minLength={2} maxLength={80} name="lastName" placeholder="Johnson" required />
                </label>
                <label>
                  Clinical role
                  <select value={draft.title} onChange={(event) => updateDraft({ ...draft, title: event.target.value as ClinicalRole })} name="title" required>
                    <option value={ClinicalRole.Hca}>Healthcare Assistant</option>
                    <option value={ClinicalRole.Rn}>Registered Nurse</option>
                    <option value={ClinicalRole.Lpn}>Licensed Practical Nurse</option>
                    <option value={ClinicalRole.Psw}>Personal Support Worker</option>
                  </select>
                </label>
              </div>
            </section>
          ) : null}

          {currentStep === 1 ? (
            <section>
              <StepHeading eyebrow="Step 2" title="Service area and location" />
              <div className="map-step-grid">
                <OnboardingMap label="Service area location" latitude={draft.latitude} longitude={draft.longitude} token={mapboxToken} onCoordinatesChange={updateLocationDraft} />
                <div className="onboarding-field-grid compact">
                  <GooglePlacesSearch apiKey={googlePlacesApiKey} label="Search address" onPlaceSelect={handlePlaceSelect} placeholder="Search an Alberta address" />
                  <label>
                    Longitude
                    <input value={draft.longitude} onChange={(event) => updateDraft({ ...draft, longitude: event.target.value })} inputMode="decimal" name="longitude" placeholder="-114.0719" required />
                  </label>
                  <label>
                    Latitude
                    <input value={draft.latitude} onChange={(event) => updateDraft({ ...draft, latitude: event.target.value })} inputMode="decimal" name="latitude" placeholder="51.0447" required />
                  </label>
                  <label>
                    Search radius
                    <input value={draft.maxDistanceKm} onChange={(event) => updateDraft({ ...draft, maxDistanceKm: event.target.value })} inputMode="numeric" min="1" max="250" name="maxDistanceKm" placeholder="25" required type="number" />
                  </label>
                </div>
              </div>
            </section>
          ) : null}

          {currentStep === 2 ? (
            <section>
              <StepHeading eyebrow="Step 3" title="Availability preferences" />
              <fieldset>
                <legend>Available days</legend>
                <div className="choice-grid">
                  {weekDays.map((day) => (
                    <label key={day}>
                      <input checked={draft.availableDays.includes(day)} onChange={() => updateDraft({ ...draft, availableDays: toggleSelection(day, draft.availableDays) })} type="checkbox" />
                      {formatChoice(day)}
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend>Preferred shifts</legend>
                <div className="choice-grid">
                  {shiftTypes.map((shiftType) => (
                    <label key={shiftType}>
                      <input checked={draft.preferredShiftTypes.includes(shiftType)} onChange={() => updateDraft({ ...draft, preferredShiftTypes: toggleSelection(shiftType, draft.preferredShiftTypes) })} type="checkbox" />
                      {formatChoice(shiftType)}
                    </label>
                  ))}
                </div>
              </fieldset>
            </section>
          ) : null}

          {currentStep === 3 ? (
            <section>
              <StepHeading eyebrow="Step 4" title="Documents" />
              <p className="settings-muted-line">Upload the three required verification documents. Files are stored privately and are only available to you and authorized MedShift administrators.</p>
              <WorkerDocumentsField
                apiUrl={apiUrl}
                documents={draft.documents}
                onChange={(documents) => {
                  const nextDraft = { ...draft, documents };
                  updateDraft(nextDraft);
                  void persistServerDraft(userId, nextDraft, currentStep);
                }}
                onMessage={(feedbackMessage, tone) => notify(feedbackMessage, tone)}
              />
            </section>
          ) : null}

          {currentStep === 4 ? (
            <section>
              <StepHeading eyebrow="Step 5" title="Review and submit" />
              {status.verificationStatus === OnboardingStatus.Rejected && status.rejectedReason ? (
                <div className="onboarding-review-alert error"><strong>Changes requested</strong><p>{status.rejectedReason}</p></div>
              ) : null}
              {status.verificationStatus === OnboardingStatus.Approved && baseline && requiresVerificationReset(baseline, draft) ? (
                <div className="onboarding-review-alert warning"><strong>Verification review required</strong><p>Changing your clinical role or required documents will return your profile to pending review.</p></div>
              ) : null}
              <div className="onboarding-review-sections">
                <ReviewSection title="Identity" error={validateStep(0)} onEdit={() => void goToStep(0)}>
                  <dl className="review-summary-grid">
                    <SummaryItem label="Legal first name" value={draft.firstName || "Not provided"} />
                    <SummaryItem label="Legal last name" value={draft.lastName || "Not provided"} />
                    <SummaryItem label="Clinical role" value={formatChoice(draft.title)} />
                  </dl>
                </ReviewSection>
                <ReviewSection title="Service area" error={validateStep(1)} onEdit={() => void goToStep(1)}>
                  <div className="review-location-grid">
                    <OnboardingMap label="Service area preview" latitude={draft.latitude} longitude={draft.longitude} token={mapboxToken} zoom={10} />
                    <dl className="review-summary-grid">
                      <SummaryItem label="Latitude" value={draft.latitude} />
                      <SummaryItem label="Longitude" value={draft.longitude} />
                      <SummaryItem label="Search radius" value={`${draft.maxDistanceKm} km`} />
                    </dl>
                  </div>
                </ReviewSection>
                <ReviewSection title="Availability" error={validateStep(2)} onEdit={() => void goToStep(2)}>
                  <dl className="review-summary-grid">
                    <SummaryItem label="Available days" value={draft.availableDays.map(formatChoice).join(", ") || "None selected"} />
                    <SummaryItem label="Preferred shifts" value={draft.preferredShiftTypes.map(formatChoice).join(", ") || "None selected"} />
                  </dl>
                </ReviewSection>
                <ReviewSection title="Documents" error={validateStep(3)} onEdit={() => void goToStep(3)}>
                  <div className="review-document-list">
                    {draft.documents.map((document) => (
                      <article key={document.id} className="review-document-row">
                        <div>
                          <strong>{formatDocumentCategory(document.category)}</strong>
                          <span>{document.originalFilename ?? "Uploaded document"}</span>
                          <small>{formatDocumentMeta(document)}</small>
                          {document.rejectionReason ? <small className="review-document-rejection">{document.rejectionReason}</small> : null}
                        </div>
                        <div>
                          <StatusBadge tone={document.verificationStatus === "VERIFIED" ? "green" : "gold"}>{formatStatusLabel(document.verificationStatus ?? "PENDING")}</StatusBadge>
                          <button className="secondary-step-button" type="button" onClick={() => void viewDocument(document)}>Preview</button>
                        </div>
                      </article>
                    ))}
                  </div>
                </ReviewSection>
              </div>
            </section>
          ) : null}

          <footer className="step-actions">
            <button className="secondary-step-button" disabled={currentStep === 0 || isStepSaving} type="button" onClick={() => void goToStep(Math.max(0, currentStep - 1))}>
              Back
            </button>
            {currentStep < steps.length - 1 ? (
              <button className="auth-submit" disabled={isStepSaving || isLoading || Boolean(loadError)} type="button" onClick={() => void nextStep()}>
                {isStepSaving ? "Saving..." : "Save and continue"}
              </button>
            ) : (
              <button className="auth-submit" disabled={isSubmitting || isLoading || Boolean(loadError)} type="submit">
                {isSubmitting ? "Submitting..." : submitLabel(status.verificationStatus, Boolean(profileId))}
              </button>
            )}
          </footer>
        </form>
      </section>
    </main>
  );
}

function StepHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="step-heading">
      <span>{eyebrow}</span>
      <h3>{title}</h3>
    </div>
  );
}

function ReviewSection({ children, error, onEdit, title }: { children: ReactNode; error?: string; onEdit: () => void; title: string }) {
  return (
    <article className={`onboarding-review-section${error ? " has-error" : ""}`}>
      <header>
        <h4>{title}</h4>
        <button className="secondary-step-button" type="button" onClick={onEdit}>Edit</button>
      </header>
      {error ? <p className="review-section-error">{error}</p> : null}
      {children}
    </article>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function buildPayload(draft: WorkerDraft) {
  return {
    firstName: draft.firstName.trim(),
    lastName: draft.lastName.trim(),
    title: draft.title,
    documents: draft.documents,
    location: { type: "Point", coordinates: [Number(draft.longitude), Number(draft.latitude)] },
    preferences: {
      availableDays: draft.availableDays,
      maxDistanceKm: Number(draft.maxDistanceKm),
      preferredShiftTypes: draft.preferredShiftTypes
    }
  };
}

function draftFromProfile(profile: WorkerProfile): WorkerDraft {
  return {
    availableDays: profile.preferences?.availableDays?.length ? profile.preferences.availableDays : initialDraft.availableDays,
    documents: profile.documents ?? [],
    firstName: profile.firstName ?? "",
    lastName: profile.lastName ?? "",
    latitude: String(profile.location?.coordinates?.[1] ?? initialDraft.latitude),
    longitude: String(profile.location?.coordinates?.[0] ?? initialDraft.longitude),
    maxDistanceKm: String(profile.preferences?.maxDistanceKm ?? initialDraft.maxDistanceKm),
    preferredShiftTypes: profile.preferences?.preferredShiftTypes?.length ? profile.preferences.preferredShiftTypes : initialDraft.preferredShiftTypes,
    title: profile.title ?? initialDraft.title
  };
}

function draftFromPayload(payload: ServerDraft["data"], fallback: WorkerDraft): WorkerDraft {
  return {
    availableDays: payload.preferences?.availableDays ?? fallback.availableDays,
    documents: (payload.documents as WorkerDocumentRecord[] | undefined) ?? fallback.documents,
    firstName: payload.firstName ?? fallback.firstName,
    lastName: payload.lastName ?? fallback.lastName,
    latitude: String(payload.location?.coordinates?.[1] ?? fallback.latitude),
    longitude: String(payload.location?.coordinates?.[0] ?? fallback.longitude),
    maxDistanceKm: String(payload.preferences?.maxDistanceKm ?? fallback.maxDistanceKm),
    preferredShiftTypes: payload.preferences?.preferredShiftTypes ?? fallback.preferredShiftTypes,
    title: payload.title ?? fallback.title
  };
}

function reconcileDraftDocuments(localDraft: WorkerDraft, profileDraft: WorkerDraft | null) {
  if (!profileDraft) return localDraft;
  const canonicalById = new Map(profileDraft.documents.map((document) => [document.id, document]));
  return {
    ...localDraft,
    documents: localDraft.documents.map((document) => canonicalById.get(document.id) ?? document)
  };
}

function readLocalDraft(key: string): LocalDraft | null {
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as LocalDraft) : null;
  } catch {
    return null;
  }
}

function readLegacyDraft(): LocalDraft | null {
  try {
    const value = window.localStorage.getItem(legacyDraftKey);
    if (!value) return null;
    return { currentStep: 0, data: { ...initialDraft, ...(JSON.parse(value) as Partial<WorkerDraft>) }, pendingSync: true, updatedAt: new Date().toISOString() };
  } catch {
    return null;
  }
}

function clampStep(step: number) {
  return Math.min(4, Math.max(0, Number.isFinite(step) ? step : 0));
}

function formatSaveState(state: SaveState) {
  if (state === "saving") return "Saving...";
  if (state === "saved") return "Saved";
  if (state === "device") return "Saved on this device";
  if (state === "error") return "Saved on this device";
  return "Autosave ready";
}

function submitLabel(status: OnboardingStatus | undefined, hasProfile: boolean) {
  if (!hasProfile) return "Submit for review";
  if (status === OnboardingStatus.Rejected) return "Resubmit for review";
  return "Save changes";
}

function requiresVerificationReset(baseline: WorkerDraft, current: WorkerDraft) {
  if (baseline.title !== current.title) return true;
  return RequiredWorkerDocumentCategories.some((category) =>
    baseline.documents.find((document) => document.category === category)?.id !== current.documents.find((document) => document.category === category)?.id
  );
}

function formatDocumentCategory(category: WorkerDocumentRecord["category"]) {
  if (category === "GOVERNMENT_ID") return "Government ID";
  if (category === "PROFESSIONAL_CERTIFICATE") return "Professional certificate or licence";
  if (category === "BACKGROUND_CHECK") return "Background-check document";
  return "Additional document";
}

function formatDocumentMeta(document: WorkerDocumentRecord) {
  const details = [document.format?.toUpperCase(), document.bytes ? formatBytes(document.bytes) : undefined, document.uploadedAt ? new Date(document.uploadedAt).toLocaleDateString() : undefined];
  return details.filter(Boolean).join(" · ");
}

function formatBytes(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function toggleSelection(value: string, selected: string[]) {
  return selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value];
}

async function readApiResponse(response: Response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

async function readNullableJson<T>(response: Response): Promise<T | null> {
  const body = await response.text();
  if (!body.trim()) return null;
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new Error("Saved onboarding data could not be loaded.");
  }
}

function formatApiMessage(result: unknown, fallback: string) {
  if (result && typeof result === "object" && "message" in result) {
    const message = (result as { message?: string | string[] }).message;
    return Array.isArray(message) ? message.join(" ") : message ?? fallback;
  }

  return fallback;
}

function formatChoice(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

function formatStatusLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function getStepButtonClass(index: number, currentStep: number) {
  if (index === currentStep) {
    return "active";
  }

  return index < currentStep ? "completed" : "";
}
