"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { BackgroundCheckStatus, ClinicalRole, OnboardingStatus } from "@medshift/shared-types";
import { MedShiftLogo, StatusBadge } from "@medshift/ui-components";
import { CloudinaryUploadField } from "../../cloudinary-upload-field";
import { OnboardingMap } from "../../onboarding-map";
import { useToast } from "../../toast-provider";

const draftKey = "medshift.workerOnboardingDraft";
const weekDays = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
const shiftTypes = ["DAY", "EVENING", "NIGHT", "WEEKEND"];
const steps = [
  { title: "Identity", caption: "Legal name and clinical role" },
  { title: "Service Area", caption: "Map location and search radius" },
  { title: "Availability", caption: "Days and shift preferences" },
  { title: "Credentials", caption: "Document reference and consent" },
  { title: "Review", caption: "Submit for verification" }
];

type WorkerDraft = {
  availableDays: string[];
  backgroundConsent: boolean;
  credentialType: string;
  credentialUrl: string;
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
  credentials?: Array<{ type?: string; documentUrl?: string; isVerified?: boolean }>;
  backgroundCheck?: { status?: BackgroundCheckStatus; consentedAt?: string };
  location?: { type: "Point"; coordinates: [number, number] };
  onboarding?: { verificationStatus?: OnboardingStatus; rejectedReason?: string };
  preferences?: {
    availableDays?: string[];
    maxDistanceKm?: number;
    preferredShiftTypes?: string[];
  };
};

type OnboardingApiStatus = {
  completed?: boolean;
  nextStep?: string;
  profileId?: string | null;
  rejectedReason?: string | null;
  verificationStatus?: OnboardingStatus;
};

const initialDraft: WorkerDraft = {
  availableDays: ["MONDAY", "TUESDAY", "WEDNESDAY"],
  backgroundConsent: false,
  credentialType: "HCA certificate",
  credentialUrl: "",
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
  const apiUrl = useMemo(() => process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000", []);
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  const [currentStep, setCurrentStep] = useState(0);
  const [draft, setDraft] = useState<WorkerDraft>(initialDraft);
  const [profileId, setProfileId] = useState("");
  const [status, setStatus] = useState<OnboardingApiStatus>({ verificationStatus: OnboardingStatus.Incomplete });
  const [message, setMessage] = useState("Draft saved locally after every step.");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const storedDraft = window.localStorage.getItem(draftKey);

    if (storedDraft) {
      setDraft({ ...initialDraft, ...JSON.parse(storedDraft) });
      setMessage("Draft restored. Continue from the last completed step.");
    }

    const token = window.localStorage.getItem("medshift.accessToken");

    if (!token) {
      setIsLoading(false);
      setMessage("Sign in or complete registration before starting worker onboarding.");
      return;
    }

    Promise.all([
      fetch(`${apiUrl}/worker-profiles/onboarding-status`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${apiUrl}/worker-profiles/me`, { headers: { Authorization: `Bearer ${token}` } })
    ])
      .then(async ([statusResponse, profileResponse]) => {
        if (statusResponse.ok) {
          setStatus(await statusResponse.json());
        }

        if (profileResponse.ok) {
          hydrateProfile((await profileResponse.json()) as WorkerProfile);
        }
      })
      .catch(() => setMessage("Worker onboarding is available, but live profile status could not be loaded."))
      .finally(() => setIsLoading(false));
  }, [apiUrl]);

  function updateDraft(nextDraft: WorkerDraft) {
    setDraft(nextDraft);
    window.localStorage.setItem(draftKey, JSON.stringify(nextDraft));
  }

  const updateLocationDraft = useCallback(
    (coordinates: { latitude: string; longitude: string }) => {
      setDraft((currentDraft) => {
        const nextDraft = { ...currentDraft, latitude: coordinates.latitude, longitude: coordinates.longitude };
        window.localStorage.setItem(draftKey, JSON.stringify(nextDraft));
        return nextDraft;
      });
    },
    []
  );

  function goToStep(step: number) {
    const validationMessage = validateStep(currentStep);

    if (step > currentStep && validationMessage) {
      setMessage(validationMessage);
      notify(validationMessage, "error");
      return;
    }

    saveDraft(`Step ${currentStep + 1} saved as draft.`);
    setCurrentStep(step);
  }

  function nextStep() {
    goToStep(Math.min(steps.length - 1, currentStep + 1));
  }

  function saveDraft(successMessage = "Draft saved. You can come back later.") {
    window.localStorage.setItem(draftKey, JSON.stringify(draft));
    setMessage(successMessage);
    notify(successMessage, "success");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationMessage = validateAll();

    if (validationMessage) {
      setMessage(validationMessage);
      notify(validationMessage, "error");
      return;
    }

    const token = window.localStorage.getItem("medshift.accessToken");

    if (!token) {
      const signInMessage = "Sign in before submitting worker onboarding.";
      setMessage(signInMessage);
      notify(signInMessage, "error");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(profileId ? `${apiUrl}/worker-profiles/${profileId}` : `${apiUrl}/worker-profiles`, {
        method: profileId ? "PATCH" : "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(buildPayload(draft))
      });
      const result = await readApiResponse(response);

      if (!response.ok) {
        const errorMessage = formatApiMessage(result, "Worker onboarding could not be submitted.");
        setMessage(errorMessage);
        notify(errorMessage, "error");
        return;
      }

      const profile = result as WorkerProfile;
      hydrateProfile(profile);
      setStatus({
        completed: profile.onboarding?.verificationStatus === OnboardingStatus.Approved,
        profileId: profile.id,
        rejectedReason: profile.onboarding?.rejectedReason ?? null,
        verificationStatus: profile.onboarding?.verificationStatus ?? OnboardingStatus.PendingReview
      });
      window.localStorage.removeItem(draftKey);
      setMessage("Worker onboarding submitted. MedShift will review your credentials before live shift matching is enabled.");
      notify("Worker onboarding submitted for review.", "success");
    } catch {
      const errorMessage = "Unable to reach the MedShift API. Try again after checking the API server.";
      setMessage(errorMessage);
      notify(errorMessage, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  function hydrateProfile(profile: WorkerProfile) {
    setProfileId(profile.id);
    updateDraft({
      availableDays: profile.preferences?.availableDays?.length ? profile.preferences.availableDays : draft.availableDays,
      backgroundConsent: Boolean(profile.backgroundCheck?.consentedAt),
      credentialType: profile.credentials?.[0]?.type ?? draft.credentialType,
      credentialUrl: profile.credentials?.[0]?.documentUrl ?? draft.credentialUrl,
      firstName: profile.firstName ?? draft.firstName,
      lastName: profile.lastName ?? draft.lastName,
      latitude: String(profile.location?.coordinates?.[1] ?? draft.latitude),
      longitude: String(profile.location?.coordinates?.[0] ?? draft.longitude),
      maxDistanceKm: String(profile.preferences?.maxDistanceKm ?? draft.maxDistanceKm),
      preferredShiftTypes: profile.preferences?.preferredShiftTypes?.length ? profile.preferences.preferredShiftTypes : draft.preferredShiftTypes,
      title: profile.title ?? draft.title
    });
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
      if (draft.credentialType.trim().length < 2 || draft.credentialUrl.trim().length < 8) {
        return "Add credential type and a document link or file reference.";
      }

      if (!draft.backgroundConsent) {
        return "Confirm background-check consent to submit onboarding.";
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
          <p>{isLoading ? "Loading your worker profile..." : message}</p>
          <div className="step-list">
            {steps.map((step, index) => (
              <button className={getStepButtonClass(index, currentStep)} key={step.title} type="button" onClick={() => goToStep(index)}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{step.title}</strong>
                <small>{step.caption}</small>
              </button>
            ))}
          </div>
          <button className="draft-button" type="button" onClick={() => saveDraft()}>
            Save draft
          </button>
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
              <StepHeading eyebrow="Step 2" title="Service area and Mapbox location" />
              <div className="map-step-grid">
                <OnboardingMap label="Mapbox service area" latitude={draft.latitude} longitude={draft.longitude} token={mapboxToken} onCoordinatesChange={updateLocationDraft} />
                <div className="onboarding-field-grid compact">
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
              <StepHeading eyebrow="Step 4" title="Credentials and background consent" />
              <div className="onboarding-field-grid">
                <label>
                  Credential type
                  <input value={draft.credentialType} onChange={(event) => updateDraft({ ...draft, credentialType: event.target.value })} minLength={2} maxLength={80} name="credentialType" placeholder="HCA certificate" required />
                </label>
                <label>
                  Document link or reference
                  <input value={draft.credentialUrl} onChange={(event) => updateDraft({ ...draft, credentialUrl: event.target.value })} minLength={8} maxLength={240} name="credentialUrl" placeholder="https://secure-file-link.example/document.pdf" required />
                </label>
              </div>
              <CloudinaryUploadField
                label="Upload credential file"
                value={draft.credentialUrl}
                onUploaded={(secureUrl) => updateDraft({ ...draft, credentialUrl: secureUrl })}
                onMessage={(feedbackMessage, tone) => {
                  setMessage(feedbackMessage);
                  notify(feedbackMessage, tone);
                }}
              />
              <label className="consent-row">
                <input checked={draft.backgroundConsent} onChange={(event) => updateDraft({ ...draft, backgroundConsent: event.target.checked })} type="checkbox" required />
                I consent to MedShift reviewing my background-check readiness and credentials.
              </label>
            </section>
          ) : null}

          {currentStep === 4 ? (
            <section>
              <StepHeading eyebrow="Step 5" title="Review and submit" />
              <div className="review-summary-grid">
                <SummaryItem label="Name" value={`${draft.firstName} ${draft.lastName}`} />
                <SummaryItem label="Role" value={draft.title} />
                <SummaryItem label="Location" value={`${draft.latitude}, ${draft.longitude}`} />
                <SummaryItem label="Radius" value={`${draft.maxDistanceKm} km`} />
                <SummaryItem label="Availability" value={`${draft.availableDays.length} days · ${draft.preferredShiftTypes.join(", ")}`} />
                <SummaryItem label="Credential" value={draft.credentialType} />
              </div>
            </section>
          ) : null}

          <footer className="step-actions">
            <button className="secondary-step-button" disabled={currentStep === 0} type="button" onClick={() => setCurrentStep((step) => Math.max(0, step - 1))}>
              Back
            </button>
            {currentStep < steps.length - 1 ? (
              <button className="auth-submit" type="button" onClick={nextStep}>
                Save and continue
              </button>
            ) : (
              <button className="auth-submit" disabled={isSubmitting} type="submit">
                {isSubmitting ? "Submitting..." : "Submit for review"}
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
    credentials: [{ type: draft.credentialType.trim(), documentUrl: draft.credentialUrl.trim(), isVerified: false }],
    backgroundCheck: {
      status: BackgroundCheckStatus.Pending,
      consentedAt: draft.backgroundConsent ? new Date().toISOString() : undefined
    },
    location: { type: "Point", coordinates: [Number(draft.longitude), Number(draft.latitude)] },
    preferences: {
      availableDays: draft.availableDays,
      maxDistanceKm: Number(draft.maxDistanceKm),
      preferredShiftTypes: draft.preferredShiftTypes
    }
  };
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
