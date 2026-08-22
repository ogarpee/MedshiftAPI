"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { FacilityType, OnboardingStatus } from "@medshift/shared-types";
import { MedShiftLogo, StatusBadge } from "@medshift/ui-components";
import { GooglePlacesSearch } from "../../google-places-search";
import type { GooglePlaceSelection } from "../../google-places-search";
import { OnboardingMap } from "../../onboarding-map";
import { useToast } from "../../toast-provider";

const draftKey = "medshift.facilityOnboardingDraft";
const steps = [
  { title: "Organization", caption: "Facility identity and care setting" },
  { title: "Service Address", caption: "Service location" },
  { title: "Primary Contact", caption: "Staffing contact details" },
  { title: "Billing", caption: "Readiness and authorization" },
  { title: "Review", caption: "Submit registration" }
];

type FacilityDraft = {
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
  location?: { type: "Point"; coordinates: [number, number] };
  onboarding?: { verificationStatus?: OnboardingStatus; rejectedReason?: string };
  readiness?: {
    acceptedTermsAt?: string;
    billingContactEmail?: string;
    paymentMethodLabel?: string;
    staffingContactConfirmed?: boolean;
  };
};

type OnboardingApiStatus = {
  completed?: boolean;
  nextStep?: string;
  profileId?: string | null;
  rejectedReason?: string | null;
  verificationStatus?: OnboardingStatus;
};

const initialDraft: FacilityDraft = {
  billingContactEmail: "",
  city: "Calgary",
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

export default function FacilityOnboardingPage() {
  const { notify } = useToast();
  const apiUrl = useMemo(() => process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000", []);
  const googlePlacesApiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  const [currentStep, setCurrentStep] = useState(0);
  const [draft, setDraft] = useState<FacilityDraft>(initialDraft);
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
      setMessage("Sign in or complete registration before starting facility onboarding.");
      return;
    }

    Promise.all([
      fetch(`${apiUrl}/facility-profiles/onboarding-status`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${apiUrl}/facility-profiles/me`, { headers: { Authorization: `Bearer ${token}` } })
    ])
      .then(async ([statusResponse, profileResponse]) => {
        if (statusResponse.ok) {
          setStatus(await statusResponse.json());
        }

        if (profileResponse.ok) {
          hydrateProfile((await profileResponse.json()) as FacilityProfile);
        }
      })
      .catch(() => setMessage("Facility onboarding is available, but live profile status could not be loaded."))
      .finally(() => setIsLoading(false));
  }, [apiUrl]);

  function updateDraft(nextDraft: FacilityDraft) {
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

  const handlePlaceSelect = useCallback((selection: GooglePlaceSelection) => {
    setDraft((currentDraft) => {
      const nextDraft = {
        ...currentDraft,
        city: selection.city ?? currentDraft.city,
        latitude: selection.latitude,
        longitude: selection.longitude,
        postalCode: selection.postalCode ?? currentDraft.postalCode,
        province: selection.province ?? currentDraft.province,
        street: selection.street ?? currentDraft.street
      };
      window.localStorage.setItem(draftKey, JSON.stringify(nextDraft));
      return nextDraft;
    });
  }, []);

  function saveDraft(successMessage = "Draft saved. You can come back later.") {
    window.localStorage.setItem(draftKey, JSON.stringify(draft));
    setMessage(successMessage);
    notify(successMessage, "success");
  }

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
      const signInMessage = "Sign in before submitting facility onboarding.";
      setMessage(signInMessage);
      notify(signInMessage, "error");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(profileId ? `${apiUrl}/facility-profiles/${profileId}` : `${apiUrl}/facility-profiles`, {
        method: profileId ? "PATCH" : "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(buildPayload(draft))
      });
      const result = await readApiResponse(response);

      if (!response.ok) {
        const errorMessage = formatApiMessage(result, "Facility onboarding could not be submitted.");
        setMessage(errorMessage);
        notify(errorMessage, "error");
        return;
      }

      const profile = result as FacilityProfile;
      hydrateProfile(profile);
      setStatus({
        completed: profile.onboarding?.verificationStatus === OnboardingStatus.Approved,
        profileId: profile.id,
        rejectedReason: profile.onboarding?.rejectedReason ?? null,
        verificationStatus: profile.onboarding?.verificationStatus ?? OnboardingStatus.PendingReview
      });
      window.localStorage.removeItem(draftKey);
      setMessage("Facility onboarding submitted. MedShift will review your registration before live shift posting is enabled.");
      notify("Facility onboarding submitted for review.", "success");
    } catch {
      const errorMessage = "Unable to reach the MedShift API. Try again after checking the API server.";
      setMessage(errorMessage);
      notify(errorMessage, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  function hydrateProfile(profile: FacilityProfile) {
    setProfileId(profile.id);
    updateDraft({
      billingContactEmail: profile.readiness?.billingContactEmail ?? profile.contactPerson?.email ?? draft.billingContactEmail,
      city: profile.address?.city ?? draft.city,
      contactEmail: profile.contactPerson?.email ?? draft.contactEmail,
      contactName: profile.contactPerson?.name ?? draft.contactName,
      contactPhone: profile.contactPerson?.phone ?? draft.contactPhone,
      facilityType: profile.facilityType ?? draft.facilityType,
      latitude: String(profile.location?.coordinates?.[1] ?? draft.latitude),
      longitude: String(profile.location?.coordinates?.[0] ?? draft.longitude),
      name: profile.name ?? draft.name,
      paymentMethodLabel: profile.readiness?.paymentMethodLabel ?? draft.paymentMethodLabel,
      postalCode: profile.address?.postalCode ?? draft.postalCode,
      province: profile.address?.province ?? draft.province,
      staffingContactConfirmed: Boolean(profile.readiness?.staffingContactConfirmed),
      street: profile.address?.street ?? draft.street,
      termsAccepted: Boolean(profile.readiness?.acceptedTermsAt)
    });
  }

  function validateStep(step: number) {
    if (step === 0 && draft.name.trim().length < 2) {
      return "Enter the legal facility name.";
    }

    if (step === 1) {
      const longitude = Number(draft.longitude);
      const latitude = Number(draft.latitude);

      if (draft.street.trim().length < 4 || draft.city.trim().length < 2 || draft.province.trim().length < 2 || draft.postalCode.trim().length < 5) {
        return "Enter a complete service address.";
      }

      if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
        return "Enter a valid longitude between -180 and 180.";
      }

      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
        return "Enter a valid latitude between -90 and 90.";
      }
    }

    if (step === 2 && (draft.contactName.trim().length < 2 || draft.contactPhone.trim().length < 8 || !isValidEmail(draft.contactEmail))) {
      return "Enter a primary contact name, phone, and email.";
    }

    if (step === 3) {
      if (!isValidEmail(draft.billingContactEmail) || draft.paymentMethodLabel.trim().length < 2) {
        return "Enter billing contact email and readiness method.";
      }

      if (!draft.staffingContactConfirmed || !draft.termsAccepted) {
        return "Confirm staffing contact readiness and billing terms.";
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
          <h2>Complete facility registration</h2>
          <p>{isLoading ? "Loading your facility profile..." : message}</p>
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
              <StepHeading eyebrow="Step 1" title="Organization and care setting" />
              <div className="onboarding-field-grid">
                <label>
                  Legal facility name
                  <input value={draft.name} onChange={(event) => updateDraft({ ...draft, name: event.target.value })} minLength={2} maxLength={120} name="facilityName" placeholder="Bow Valley Care Centre" required />
                </label>
                <label>
                  Care setting
                  <select value={draft.facilityType} onChange={(event) => updateDraft({ ...draft, facilityType: event.target.value as FacilityType })} name="facilityType" required>
                    <option value={FacilityType.LongTermCare}>Long-term care</option>
                    <option value={FacilityType.Hospital}>Hospital</option>
                    <option value={FacilityType.Clinic}>Clinic</option>
                    <option value={FacilityType.HomeCare}>Home care</option>
                  </select>
                </label>
              </div>
            </section>
          ) : null}

          {currentStep === 1 ? (
            <section>
              <StepHeading eyebrow="Step 2" title="Service address and location" />
              <div className="map-step-grid">
                <OnboardingMap label="Service address location" latitude={draft.latitude} longitude={draft.longitude} token={mapboxToken} zoom={12} onCoordinatesChange={updateLocationDraft} />
                <div className="onboarding-field-grid compact">
                  <GooglePlacesSearch
                    apiKey={googlePlacesApiKey}
                    label="Street address"
                    maxLength={140}
                    minLength={4}
                    name="street"
                    onInputChange={(street) => updateDraft({ ...draft, street })}
                    onPlaceSelect={handlePlaceSelect}
                    placeholder="Search or enter service address"
                    required
                    value={draft.street}
                  />
                  <label>
                    City
                    <input value={draft.city} onChange={(event) => updateDraft({ ...draft, city: event.target.value })} minLength={2} maxLength={80} name="city" placeholder="Calgary" required />
                  </label>
                  <label>
                    Province
                    <input value={draft.province} onChange={(event) => updateDraft({ ...draft, province: event.target.value })} minLength={2} maxLength={40} name="province" placeholder="AB" required />
                  </label>
                  <label>
                    Postal code
                    <input value={draft.postalCode} onChange={(event) => updateDraft({ ...draft, postalCode: event.target.value })} minLength={5} maxLength={12} name="postalCode" placeholder="T2P 1J9" required />
                  </label>
                  <label>
                    Longitude
                    <input value={draft.longitude} onChange={(event) => updateDraft({ ...draft, longitude: event.target.value })} inputMode="decimal" name="longitude" placeholder="-114.0719" required />
                  </label>
                  <label>
                    Latitude
                    <input value={draft.latitude} onChange={(event) => updateDraft({ ...draft, latitude: event.target.value })} inputMode="decimal" name="latitude" placeholder="51.0447" required />
                  </label>
                </div>
              </div>
            </section>
          ) : null}

          {currentStep === 2 ? (
            <section>
              <StepHeading eyebrow="Step 3" title="Primary staffing contact" />
              <div className="onboarding-field-grid">
                <label>
                  Contact name
                  <input value={draft.contactName} onChange={(event) => updateDraft({ ...draft, contactName: event.target.value })} minLength={2} maxLength={100} name="contactName" placeholder="Amara Singh" required />
                </label>
                <label>
                  Contact phone
                  <input value={draft.contactPhone} onChange={(event) => updateDraft({ ...draft, contactPhone: event.target.value })} minLength={8} maxLength={30} name="contactPhone" placeholder="+1 403 555 0198" required />
                </label>
                <label>
                  Contact email
                  <input value={draft.contactEmail} onChange={(event) => updateDraft({ ...draft, contactEmail: event.target.value })} maxLength={254} name="contactEmail" placeholder="ops@facility.ca" required type="email" />
                </label>
              </div>
            </section>
          ) : null}

          {currentStep === 3 ? (
            <section>
              <StepHeading eyebrow="Step 4" title="Billing and readiness" />
              <div className="onboarding-field-grid">
                <label>
                  Billing contact email
                  <input value={draft.billingContactEmail} onChange={(event) => updateDraft({ ...draft, billingContactEmail: event.target.value })} maxLength={254} name="billingContactEmail" placeholder="billing@facility.ca" required type="email" />
                </label>
                <label>
                  Billing readiness method
                  <input value={draft.paymentMethodLabel} onChange={(event) => updateDraft({ ...draft, paymentMethodLabel: event.target.value })} minLength={2} maxLength={100} name="paymentMethodLabel" placeholder="ACH setup requested" required />
                </label>
              </div>
              <label className="consent-row">
                <input checked={draft.staffingContactConfirmed} onChange={(event) => updateDraft({ ...draft, staffingContactConfirmed: event.target.checked })} type="checkbox" required />
                The primary contact is authorized for staffing decisions and urgent coverage calls.
              </label>
              <label className="consent-row">
                <input checked={draft.termsAccepted} onChange={(event) => updateDraft({ ...draft, termsAccepted: event.target.checked })} type="checkbox" required />
                I confirm billing readiness and understand shift posting begins after MedShift approval.
              </label>
            </section>
          ) : null}

          {currentStep === 4 ? (
            <section>
              <StepHeading eyebrow="Step 5" title="Review and submit registration" />
              <div className="review-summary-grid">
                <SummaryItem label="Facility" value={draft.name} />
                <SummaryItem label="Care setting" value={formatChoice(draft.facilityType)} />
                <SummaryItem label="Address" value={`${draft.street}, ${draft.city}, ${draft.province}`} />
                <SummaryItem label="Map location" value={`${draft.latitude}, ${draft.longitude}`} />
                <SummaryItem label="Contact" value={`${draft.contactName} · ${draft.contactEmail}`} />
                <SummaryItem label="Billing" value={draft.paymentMethodLabel} />
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
                {isSubmitting ? "Submitting..." : "Submit facility for review"}
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

function buildPayload(draft: FacilityDraft) {
  return {
    name: draft.name.trim(),
    facilityType: draft.facilityType,
    address: {
      street: draft.street.trim(),
      city: draft.city.trim(),
      province: draft.province.trim(),
      postalCode: draft.postalCode.trim(),
      country: "CA"
    },
    contactPerson: {
      name: draft.contactName.trim(),
      phone: draft.contactPhone.trim(),
      email: draft.contactEmail.trim().toLowerCase()
    },
    billingStatus: "ACTIVE",
    location: { type: "Point", coordinates: [Number(draft.longitude), Number(draft.latitude)] },
    readiness: {
      billingContactEmail: draft.billingContactEmail.trim().toLowerCase(),
      paymentMethodLabel: draft.paymentMethodLabel.trim(),
      staffingContactConfirmed: draft.staffingContactConfirmed,
      acceptedTermsAt: draft.termsAccepted ? new Date().toISOString() : undefined
    }
  };
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

function getStepButtonClass(index: number, currentStep: number) {
  if (index === currentStep) {
    return "active";
  }

  return index < currentStep ? "completed" : "";
}
