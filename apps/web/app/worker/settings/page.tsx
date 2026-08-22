"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { BackgroundCheckStatus, ClinicalRole, GeoPoint, NotificationSummary, OnboardingStatus } from "@medshift/shared-types";
import { DashboardShell, StatusBadge } from "@medshift/ui-components";
import { FileText, LocateFixed, MapPin, Save, Settings, UserRound } from "lucide-react";
import { CloudinaryUploadField } from "../../cloudinary-upload-field";
import { GooglePlacesSearch } from "../../google-places-search";
import type { GooglePlaceSelection } from "../../google-places-search";
import { OnboardingMap } from "../../onboarding-map";
import { useToast } from "../../toast-provider";
import { useDashboardNotifications } from "../../use-dashboard-notifications";

const weekDays = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
const shiftTypes = ["DAY", "EVENING", "NIGHT", "WEEKEND"];
const settingsTabs = [
  { id: "profile", label: "Profile" },
  { id: "matching", label: "Matching" },
  { id: "availability", label: "Availability" },
  { id: "credentials", label: "Credentials" }
] as const;

type SettingsTab = (typeof settingsTabs)[number]["id"];

type WorkerSettingsForm = {
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
  location?: GeoPoint;
  onboarding?: { verificationStatus?: OnboardingStatus; rejectedReason?: string };
  preferences?: {
    availableDays?: string[];
    maxDistanceKm?: number;
    preferredShiftTypes?: string[];
  };
};

const initialForm: WorkerSettingsForm = {
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

export default function WorkerSettingsPage() {
  const { notify } = useToast();
  const apiUrl = useMemo(() => process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000", []);
  const {
    isLoadingNotifications,
    markAllNotificationsRead,
    markNotificationRead,
    notifications,
    unreadNotificationCount
  } = useDashboardNotifications(apiUrl);
  const googlePlacesApiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  const [form, setForm] = useState<WorkerSettingsForm>(initialForm);
  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const [, setMessage] = useState("Loading your worker settings...");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");

  const hydrateProfile = useCallback((nextProfile: WorkerProfile) => {
    setProfile(nextProfile);
    setForm({
      availableDays: nextProfile.preferences?.availableDays?.length ? nextProfile.preferences.availableDays : initialForm.availableDays,
      backgroundConsent: Boolean(nextProfile.backgroundCheck?.consentedAt),
      credentialType: nextProfile.credentials?.[0]?.type ?? initialForm.credentialType,
      credentialUrl: nextProfile.credentials?.[0]?.documentUrl ?? initialForm.credentialUrl,
      firstName: nextProfile.firstName ?? initialForm.firstName,
      lastName: nextProfile.lastName ?? initialForm.lastName,
      latitude: String(nextProfile.location?.coordinates?.[1] ?? initialForm.latitude),
      longitude: String(nextProfile.location?.coordinates?.[0] ?? initialForm.longitude),
      maxDistanceKm: String(nextProfile.preferences?.maxDistanceKm ?? initialForm.maxDistanceKm),
      preferredShiftTypes: nextProfile.preferences?.preferredShiftTypes?.length ? nextProfile.preferences.preferredShiftTypes : initialForm.preferredShiftTypes,
      title: nextProfile.title ?? initialForm.title
    });
  }, []);

  useEffect(() => {
    const token = window.localStorage.getItem("medshift.accessToken");

    if (!token) {
      setNeedsAuth(true);
      setMessage("Sign in as a worker to manage your profile and matching settings.");
      setIsLoading(false);
      return;
    }

    fetch(`${apiUrl}/worker-profiles/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        if (response.status === 404) {
          setNeedsOnboarding(true);
          setMessage("Complete worker onboarding first, then your setup data will be editable here.");
          return;
        }

        if (!response.ok) {
          throw new Error("Unable to load worker profile");
        }

        hydrateProfile((await response.json()) as WorkerProfile);
        setMessage("Settings loaded. Updates to radius and availability affect live matching.");
      })
      .catch(() => setMessage("Worker settings could not be loaded. Check your session and API server."))
      .finally(() => setIsLoading(false));
  }, [apiUrl, hydrateProfile]);

  function updateForm(nextForm: WorkerSettingsForm) {
    setForm(nextForm);
  }

  function updateLocation(coordinates: { latitude: string; longitude: string }) {
    setForm((current) => ({ ...current, latitude: coordinates.latitude, longitude: coordinates.longitude }));
  }

  const handlePlaceSelect = useCallback((selection: GooglePlaceSelection) => {
    updateLocation({ latitude: selection.latitude, longitude: selection.longitude });
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!profile?.id) {
      setMessage("Complete worker onboarding before saving settings.");
      notify("Complete worker onboarding before saving settings.", "error");
      return;
    }

    const validationMessage = validateForm(form);

    if (validationMessage) {
      setMessage(validationMessage);
      notify(validationMessage, "error");
      return;
    }

    const token = window.localStorage.getItem("medshift.accessToken");

    if (!token) {
      setNeedsAuth(true);
      setMessage("Sign in again before saving worker settings.");
      notify("Sign in again before saving worker settings.", "error");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(`${apiUrl}/worker-profiles/${profile.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(buildPayload(form, profile))
      });
      const result = await readApiResponse(response);

      if (!response.ok) {
        const errorMessage = formatApiMessage(result, "Worker settings could not be saved.");
        setMessage(errorMessage);
        notify(errorMessage, "error");
        return;
      }

      hydrateProfile(result as WorkerProfile);
      setMessage("Worker settings saved. Matching will use your updated radius and availability.");
      notify("Worker settings saved.", "success");
    } catch {
      const errorMessage = "Unable to reach the MedShift API. Try again after checking the API server.";
      setMessage(errorMessage);
      notify(errorMessage, "error");
    } finally {
      setIsSaving(false);
    }
  }

  const onboardingStatus = profile?.onboarding?.verificationStatus ?? OnboardingStatus.Incomplete;
  const statusTone = onboardingStatus === OnboardingStatus.Approved ? "green" : onboardingStatus === OnboardingStatus.Rejected ? "red" : "gold";
  const profileLabel = `${form.firstName || "Worker"} ${form.lastName || "settings"}`.trim();

  return (
    <DashboardShell
      className="worker-page"
      eyebrow={<StatusBadge tone={statusTone}>{formatStatusLabel(onboardingStatus)}</StatusBadge>}
      navItems={[
        { label: "Shift board", href: "/worker" },
        { label: "Settings", href: "/worker/settings", active: true }
      ]}
      notificationLoading={isLoadingNotifications}
      notifications={notifications}
      onMarkAllNotificationsRead={markAllNotificationsRead}
      onNotificationClick={(notification) => void markNotificationRead(notification as NotificationSummary)}
      title="Worker settings"
      unreadNotificationCount={unreadNotificationCount}
      userLabel={profileLabel}
    >
      <section className="worker-settings-shell">
        {needsAuth ? (
          <EmptySettingsState title="Sign in required" message="Worker settings are available after you sign in with a worker account." href="/login" action="Sign in" />
        ) : needsOnboarding ? (
          <EmptySettingsState title="Onboarding required" message="Create your worker profile before editing service area, availability, and credential data." href="/worker/onboarding" action="Start onboarding" />
        ) : (
          <form className="worker-settings-layout" onSubmit={handleSubmit}>
            {onboardingStatus !== OnboardingStatus.Approved ? (
              <section className="dashboard-onboarding-banner" aria-label="Worker onboarding status">
                <div>
                  <span>{onboardingStatus === OnboardingStatus.Incomplete ? "Profile required" : "Verification pending"}</span>
                  <h3>{onboardingStatus === OnboardingStatus.Incomplete ? "Complete onboarding to unlock live shifts." : "Your worker profile is under review."}</h3>
                  <p>{onboardingStatus === OnboardingStatus.Incomplete ? "Keep your setup data complete before submitting for review." : "Settings remain editable while approval is pending."}</p>
                </div>
                <a className="dashboard-banner-action" href="/worker/onboarding">
                  {onboardingStatus === OnboardingStatus.Incomplete ? "Continue onboarding" : "Review onboarding"}
                </a>
              </section>
            ) : null}
            <div className="worker-settings-main-stack">
              <div className="worker-settings-tabs" role="tablist" aria-label="Worker settings sections">
                {settingsTabs.map((tab) => (
                  <button aria-selected={activeTab === tab.id} className={activeTab === tab.id ? "active" : ""} key={tab.id} onClick={() => setActiveTab(tab.id)} role="tab" type="button">
                    {tab.label}
                  </button>
                ))}
              </div>

              <section className="worker-settings-panel settings-tab-panel" role="tabpanel">
                {activeTab === "profile" ? (
                  <>
                    <SectionHeading icon={<UserRound aria-hidden="true" />} title="Profile" caption="Legal identity and clinical role used for facility matching." />
                    <div className="settings-field-grid profile-field-stack">
                      <label>
                        Legal first name
                        <input disabled={isLoading} value={form.firstName} onChange={(event) => updateForm({ ...form, firstName: event.target.value })} minLength={2} maxLength={80} placeholder="Sarah" required />
                      </label>
                      <label>
                        Legal last name
                        <input disabled={isLoading} value={form.lastName} onChange={(event) => updateForm({ ...form, lastName: event.target.value })} minLength={2} maxLength={80} placeholder="Johnson" required />
                      </label>
                      <label>
                        Clinical role
                        <select disabled={isLoading} value={form.title} onChange={(event) => updateForm({ ...form, title: event.target.value as ClinicalRole })} required>
                          <option value={ClinicalRole.Hca}>Healthcare Assistant</option>
                          <option value={ClinicalRole.Rn}>Registered Nurse</option>
                          <option value={ClinicalRole.Lpn}>Licensed Practical Nurse</option>
                          <option value={ClinicalRole.Psw}>Personal Support Worker</option>
                        </select>
                      </label>
                    </div>
                  </>
                ) : null}

                {activeTab === "matching" ? (
                  <>
                    <SectionHeading icon={<LocateFixed aria-hidden="true" />} title="Matching area" caption="Open shifts are refreshed from this map point and radius." />
                    <div className="settings-map-grid">
                      <OnboardingMap label="Worker matching location" latitude={form.latitude} longitude={form.longitude} token={mapboxToken} onCoordinatesChange={updateLocation} />
                      <div className="settings-location-controls">
                        <div className="settings-radius-meter">
                          <span>Radius</span>
                          <strong>{form.maxDistanceKm || "0"} km</strong>
                        </div>
                        <div className="settings-field-grid compact">
                          <GooglePlacesSearch apiKey={googlePlacesApiKey} disabled={isLoading || isSaving} label="Search address" onPlaceSelect={handlePlaceSelect} placeholder="Search an Alberta address" />
                          <label>
                            Matching radius
                            <input disabled={isLoading} value={form.maxDistanceKm} onChange={(event) => updateForm({ ...form, maxDistanceKm: event.target.value })} inputMode="numeric" min="1" max="250" placeholder="25" type="number" required />
                          </label>
                          <label>
                            Latitude
                            <input disabled={isLoading} value={form.latitude} onChange={(event) => updateForm({ ...form, latitude: event.target.value })} inputMode="decimal" placeholder="51.0447" required />
                          </label>
                          <label>
                            Longitude
                            <input disabled={isLoading} value={form.longitude} onChange={(event) => updateForm({ ...form, longitude: event.target.value })} inputMode="decimal" placeholder="-114.0719" required />
                          </label>
                        </div>
                      </div>
                    </div>
                  </>
                ) : null}

                {activeTab === "availability" ? (
                  <>
                    <SectionHeading icon={<Settings aria-hidden="true" />} title="Availability" caption="Choose the days and shift types facilities should match against." />
                    <fieldset className="settings-choice-group">
                      <legend>Available days</legend>
                      <div className="settings-choice-grid">
                        {weekDays.map((day) => (
                          <label className={form.availableDays.includes(day) ? "selected" : ""} key={day}>
                            <input checked={form.availableDays.includes(day)} disabled={isLoading} onChange={() => updateForm({ ...form, availableDays: toggleSelection(day, form.availableDays) })} type="checkbox" />
                            {formatChoice(day)}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <fieldset className="settings-choice-group">
                      <legend>Preferred shifts</legend>
                      <div className="settings-choice-grid compact-options">
                        {shiftTypes.map((shiftType) => (
                          <label className={form.preferredShiftTypes.includes(shiftType) ? "selected" : ""} key={shiftType}>
                            <input checked={form.preferredShiftTypes.includes(shiftType)} disabled={isLoading} onChange={() => updateForm({ ...form, preferredShiftTypes: toggleSelection(shiftType, form.preferredShiftTypes) })} type="checkbox" />
                            {formatChoice(shiftType)}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  </>
                ) : null}

                {activeTab === "credentials" ? (
                  <>
                    <SectionHeading icon={<FileText aria-hidden="true" />} title="Credentials" caption="Update the credential document MedShift reviews for approval." />
                    <div className="settings-field-grid">
                      <label>
                        Credential type
                        <input disabled={isLoading} value={form.credentialType} onChange={(event) => updateForm({ ...form, credentialType: event.target.value })} minLength={2} maxLength={80} placeholder="HCA certificate" required />
                      </label>
                      <label>
                        Document link or reference
                        <input disabled={isLoading} value={form.credentialUrl} onChange={(event) => updateForm({ ...form, credentialUrl: event.target.value })} minLength={8} maxLength={240} placeholder="https://secure-file-link.example/document.pdf" required />
                      </label>
                    </div>
                    <CloudinaryUploadField
                      label="Upload replacement credential"
                      value={form.credentialUrl}
                      onUploaded={(secureUrl) => updateForm({ ...form, credentialUrl: secureUrl })}
                      onMessage={(feedbackMessage, tone) => {
                        setMessage(feedbackMessage);
                        notify(feedbackMessage, tone);
                      }}
                    />
                    <label className="settings-consent-row">
                      <input checked={form.backgroundConsent} onChange={(event) => updateForm({ ...form, backgroundConsent: event.target.checked })} type="checkbox" required />
                      I consent to MedShift reviewing my background-check readiness and credentials.
                    </label>
                    {profile?.backgroundCheck?.consentedAt ? (
                      <p className="settings-muted-line">Consent recorded {formatDate(profile.backgroundCheck.consentedAt)}.</p>
                    ) : null}
                  </>
                ) : null}
              </section>
            </div>

            <footer className="worker-settings-actions">
              <div>
                <strong>{formatStatusLabel(onboardingStatus)}</strong>
                <span>Changes can return your profile to review.</span>
              </div>
              <button className="auth-submit" disabled={isSaving || isLoading} type="submit">
                <Save aria-hidden="true" />
                {isSaving ? "Saving..." : "Save settings"}
              </button>
            </footer>
          </form>
        )}
      </section>
    </DashboardShell>
  );
}

function SectionHeading({ caption, icon, title }: { caption: string; icon: ReactNode; title: string }) {
  return (
    <div className="worker-settings-section-heading">
      <span>{icon}</span>
      <div>
        <h3>{title}</h3>
        <p>{caption}</p>
      </div>
    </div>
  );
}

function EmptySettingsState({ action, href, message, title }: { action: string; href: string; message: string; title: string }) {
  return (
    <section className="worker-empty-state worker-settings-empty">
      <MapPin aria-hidden="true" />
      <h3>{title}</h3>
      <p>{message}</p>
      <a className="dashboard-banner-action" href={href}>
        {action}
      </a>
    </section>
  );
}

function buildPayload(form: WorkerSettingsForm, profile: WorkerProfile) {
  return {
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    title: form.title,
    credentials: [{ type: form.credentialType.trim(), documentUrl: form.credentialUrl.trim(), isVerified: profile.credentials?.[0]?.isVerified ?? false }],
    backgroundCheck: {
      status: profile.backgroundCheck?.status ?? BackgroundCheckStatus.Pending,
      consentedAt: form.backgroundConsent ? profile.backgroundCheck?.consentedAt ?? new Date().toISOString() : undefined
    },
    location: { type: "Point", coordinates: [Number(form.longitude), Number(form.latitude)] },
    preferences: {
      availableDays: form.availableDays,
      maxDistanceKm: Number(form.maxDistanceKm),
      preferredShiftTypes: form.preferredShiftTypes
    }
  };
}

function validateForm(form: WorkerSettingsForm) {
  const longitude = Number(form.longitude);
  const latitude = Number(form.latitude);
  const radius = Number(form.maxDistanceKm);

  if (form.firstName.trim().length < 2 || form.lastName.trim().length < 2) {
    return "Enter your legal first and last name.";
  }

  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return "Enter a valid longitude between -180 and 180.";
  }

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    return "Enter a valid latitude between -90 and 90.";
  }

  if (!Number.isFinite(radius) || radius < 1 || radius > 250) {
    return "Choose a matching radius between 1 and 250 km.";
  }

  if (!form.availableDays.length || !form.preferredShiftTypes.length) {
    return "Select at least one available day and preferred shift type.";
  }

  if (form.credentialType.trim().length < 2 || form.credentialUrl.trim().length < 8) {
    return "Add credential type and a document link or file reference.";
  }

  if (!form.backgroundConsent) {
    return "Confirm background-check consent before saving worker settings.";
  }

  return "";
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}
