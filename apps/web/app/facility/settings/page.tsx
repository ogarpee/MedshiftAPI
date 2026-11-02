"use client";

import { apiFetch as fetch } from "../../session-fetch";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { FacilityType, GeoPoint, NotificationSummary, OnboardingStatus } from "@medshift/shared-types";
import { DashboardShell, StatusBadge } from "@medshift/ui-components";
import { Building2, CreditCard, LocateFixed, MapPin, Save, ShieldCheck } from "lucide-react";
import { GooglePlacesSearch } from "../../google-places-search";
import type { GooglePlaceSelection } from "../../google-places-search";
import { OnboardingMap } from "../../onboarding-map";
import { useToast } from "../../toast-provider";
import { useDashboardNotifications } from "../../use-dashboard-notifications";

const settingsTabs = [
  { id: "profile", label: "Profile" },
  { id: "serviceArea", label: "Service Area" },
  { id: "billing", label: "Billing" },
  { id: "security", label: "Security" }
] as const;

type FacilitySettingsTab = (typeof settingsTabs)[number]["id"];

type FacilitySettingsForm = {
  billingContactEmail: string;
  city: string;
  contactEmail: string;
  contactName: string;
  contactPhone: string;
  facilityType: FacilityType;
  latitude: string;
  longitude: string;
  name: string;
  paymentMethodLabel: string;
  postalCode: string;
  province: string;
  staffingContactConfirmed: boolean;
  street: string;
  termsAccepted: boolean;
};

type FacilityProfile = {
  id: string;
  name?: string;
  facilityType?: FacilityType;
  address?: { street?: string; city?: string; province?: string; postalCode?: string; country?: string };
  contactPerson?: { name?: string; phone?: string; email?: string };
  billingStatus?: "ACTIVE" | "INACTIVE";
  location?: GeoPoint;
  onboarding?: { verificationStatus?: OnboardingStatus; rejectedReason?: string };
  readiness?: {
    acceptedTermsAt?: string;
    billingContactEmail?: string;
    paymentMethodLabel?: string;
    staffingContactConfirmed?: boolean;
  };
};

type SecurityForm = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const initialForm: FacilitySettingsForm = {
  billingContactEmail: "",
  city: "",
  contactEmail: "",
  contactName: "",
  contactPhone: "",
  facilityType: FacilityType.LongTermCare,
  latitude: "51.0447",
  longitude: "-114.0719",
  name: "",
  paymentMethodLabel: "",
  postalCode: "",
  province: "AB",
  staffingContactConfirmed: false,
  street: "",
  termsAccepted: false
};

const initialSecurityForm: SecurityForm = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: ""
};

export default function FacilitySettingsPage() {
  const { notify } = useToast();
  const apiUrl = useMemo(() => process.env.NEXT_PUBLIC_API_URL ?? "", []);
  const {
    isLoadingNotifications,
    markAllNotificationsRead,
    markNotificationRead,
    notifications,
    unreadNotificationCount
  } = useDashboardNotifications(apiUrl);
  const googlePlacesApiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  const [activeTab, setActiveTab] = useState<FacilitySettingsTab>("profile");
  const [form, setForm] = useState<FacilitySettingsForm>(initialForm);
  const [securityForm, setSecurityForm] = useState<SecurityForm>(initialSecurityForm);
  const [profile, setProfile] = useState<FacilityProfile | null>(null);
  const [, setMessage] = useState("Loading facility settings...");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  const hydrateProfile = useCallback((nextProfile: FacilityProfile) => {
    setProfile(nextProfile);
    setForm({
      billingContactEmail: nextProfile.readiness?.billingContactEmail ?? nextProfile.contactPerson?.email ?? initialForm.billingContactEmail,
      city: nextProfile.address?.city ?? initialForm.city,
      contactEmail: nextProfile.contactPerson?.email ?? initialForm.contactEmail,
      contactName: nextProfile.contactPerson?.name ?? initialForm.contactName,
      contactPhone: nextProfile.contactPerson?.phone ?? initialForm.contactPhone,
      facilityType: nextProfile.facilityType ?? initialForm.facilityType,
      latitude: String(nextProfile.location?.coordinates?.[1] ?? initialForm.latitude),
      longitude: String(nextProfile.location?.coordinates?.[0] ?? initialForm.longitude),
      name: nextProfile.name ?? initialForm.name,
      paymentMethodLabel: nextProfile.readiness?.paymentMethodLabel ?? initialForm.paymentMethodLabel,
      postalCode: nextProfile.address?.postalCode ?? initialForm.postalCode,
      province: nextProfile.address?.province ?? initialForm.province,
      staffingContactConfirmed: Boolean(nextProfile.readiness?.staffingContactConfirmed),
      street: nextProfile.address?.street ?? initialForm.street,
      termsAccepted: Boolean(nextProfile.readiness?.acceptedTermsAt)
    });
  }, []);

  useEffect(() => {
    const token = "cookie-session";

    if (!token) {
      setNeedsAuth(true);
      setMessage("Sign in as a facility to manage profile and security settings.");
      setIsLoading(false);
      return;
    }

    fetch(`${apiUrl}/facility-profiles/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        if (response.status === 404) {
          setNeedsOnboarding(true);
          setMessage("Complete facility onboarding before editing settings.");
          return;
        }

        if (!response.ok) {
          throw new Error("Unable to load facility profile");
        }

        hydrateProfile((await response.json()) as FacilityProfile);
        setMessage("Facility settings loaded from the live profile.");
      })
      .catch(() => setMessage("Facility settings could not be loaded. Check your session and API server."))
      .finally(() => setIsLoading(false));
  }, [apiUrl, hydrateProfile]);

  function updateForm(nextForm: FacilitySettingsForm) {
    setForm(nextForm);
  }

  function updateLocation(coordinates: { latitude: string; longitude: string }) {
    setForm((current) => ({ ...current, latitude: coordinates.latitude, longitude: coordinates.longitude }));
  }

  const handlePlaceSelect = useCallback((selection: GooglePlaceSelection) => {
    setForm((current) => ({
      ...current,
      city: selection.city ?? current.city,
      latitude: selection.latitude,
      longitude: selection.longitude,
      postalCode: selection.postalCode ?? current.postalCode,
      province: selection.province ?? current.province,
      street: selection.street ?? current.street
    }));
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (activeTab === "security") {
      await handlePasswordChange();
      return;
    }

    if (!profile?.id) {
      const onboardingMessage = "Complete facility onboarding before saving settings.";
      setMessage(onboardingMessage);
      notify(onboardingMessage, "error");
      return;
    }

    const validationMessage = validateFacilityForm(form);

    if (validationMessage) {
      setMessage(validationMessage);
      notify(validationMessage, "error");
      return;
    }

    const token = "cookie-session";

    if (!token) {
      setNeedsAuth(true);
      const signInMessage = "Sign in again before saving facility settings.";
      setMessage(signInMessage);
      notify(signInMessage, "error");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(`${apiUrl}/facility-profiles/${profile.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(buildFacilityPayload(form, profile))
      });
      const result = await readApiResponse(response);

      if (!response.ok) {
        const errorMessage = formatApiMessage(result, "Facility settings could not be saved.");
        setMessage(errorMessage);
        notify(errorMessage, "error");
        return;
      }

      hydrateProfile(result as FacilityProfile);
      setMessage("Facility settings saved. Changes may return your profile to review.");
      notify("Facility settings saved.", "success");
    } catch {
      const errorMessage = "Unable to reach the MedShift API. Try again after checking the API server.";
      setMessage(errorMessage);
      notify(errorMessage, "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePasswordChange() {
    const validationMessage = validateSecurityForm(securityForm);

    if (validationMessage) {
      setMessage(validationMessage);
      notify(validationMessage, "error");
      return;
    }

    const token = "cookie-session";

    if (!token) {
      setNeedsAuth(true);
      const signInMessage = "Sign in again before changing your password.";
      setMessage(signInMessage);
      notify(signInMessage, "error");
      return;
    }

    setIsChangingPassword(true);

    try {
      const response = await fetch(`${apiUrl}/auth/password`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          currentPassword: securityForm.currentPassword,
          newPassword: securityForm.newPassword
        })
      });
      const result = await readApiResponse(response);

      if (!response.ok) {
        const errorMessage = formatApiMessage(result, "Password could not be updated.");
        setMessage(errorMessage);
        notify(errorMessage, "error");
        return;
      }

      setSecurityForm(initialSecurityForm);
      setMessage("Password updated.");
      notify("Password updated.", "success");
    } catch {
      const errorMessage = "Unable to reach the MedShift API. Try again after checking the API server.";
      setMessage(errorMessage);
      notify(errorMessage, "error");
    } finally {
      setIsChangingPassword(false);
    }
  }

  const onboardingStatus = profile?.onboarding?.verificationStatus ?? OnboardingStatus.Incomplete;
  const statusTone = onboardingStatus === OnboardingStatus.Approved ? "green" : onboardingStatus === OnboardingStatus.Rejected ? "red" : "gold";

  return (
    <DashboardShell
      className="facility-page worker-page"
      eyebrow={<StatusBadge tone={statusTone}>{formatStatusLabel(onboardingStatus)}</StatusBadge>}
      navItems={[
        { label: "Shifts", href: "/facility" },
        { label: "Find Workers", href: "/facility/workers" },
        { label: "Roster", href: "/facility/roster" },
        { label: "Reviews", href: "/facility/reviews" },
        { label: "Marketplace", href: "/facility/marketplace" },
        { label: "Settings", href: "/facility/settings", active: true }
      ]}
      notificationLoading={isLoadingNotifications}
      notifications={notifications}
      onMarkAllNotificationsRead={markAllNotificationsRead}
      onNotificationClick={(notification) => void markNotificationRead(notification as NotificationSummary)}
      title="Facility settings"
      unreadNotificationCount={unreadNotificationCount}
      userLabel={form.name || "Facility workspace"}
    >
      <section className="worker-settings-shell">
        {needsAuth ? (
          <EmptySettingsState title="Sign in required" message="Facility settings are available after you sign in with a facility account." href="/login" action="Sign in" />
        ) : needsOnboarding ? (
          <EmptySettingsState title="Onboarding required" message="Create your facility profile before editing service area, billing, and security settings." href="/facility/onboarding" action="Start onboarding" />
        ) : (
          <form className="worker-settings-layout" onSubmit={handleSubmit}>
            {onboardingStatus !== OnboardingStatus.Approved ? (
              <section className="dashboard-onboarding-banner" aria-label="Facility onboarding status">
                <div>
                  <span>{onboardingStatus === OnboardingStatus.Incomplete ? "Facility setup required" : "Verification pending"}</span>
                  <h3>{onboardingStatus === OnboardingStatus.Incomplete ? "Complete onboarding to post live shifts." : "Your facility profile is under review."}</h3>
                  <p>{onboardingStatus === OnboardingStatus.Incomplete ? "Finish organization, service area, contact, and billing readiness." : "Settings remain editable while approval is pending."}</p>
                </div>
                <a className="dashboard-banner-action" href="/facility/onboarding">
                  {onboardingStatus === OnboardingStatus.Incomplete ? "Continue onboarding" : "Review onboarding"}
                </a>
              </section>
            ) : null}
            <div className="worker-settings-main-stack">
              <div className="worker-settings-tabs" role="tablist" aria-label="Facility settings sections">
                {settingsTabs.map((tab) => (
                  <button aria-selected={activeTab === tab.id} className={activeTab === tab.id ? "active" : ""} key={tab.id} onClick={() => setActiveTab(tab.id)} role="tab" type="button">
                    {tab.label}
                  </button>
                ))}
              </div>

              <section className="worker-settings-panel settings-tab-panel" role="tabpanel">
                {activeTab === "profile" ? (
                  <>
                    <SectionHeading icon={<Building2 aria-hidden="true" />} title="Profile" caption="Organization details shown to workers and MedShift operations." />
                    <div className="settings-field-grid profile-field-stack">
                      <label>
                        Facility name
                        <input disabled={isLoading} value={form.name} onChange={(event) => updateForm({ ...form, name: event.target.value })} minLength={2} maxLength={120} placeholder="Bow Valley Care Centre" required />
                      </label>
                      <label>
                        Care setting
                        <select disabled={isLoading} value={form.facilityType} onChange={(event) => updateForm({ ...form, facilityType: event.target.value as FacilityType })} required>
                          {Object.values(FacilityType).map((facilityType) => (
                            <option key={facilityType} value={facilityType}>{formatChoice(facilityType)}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Primary contact
                        <input disabled={isLoading} value={form.contactName} onChange={(event) => updateForm({ ...form, contactName: event.target.value })} minLength={2} maxLength={100} placeholder="Amara Singh" required />
                      </label>
                      <label>
                        Contact phone
                        <input disabled={isLoading} value={form.contactPhone} onChange={(event) => updateForm({ ...form, contactPhone: event.target.value })} minLength={8} maxLength={30} placeholder="+1 403 555 0198" required />
                      </label>
                      <label>
                        Contact email
                        <input disabled={isLoading} value={form.contactEmail} onChange={(event) => updateForm({ ...form, contactEmail: event.target.value })} maxLength={254} placeholder="ops@facility.ca" required type="email" />
                      </label>
                    </div>
                  </>
                ) : null}

                {activeTab === "serviceArea" ? (
                  <>
                    <SectionHeading icon={<LocateFixed aria-hidden="true" />} title="Service Area" caption="Service address and map point used when matching nearby workers." />
                    <div className="settings-map-grid">
                      <OnboardingMap label="Facility service location" latitude={form.latitude} longitude={form.longitude} token={mapboxToken} onCoordinatesChange={updateLocation} />
                      <div className="settings-location-controls">
                        <div className="settings-field-grid compact">
                          <GooglePlacesSearch
                            apiKey={googlePlacesApiKey}
                            disabled={isLoading || isSaving}
                            label="Street address"
                            maxLength={140}
                            minLength={4}
                            name="street"
                            onInputChange={(street) => updateForm({ ...form, street })}
                            onPlaceSelect={handlePlaceSelect}
                            placeholder="Search or enter service address"
                            required
                            value={form.street}
                          />
                          <label>
                            City
                            <input disabled={isLoading} value={form.city} onChange={(event) => updateForm({ ...form, city: event.target.value })} minLength={2} maxLength={80} placeholder="Calgary" required />
                          </label>
                          <label>
                            Province
                            <input disabled={isLoading} value={form.province} onChange={(event) => updateForm({ ...form, province: event.target.value })} minLength={2} maxLength={40} placeholder="AB" required />
                          </label>
                          <label>
                            Postal code
                            <input disabled={isLoading} value={form.postalCode} onChange={(event) => updateForm({ ...form, postalCode: event.target.value })} minLength={5} maxLength={12} placeholder="T2P 1J9" required />
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

                {activeTab === "billing" ? (
                  <>
                    <SectionHeading icon={<CreditCard aria-hidden="true" />} title="Billing" caption="Readiness details required before live shift posting can be approved." />
                    <div className="settings-field-grid">
                      <label>
                        Billing contact email
                        <input disabled={isLoading} value={form.billingContactEmail} onChange={(event) => updateForm({ ...form, billingContactEmail: event.target.value })} maxLength={254} placeholder="billing@facility.ca" required type="email" />
                      </label>
                      <label>
                        Billing readiness method
                        <input disabled={isLoading} value={form.paymentMethodLabel} onChange={(event) => updateForm({ ...form, paymentMethodLabel: event.target.value })} minLength={2} maxLength={100} placeholder="ACH setup requested" required />
                      </label>
                    </div>
                    <label className="settings-consent-row">
                      <input checked={form.staffingContactConfirmed} disabled={isLoading} onChange={(event) => updateForm({ ...form, staffingContactConfirmed: event.target.checked })} type="checkbox" required />
                      The primary contact is authorized for staffing decisions and urgent coverage calls.
                    </label>
                    <label className="settings-consent-row">
                      <input checked={form.termsAccepted} disabled={isLoading} onChange={(event) => updateForm({ ...form, termsAccepted: event.target.checked })} type="checkbox" required />
                      I confirm billing readiness and understand shift posting begins after MedShift approval.
                    </label>
                    {profile?.readiness?.acceptedTermsAt ? <p className="settings-muted-line">Terms accepted {formatDate(profile.readiness.acceptedTermsAt)}.</p> : null}
                  </>
                ) : null}

                {activeTab === "security" ? (
                  <>
                    <SectionHeading icon={<ShieldCheck aria-hidden="true" />} title="Security" caption="Change the password for this facility account." />
                    <div className="settings-field-grid profile-field-stack">
                      <label>
                        Current password
                        <input autoComplete="current-password" disabled={isChangingPassword} value={securityForm.currentPassword} onChange={(event) => setSecurityForm({ ...securityForm, currentPassword: event.target.value })} minLength={8} required type="password" />
                      </label>
                      <label>
                        New password
                        <input autoComplete="new-password" disabled={isChangingPassword} value={securityForm.newPassword} onChange={(event) => setSecurityForm({ ...securityForm, newPassword: event.target.value })} minLength={8} required type="password" />
                      </label>
                      <label>
                        Confirm new password
                        <input autoComplete="new-password" disabled={isChangingPassword} value={securityForm.confirmPassword} onChange={(event) => setSecurityForm({ ...securityForm, confirmPassword: event.target.value })} minLength={8} required type="password" />
                      </label>
                    </div>
                  </>
                ) : null}
              </section>
            </div>

            <footer className="worker-settings-actions">
              <div>
                <strong>{activeTab === "security" ? "Security" : formatStatusLabel(onboardingStatus)}</strong>
                <span>{activeTab === "security" ? "Password changes apply immediately." : "Changes can return your facility profile to review."}</span>
              </div>
              {activeTab === "security" ? (
                <button className="auth-submit" disabled={isChangingPassword || isLoading} type="button" onClick={() => void handlePasswordChange()}>
                  <ShieldCheck aria-hidden="true" />
                  {isChangingPassword ? "Updating..." : "Update password"}
                </button>
              ) : (
                <button className="auth-submit" disabled={isSaving || isLoading} type="submit">
                  <Save aria-hidden="true" />
                  {isSaving ? "Saving..." : "Save settings"}
                </button>
              )}
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

function buildFacilityPayload(form: FacilitySettingsForm, profile: FacilityProfile) {
  return {
    name: form.name.trim(),
    facilityType: form.facilityType,
    address: {
      street: form.street.trim(),
      city: form.city.trim(),
      province: form.province.trim(),
      postalCode: form.postalCode.trim(),
      country: profile.address?.country ?? "CA"
    },
    contactPerson: {
      name: form.contactName.trim(),
      phone: form.contactPhone.trim(),
      email: form.contactEmail.trim().toLowerCase()
    },
    billingStatus: "ACTIVE",
    location: { type: "Point", coordinates: [Number(form.longitude), Number(form.latitude)] },
    readiness: {
      billingContactEmail: form.billingContactEmail.trim().toLowerCase(),
      paymentMethodLabel: form.paymentMethodLabel.trim(),
      staffingContactConfirmed: form.staffingContactConfirmed,
      acceptedTermsAt: form.termsAccepted ? profile.readiness?.acceptedTermsAt ?? new Date().toISOString() : undefined
    }
  };
}

function validateFacilityForm(form: FacilitySettingsForm) {
  const longitude = Number(form.longitude);
  const latitude = Number(form.latitude);

  if (form.name.trim().length < 2) {
    return "Enter the legal facility name.";
  }

  if (form.contactName.trim().length < 2 || form.contactPhone.trim().length < 8 || !isValidEmail(form.contactEmail)) {
    return "Enter a primary contact name, phone, and email.";
  }

  if (form.street.trim().length < 4 || form.city.trim().length < 2 || form.province.trim().length < 2 || form.postalCode.trim().length < 5) {
    return "Enter a complete service address.";
  }

  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return "Enter a valid longitude between -180 and 180.";
  }

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    return "Enter a valid latitude between -90 and 90.";
  }

  if (!isValidEmail(form.billingContactEmail) || form.paymentMethodLabel.trim().length < 2) {
    return "Enter billing contact email and readiness method.";
  }

  if (!form.staffingContactConfirmed || !form.termsAccepted) {
    return "Confirm staffing contact readiness and billing terms.";
  }

  return "";
}

function validateSecurityForm(form: SecurityForm) {
  if (form.currentPassword.length < 8) {
    return "Enter your current password.";
  }

  if (form.newPassword.length < 8) {
    return "New password must be at least 8 characters.";
  }

  if (form.newPassword !== form.confirmPassword) {
    return "New password and confirmation must match.";
  }

  return "";
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
  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
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
