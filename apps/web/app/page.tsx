"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { Variants } from "framer-motion";
import { FacilityType, UserRole, WaitlistAvailability, WaitlistProfessionalRole } from "@medshift/shared-types";
import { MedShiftLogo } from "@medshift/ui-components";
import { Calendar, Check, Clock, MapPin, ShieldCheck, Users } from "lucide-react";

type SignupType = "worker" | "facility";

type WorkerWaitlistDetails = {
  availability: WaitlistAvailability;
  city: string;
  clinicalRole: WaitlistProfessionalRole;
  fullName: string;
  phone: string;
};

type FacilityWaitlistDetails = {
  city: string;
  facilityName: string;
  facilityType: FacilityType;
  phone: string;
  province: string;
};

type StoredAuthUser = {
  email: string;
  role: UserRole;
};

type WaitlistResponse = {
  code?: string;
  emailDelivered?: boolean;
  joined?: boolean;
  message?: string;
};

const steps = [
  {
    title: "Post or Browse",
    copy: "Facilities post open shifts in minutes. Workers browse available opportunities in their area and specialty.",
    icon: <CalendarIcon />,
    label: "Shift intake",
    detail: "RN · Tonight · Calgary",
    meta: ["Role", "Time", "Location"]
  },
  {
    title: "Get Matched",
    copy: "MedShift surfaces the right fit - verified credentials, proximity, and availability - instantly.",
    icon: <NetworkIcon />,
    label: "Matching engine",
    detail: "Credential + proximity score",
    meta: ["Verified", "Nearby", "Available"]
  },
  {
    title: "Shift Filled",
    copy: "Confirm, show up, deliver care. Facilities get the coverage they need.",
    icon: <CheckIcon />,
    label: "Confirmed care",
    detail: "Sarah J. accepted",
    meta: ["Notified", "Confirmed", "Covered"]
  }
];

const facilityFeatures = [
  {
    title: "Post urgent gaps in minutes",
    copy: "Create open shifts with role, rate, time, and location details your team can act on quickly.",
    icon: <BoltIcon />
  },
  {
    title: "Only verified professionals",
    copy: "Workers enter your queue after credential, background-check, and availability signals are reviewed.",
    icon: <ShieldIcon />
  },
  {
    title: "Keep coverage costs transparent",
    copy: "Direct platform workflows help facilities avoid agency markups and manage payments in one place.",
    icon: <DollarIcon />
  }
];

const workerPerks = [
  {
    title: "Choose shifts around your life",
    copy: "Filter by date, distance, professional role, and shift type before you commit.",
    icon: <CalendarIcon />
  },
  {
    title: "See rates before accepting",
    copy: "Review hourly pay, facility type, and commute details up front.",
    icon: <DollarIcon />
  },
  {
    title: "Build a trusted profile",
    copy: "Credentials, ratings, and completed shifts help you earn repeat requests.",
    icon: <ShieldIcon />
  }
];

const stats = [
  ["<2h", "Average shift fill time"],
  ["100%", "Credential verified"],
  ["0", "Agency markups"],
  ["24/7", "Platform availability"]
];

const facilityProof = [
  ["Live queue", "Qualified workers surfaced by role and proximity"],
  ["Admin-ready", "Facility registrations move into verification review"],
  ["Direct pay", "Transparent coverage costs without agency middlemen"]
];

const facilityPreviewShifts = [
  ["HCA", "Tonight, 7 PM", "3 nearby matches"],
  ["HCA", "Tomorrow, 8 AM", "5 available workers"],
  ["PSW", "Weekend", "Credential review ready"]
];

const workerPreviewShifts = [
  ["HCA", "Long-term care", "$34/hr", "2.1 km"],
  ["PSW", "Supportive living evening", "$34/hr", "5.8 km"],
  ["HCA", "Retirement residence casual", "$32/hr", "8.4 km"]
];

const workerProof = ["Flexible shifts", "Verified facilities", "Clear rates"];

const values = [
  ["🤝", "Compassion", "Every shift we fill improves patient care and a professional's livelihood."],
  ["🛡", "Reliability", "Facilities and workers can count on MedShift to deliver, every time."],
  ["✦", "Integrity", "Transparent pricing, honest matching, no hidden fees or surprises."],
  ["⭐", "Excellence", "We hold professionals and facilities to the highest standard of care."]
];

const waitlistOptions = {
  worker: {
    title: "Healthcare Worker",
    copy: "Get notified when local shifts open for your role and preferred schedule.",
    placeholder: "name@example.com",
    cta: "Join as Worker",
    icon: <Users size={19} strokeWidth={2.2} />,
    points: ["Early shift alerts", "Credential-ready profile", "Flexible local work"]
  },
  facility: {
    title: "Facility",
    copy: "Be first to access verified workers for urgent and planned coverage gaps.",
    placeholder: "name@facility.ca",
    cta: "Join as Facility",
    icon: <ShieldCheck size={19} strokeWidth={2.2} />,
    points: ["Priority launch access", "Verified care staff", "Fast coverage support"]
  }
} satisfies Record<SignupType, {
  copy: string;
  cta: string;
  icon: ReactNode;
  placeholder: string;
  points: string[];
  title: string;
}>;

const sectionRevealVariants: Variants = {
  hidden: { opacity: 0, y: 44, filter: "blur(10px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.72,
      ease: [0.22, 1, 0.36, 1],
      staggerChildren: 0.11,
      delayChildren: 0.08
    }
  }
};

const heroRevealVariants: Variants = {
  hidden: { opacity: 0, y: 26, filter: "blur(8px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.68,
      ease: [0.22, 1, 0.36, 1],
      staggerChildren: 0.09
    }
  }
};

const itemRevealVariants: Variants = {
  hidden: { opacity: 0, y: 22, scale: 0.985 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.55,
      ease: [0.22, 1, 0.36, 1]
    }
  }
};

const professionalRoleOptions = [
  { label: "Healthcare aide", value: WaitlistProfessionalRole.HealthcareAide },
  { label: "Personal support worker", value: WaitlistProfessionalRole.PersonalSupportWorker },
  { label: "Other", value: WaitlistProfessionalRole.Other }
];

const availabilityOptions = [
  { label: "Day shifts", value: WaitlistAvailability.Days },
  { label: "Evenings", value: WaitlistAvailability.Evenings },
  { label: "Nights", value: WaitlistAvailability.Nights },
  { label: "Weekends", value: WaitlistAvailability.Weekends },
  { label: "Casual", value: WaitlistAvailability.Casual },
  { label: "Flexible", value: WaitlistAvailability.Flexible }
];

const facilityTypeOptions = [
  { label: "Long-term care", value: FacilityType.LongTermCare },
  { label: "Supportive living", value: FacilityType.SupportiveLiving },
  { label: "Retirement residence", value: FacilityType.RetirementResidence },
  { label: "Home care", value: FacilityType.HomeCare },
  { label: "Other", value: FacilityType.Other }
];

export default function HomePage() {
  const [signupType, setSignupType] = useState<SignupType>("worker");
  const [email, setEmail] = useState("");
  const [workerDetails, setWorkerDetails] = useState<WorkerWaitlistDetails>({
    availability: WaitlistAvailability.Flexible,
    city: "",
    clinicalRole: WaitlistProfessionalRole.HealthcareAide,
    fullName: "",
    phone: ""
  });
  const [facilityDetails, setFacilityDetails] = useState<FacilityWaitlistDetails>({
    city: "",
    facilityName: "",
    facilityType: FacilityType.LongTermCare,
    phone: "",
    province: ""
  });
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "warning" | "error">("success");
  const [isSubmittingWaitlist, setIsSubmittingWaitlist] = useState(false);
  const [authUser, setAuthUser] = useState<StoredAuthUser | null>(null);
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const dashboardHref = useMemo(() => getDashboardHref(authUser?.role), [authUser?.role]);
  const userInitials = useMemo(() => getUserInitials(authUser?.email), [authUser?.email]);
  const waitlistOption = waitlistOptions[signupType];

  useEffect(() => {
    const accessToken = window.localStorage.getItem("medshift.accessToken");
    const storedUser = window.localStorage.getItem("medshift.authUser");

    if (!accessToken) {
      setHasCheckedAuth(true);
      return;
    }

    if (!storedUser) {
      const tokenUser = readUserFromToken(accessToken);
      setAuthUser(tokenUser);
      setHasCheckedAuth(true);
      return;
    }

    try {
      setAuthUser(JSON.parse(storedUser) as StoredAuthUser);
    } catch {
      window.localStorage.removeItem("medshift.authUser");
    } finally {
      setHasCheckedAuth(true);
    }
  }, []);

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail || !isValidEmail(trimmedEmail)) {
      setMessageTone("error");
      setMessage("Please enter a valid email address.");
      return;
    }

    if (signupType === "worker" && (!workerDetails.fullName.trim() || !workerDetails.phone.trim() || !workerDetails.city.trim())) {
      setMessageTone("error");
      setMessage("Please share your name, phone number, and city so we can route worker launch updates.");
      return;
    }

    if (
      signupType === "facility" &&
      (!facilityDetails.facilityName.trim() || !facilityDetails.phone.trim() || !facilityDetails.city.trim() || !facilityDetails.province.trim())
    ) {
      setMessageTone("error");
      setMessage("Please share your facility name, phone number, city, and province so we can prioritize coverage support.");
      return;
    }

    setIsSubmittingWaitlist(true);
    setMessage("");
    setMessageTone("success");

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmedEmail,
          role: signupType === "worker" ? UserRole.Worker : UserRole.Facility,
          ...(signupType === "worker"
            ? {
                workerDetails: {
                  ...workerDetails,
                  city: workerDetails.city.trim(),
                  fullName: workerDetails.fullName.trim(),
                  phone: workerDetails.phone.trim()
                }
              }
            : {
                facilityDetails: {
                  ...facilityDetails,
                  city: facilityDetails.city.trim(),
                  facilityName: facilityDetails.facilityName.trim(),
                  phone: facilityDetails.phone.trim(),
                  province: facilityDetails.province.trim()
                }
              })
        })
      });

      if (!response.ok) {
        let result: WaitlistResponse = {};

        try {
          result = (await response.json()) as WaitlistResponse;
        } catch {
          result = {};
        }

        throw new Error(formatWaitlistError(result));
      }

      const result = (await response.json()) as WaitlistResponse;

      if (result.joined && result.emailDelivered === false) {
        setMessageTone("warning");
        setMessage(
          result.message ??
            "You're on the waitlist. We could not send the confirmation email yet, so the team should check Resend setup."
        );
        setEmail("");
        resetWaitlistDetails(signupType, setWorkerDetails, setFacilityDetails);
        return;
      }

      setMessageTone("success");
      setMessage(
        `You're on the list as a ${signupType === "worker" ? "healthcare worker" : "facility"}. Check your email for confirmation.`
      );
      setEmail("");
      resetWaitlistDetails(signupType, setWorkerDetails, setFacilityDetails);
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Unable to join the waitlist right now. Please try again.");
    } finally {
      setIsSubmittingWaitlist(false);
    }
  }

  function handleLogout() {
    window.localStorage.removeItem("medshift.accessToken");
    window.localStorage.removeItem("medshift.authUser");
    setAuthUser(null);
    setIsProfileMenuOpen(false);
  }

  return (
    <main className="marketing-page">
      <nav className="marketing-nav">
        <MedShiftLogo href="#top" />
        <div className="nav-links">
          <a href="#workers">For Workers</a>
          <a href="#facilities">For Facilities</a>
          <a href="#how">How It Works</a>
          {!hasCheckedAuth ? (
            <span className="nav-auth-placeholder" aria-hidden="true" />
          ) : authUser ? (
            <div className="nav-profile">
              <button
                aria-expanded={isProfileMenuOpen}
                aria-haspopup="menu"
                aria-label="Open profile menu"
                className="nav-profile-button"
                onClick={() => setIsProfileMenuOpen((current) => !current)}
                type="button"
              >
                <span className="nav-profile-avatar">{userInitials}</span>
              </button>
              {isProfileMenuOpen ? (
                <div className="nav-profile-menu" role="menu">
                  <div className="nav-profile-summary">
                    <strong>{authUser.email}</strong>
                    <span>{formatRole(authUser.role)}</span>
                  </div>
                  <a href={dashboardHref} role="menuitem">
                    Go to dashboard
                  </a>
                  <button onClick={handleLogout} role="menuitem" type="button">
                    Logout
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <>
              <a href="/login">Login</a>
              <a className="btn-nav" href="#signup">Join Now</a>
            </>
          )}
        </div>
      </nav>

      <RevealSection className="marketing-hero" id="top" variants={heroRevealVariants}>
        <motion.div className="hero-inner" variants={heroRevealVariants}>
          <motion.div variants={itemRevealVariants}>
            <motion.div className="hero-tag" variants={itemRevealVariants}>
              <DotIcon />
              Now accepting early access
            </motion.div>
            <motion.h1 variants={itemRevealVariants}>
              Fill Shifts.
              <br />
              <span className="gold">Change Lives.</span>
            </motion.h1>
            <motion.p className="hero-sub" variants={itemRevealVariants}>
              MedShift connects healthcare professionals with facilities that need care - fast, reliable, and on
              demand.
            </motion.p>
            <motion.div className="hero-ctas" variants={itemRevealVariants}>
              <a className="btn-primary" href="#workers">
                Find Shifts →
              </a>
              <a className="btn-secondary" href="#facilities">
                Hire Staff
              </a>
            </motion.div>
            <motion.div className="hero-trust" variants={itemRevealVariants}>
              <div className="trust-item">
                <BoltIcon />
                Fill shifts in under 2 hours
              </div>
              <div className="trust-item">
                <ShieldIcon />
                Verified professionals
              </div>
              <div className="trust-item">
                <DollarIcon />
                Get paid
              </div>
            </motion.div>
          </motion.div>

          <motion.div className="hero-card" variants={itemRevealVariants}>
            <div className="card-header">
              <div className="card-avatar">SJ</div>
              <div>
                <div className="card-name">Sarah J.</div>
                <div className="card-role">HealthCare Assistant · ⭐ 4.9</div>
              </div>
              <div className="badge-available">Available</div>
            </div>
            <ShiftDetail label="Upcoming Shift" value="Long-term Care Home" />
            <ShiftDetail label="Date & Time" value="May 24 · 7:00 AM - 3:00 PM" />
            <ShiftDetail label="Location" value="Calgary, AB" />
            <div className="card-cta" aria-label="Shift preview status">
              Shift preview
            </div>
          </motion.div>
        </motion.div>

        <motion.div className="hero-line" variants={itemRevealVariants}>
          <svg viewBox="0 0 1440 60" preserveAspectRatio="none" fill="none" xmlns="http://www.w3.org/2000/svg">
            <polyline
              points="0,30 200,30 250,30 280,5 310,55 340,30 400,30 450,30 480,15 510,45 540,30 600,30 700,30 730,8 760,52 790,30 900,30 1000,30 1030,18 1060,42 1090,30 1200,30 1440,30"
              stroke="#D4AF37"
              strokeWidth="2"
              fill="none"
            />
          </svg>
        </motion.div>
      </RevealSection>

      <RevealSection className="how" id="how">
        <motion.div className="how-inner" variants={sectionRevealVariants}>
          <motion.div className="how-header" variants={itemRevealVariants}>
            <div className="section-label">Simple by design</div>
            <h2>How MedShift Works</h2>
            <p className="section-sub">
              Three steps between an open shift and a qualified professional walking through your door.
            </p>
          </motion.div>
          <motion.div className="steps" variants={sectionRevealVariants}>
            {steps.map((step, index) => (
              <motion.article className="step" key={step.title} variants={itemRevealVariants}>
                <div className="step-connector" aria-hidden="true">→</div>
                <div className="step-visual">
                  <div className="step-icon">{step.icon}</div>
                  <div>
                    <span>{step.label}</span>
                    <strong>{step.detail}</strong>
                  </div>
                </div>
                <div className="step-meta">
                  {step.meta.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
                <div className="step-copy">
                  <div className="step-num">{index + 1}</div>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.copy}</p>
                  </div>
                </div>
              </motion.article>
            ))}
          </motion.div>
        </motion.div>
      </RevealSection>

      <RevealSection className="facilities" id="facilities">
        <motion.div className="facilities-inner" variants={sectionRevealVariants}>
          <motion.div className="facilities-copy" variants={itemRevealVariants}>
            <div className="section-label">For healthcare facilities</div>
            <h2>
              Fill critical shifts with verified local professionals.
            </h2>
            <p className="section-sub">
              MedShift helps care teams replace last-minute staffing scrambles with a cleaner workflow for posting
              shifts, reviewing matches, and keeping coverage moving.
            </p>
            <div className="facility-proof-grid" aria-label="Facility coverage proof">
              {facilityProof.map(([title, copy]) => (
                <motion.div key={title} variants={itemRevealVariants}>
                  <span>{title}</span>
                  <strong>{copy}</strong>
                </motion.div>
              ))}
            </div>
            <div className="feature-list">
              {facilityFeatures.map((feature) => (
                <motion.article className="feature-item" key={feature.title} variants={itemRevealVariants}>
                  <div className="feature-icon">{feature.icon}</div>
                  <div>
                    <div className="feature-title">{feature.title}</div>
                    <div className="feature-desc">{feature.copy}</div>
                  </div>
                </motion.article>
              ))}
            </div>
            <a className="btn-primary facility-cta" href="#signup">
              Get Early Access →
            </a>
          </motion.div>
          <motion.div className="facility-command-panel" aria-label="Facility coverage preview" variants={itemRevealVariants}>
            <div className="facility-command-header">
              <div>
                <span>Coverage command</span>
                <strong>Calgary care team</strong>
              </div>
              <small>Live matching</small>
            </div>
            <div className="facility-command-list">
              {facilityPreviewShifts.map(([role, time, matches]) => (
                <motion.article key={`${role}-${time}`} variants={itemRevealVariants}>
                  <div className="facility-role-badge">{role}</div>
                  <div>
                    <strong>{time}</strong>
                    <span>{matches}</span>
                  </div>
                  <Check size={16} aria-hidden="true" />
                </motion.article>
              ))}
            </div>
            <div className="stats-grid">
              {stats.map(([number, label]) => (
                <motion.article className="stat-card" key={label} variants={itemRevealVariants}>
                  <div className="stat-num">{number}</div>
                  <div className="stat-label">{label}</div>
                </motion.article>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </RevealSection>

      <RevealSection className="workers" id="workers">
        <motion.div className="workers-inner" variants={sectionRevealVariants}>
          <motion.div className="worker-preview-panel" aria-label="Worker shift board preview" variants={itemRevealVariants}>
            <div className="worker-preview-header">
              <div>
                <span>Shift board</span>
                <strong>Available near you</strong>
              </div>
              <small>Map + list</small>
            </div>
            <div className="worker-preview-list">
              {workerPreviewShifts.map(([role, facilityType, rate, distance]) => (
                <motion.article key={`${role}-${facilityType}`} variants={itemRevealVariants}>
                  <div className="worker-role-badge">{role}</div>
                  <div>
                    <strong>{facilityType}</strong>
                    <span>{distance} away</span>
                  </div>
                  <em>{rate}</em>
                </motion.article>
              ))}
            </div>
            <div className="worker-preview-footer">
              <div>
                <span>Credential status</span>
                <strong>Ready for review</strong>
              </div>
              <div>
                <span>Preferred radius</span>
                <strong>25 km</strong>
              </div>
            </div>
          </motion.div>
          <motion.div className="workers-copy" variants={itemRevealVariants}>
            <div className="section-label">For healthcare professionals</div>
            <h2>
              Pick up verified shifts without agency friction.
            </h2>
            <p className="section-sub">
              Browse nearby shifts, review rates up front, and accept work that fits your schedule.
            </p>
            <div className="worker-proof-row" aria-label="Healthcare professional benefits">
              {workerProof.map((item) => (
                <motion.span key={item} variants={itemRevealVariants}>
                  <Check size={14} aria-hidden="true" />
                  {item}
                </motion.span>
              ))}
            </div>
            <div className="worker-perk-grid">
              {workerPerks.map((perk) => (
                <motion.article className="perk-card" key={perk.title} variants={itemRevealVariants}>
                  <div className="perk-icon">{perk.icon}</div>
                  <div>
                    <div className="perk-title">{perk.title}</div>
                    <div className="perk-desc">{perk.copy}</div>
                  </div>
                </motion.article>
              ))}
            </div>
            <a className="btn-primary worker-cta" href="#signup">
              Join the Waitlist →
            </a>
          </motion.div>
        </motion.div>
      </RevealSection>

      <RevealSection className="signup" id="signup">
        <motion.div className="signup-inner" variants={sectionRevealVariants}>
          <motion.div className="signup-copy" variants={itemRevealVariants}>
            <div className="section-label">Be first in line</div>
            <h2>Join the MedShift Waitlist</h2>
            <p className="section-sub">
              Alberta launch access is opening in waves. Tell us where you fit and we will send the right next steps to
              your inbox.
            </p>
            <div className="signup-highlights" aria-label="Waitlist benefits">
              <motion.div variants={itemRevealVariants}>
                <Clock size={18} aria-hidden="true" />
                <span>Launch alerts</span>
              </motion.div>
              <motion.div variants={itemRevealVariants}>
                <MapPin size={18} aria-hidden="true" />
                <span>Alberta first</span>
              </motion.div>
              <motion.div variants={itemRevealVariants}>
                <Calendar size={18} aria-hidden="true" />
                <span>Early access</span>
              </motion.div>
            </div>
          </motion.div>

          <motion.div className="signup-card" variants={itemRevealVariants}>
            <div className="signup-card-header">
              <span>Choose your waitlist</span>
              <strong>{waitlistOption.title}</strong>
              <p>{waitlistOption.copy}</p>
            </div>
            <div className="signup-tabs" aria-label="Waitlist type">
              {(["worker", "facility"] as const).map((type) => (
                <button
                  aria-pressed={signupType === type}
                  className={`tab ${signupType === type ? "active" : ""}`}
                  key={type}
                  type="button"
                  onClick={() => setSignupType(type)}
                >
                  <span className="tab-icon" aria-hidden="true">{waitlistOptions[type].icon}</span>
                  <span>
                    <strong>{waitlistOptions[type].title}</strong>
                    <small>{type === "worker" ? "Find flexible shifts" : "Fill staffing gaps"}</small>
                  </span>
                </button>
              ))}
            </div>
            <form
              aria-busy={isSubmittingWaitlist}
              className="signup-form"
              onSubmit={handleSignup}
            >
              <div className="signup-field-group">
                {signupType === "worker" ? (
                  <>
                    <label>
                      <span>Name</span>
                      <input
                        autoComplete="name"
                        disabled={isSubmittingWaitlist}
                        maxLength={100}
                        name="fullName"
                        onChange={(event) =>
                          setWorkerDetails((current) => ({ ...current, fullName: event.target.value }))
                        }
                        placeholder="Sarah Johnson"
                        required
                        type="text"
                        value={workerDetails.fullName}
                      />
                    </label>
                    <label>
                      <span>Email</span>
                      <input
                        autoComplete="email"
                        disabled={isSubmittingWaitlist}
                        maxLength={254}
                        name="email"
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder={waitlistOption.placeholder}
                        required
                        type="email"
                        value={email}
                      />
                    </label>
                    <label>
                      <span>Phone number</span>
                      <input
                        autoComplete="tel"
                        disabled={isSubmittingWaitlist}
                        maxLength={30}
                        name="workerPhone"
                        onChange={(event) => setWorkerDetails((current) => ({ ...current, phone: event.target.value }))}
                        placeholder="(403) 555-0198"
                        required
                        type="tel"
                        value={workerDetails.phone}
                      />
                    </label>
                    <label>
                      <span>Professional role</span>
                      <select
                        disabled={isSubmittingWaitlist}
                        name="clinicalRole"
                        onChange={(event) =>
                          setWorkerDetails((current) => ({
                            ...current,
                            clinicalRole: event.target.value as WaitlistProfessionalRole
                          }))
                        }
                        value={workerDetails.clinicalRole}
                      >
                        {professionalRoleOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>City</span>
                      <input
                        autoComplete="address-level2"
                        disabled={isSubmittingWaitlist}
                        maxLength={80}
                        name="workerCity"
                        onChange={(event) => setWorkerDetails((current) => ({ ...current, city: event.target.value }))}
                        placeholder="Calgary"
                        required
                        type="text"
                        value={workerDetails.city}
                      />
                    </label>
                    <label>
                      <span>Preferred shift</span>
                      <select
                        disabled={isSubmittingWaitlist}
                        name="availability"
                        onChange={(event) =>
                          setWorkerDetails((current) => ({
                            ...current,
                            availability: event.target.value as WaitlistAvailability
                          }))
                        }
                        value={workerDetails.availability}
                      >
                        {availabilityOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                ) : (
                  <>
                    <label>
                      <span>Facility name</span>
                      <input
                        autoComplete="organization"
                        disabled={isSubmittingWaitlist}
                        maxLength={120}
                        name="facilityName"
                        onChange={(event) =>
                          setFacilityDetails((current) => ({ ...current, facilityName: event.target.value }))
                        }
                        placeholder="Cedar Ridge Care"
                        required
                        type="text"
                        value={facilityDetails.facilityName}
                      />
                    </label>
                    <label>
                      <span>Work email</span>
                      <input
                        autoComplete="email"
                        disabled={isSubmittingWaitlist}
                        maxLength={254}
                        name="email"
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder={waitlistOption.placeholder}
                        required
                        type="email"
                        value={email}
                      />
                    </label>
                    <label>
                      <span>Phone number</span>
                      <input
                        autoComplete="tel"
                        disabled={isSubmittingWaitlist}
                        maxLength={30}
                        name="facilityPhone"
                        onChange={(event) => setFacilityDetails((current) => ({ ...current, phone: event.target.value }))}
                        placeholder="(403) 555-0142"
                        required
                        type="tel"
                        value={facilityDetails.phone}
                      />
                    </label>
                    <label>
                      <span>Facility type</span>
                      <select
                        disabled={isSubmittingWaitlist}
                        name="facilityType"
                        onChange={(event) =>
                          setFacilityDetails((current) => ({
                            ...current,
                            facilityType: event.target.value as FacilityType
                          }))
                        }
                        value={facilityDetails.facilityType}
                      >
                        {facilityTypeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>City</span>
                      <input
                        autoComplete="address-level2"
                        disabled={isSubmittingWaitlist}
                        maxLength={80}
                        name="facilityCity"
                        onChange={(event) => setFacilityDetails((current) => ({ ...current, city: event.target.value }))}
                        placeholder="Calgary"
                        required
                        type="text"
                        value={facilityDetails.city}
                      />
                    </label>
                    <label>
                      <span>Province</span>
                      <input
                        autoComplete="address-level1"
                        disabled={isSubmittingWaitlist}
                        maxLength={40}
                        name="facilityProvince"
                        onChange={(event) => setFacilityDetails((current) => ({ ...current, province: event.target.value }))}
                        placeholder="Alberta"
                        required
                        type="text"
                        value={facilityDetails.province}
                      />
                    </label>
                  </>
                )}
              </div>
              <button className="btn-primary" disabled={isSubmittingWaitlist} type="submit">
                {isSubmittingWaitlist ? "Sending..." : waitlistOption.cta}
              </button>
            </form>
            <div className="signup-points" aria-label={`${waitlistOption.title} waitlist includes`}>
              {waitlistOption.points.map((point) => (
                <span key={point}>
                  <Check size={14} aria-hidden="true" />
                  {point}
                </span>
              ))}
            </div>
            <p className="signup-note">No spam. Confirmation email sent after signup.</p>
            {message ? (
              <p className={`signup-message ${messageTone}`} role={messageTone === "error" ? "alert" : "status"}>
                {message}
              </p>
            ) : null}
          </motion.div>
        </motion.div>
      </RevealSection>

      <RevealSection className="values">
        <motion.div className="values-inner" variants={sectionRevealVariants}>
          <motion.div className="section-label" variants={itemRevealVariants}>What we stand for</motion.div>
          <motion.h2 variants={itemRevealVariants}>Built on values that matter in healthcare</motion.h2>
          <motion.div className="values-grid" variants={sectionRevealVariants}>
            {values.map(([icon, title, copy]) => (
              <motion.article className="value-card" key={title} variants={itemRevealVariants}>
                <div className="value-icon">{icon}</div>
                <div className="value-title">{title}</div>
                <div className="value-desc">{copy}</div>
              </motion.article>
            ))}
          </motion.div>
        </motion.div>
      </RevealSection>

      <footer className="marketing-footer">
        <div>
          <div className="footer-logo-row">
            <MedShiftLogo />
          </div>
          <div className="footer-tag">The right care. Right when it matters.</div>
        </div>
        <div className="footer-links">
          <a href="#how">How It Works</a>
          <a href="#workers">For Workers</a>
          <a href="#facilities">For Facilities</a>
          <a href="mailto:hello@medshift.ca">Contact</a>
        </div>
        <div className="footer-copy">© 2026 MedShift. All rights reserved.</div>
      </footer>
    </main>
  );
}

function RevealSection({
  children,
  className,
  id,
  variants = sectionRevealVariants
}: {
  children: ReactNode;
  className: string;
  id?: string;
  variants?: Variants;
}) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.section
      className={className}
      id={id}
      initial={shouldReduceMotion ? false : "hidden"}
      variants={variants}
      viewport={{ once: true, amount: 0.22, margin: "0px 0px -12% 0px" }}
      whileInView="show"
    >
      {children}
    </motion.section>
  );
}

function ShiftDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="shift-detail">
      <div className="shift-label">{label}</div>
      <div className="shift-value">{value}</div>
    </div>
  );
}

function DotIcon() {
  return (
    <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" aria-hidden="true">
      <circle cx="4" cy="4" r="4" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

function DollarIcon() {
  return (
    <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function NetworkIcon() {
  return (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="6" cy="7" r="3" />
      <circle cx="18" cy="7" r="3" />
      <circle cx="12" cy="17" r="3" />
      <path d="M8.6 9.1l2 4.1M15.4 9.1l-2 4.1M9 7h6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function resetWaitlistDetails(
  signupType: SignupType,
  setWorkerDetails: (details: WorkerWaitlistDetails) => void,
  setFacilityDetails: (details: FacilityWaitlistDetails) => void
) {
  if (signupType === "worker") {
    setWorkerDetails({
      availability: WaitlistAvailability.Flexible,
      city: "",
      clinicalRole: WaitlistProfessionalRole.HealthcareAide,
      fullName: "",
      phone: ""
    });
    return;
  }

  setFacilityDetails({
    city: "",
    facilityName: "",
    facilityType: FacilityType.LongTermCare,
    phone: "",
    province: ""
  });
}

function formatWaitlistError(result: WaitlistResponse) {
  if (result.code === "WAITLIST_EMAIL_NOT_SENT") {
    return result.message ?? "You're on the waitlist. We could not send the confirmation email yet.";
  }

  if (typeof result.message === "string" && result.message.length > 0) {
    return result.message;
  }

  return "Unable to join the waitlist right now. Please try again.";
}

function getDashboardHref(role?: UserRole) {
  if (role === UserRole.Facility) {
    return "/facility";
  }

  if (role === UserRole.Admin) {
    return process.env.NEXT_PUBLIC_ADMIN_URL ?? "http://localhost:3001";
  }

  return "/worker";
}

function getUserInitials(email?: string) {
  if (!email) {
    return "MS";
  }

  return email
    .split("@")[0]
    .split(/[._-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "MS";
}

function formatRole(role: UserRole) {
  return role.charAt(0) + role.slice(1).toLowerCase();
}

function readUserFromToken(accessToken: string): StoredAuthUser | null {
  try {
    const payload = JSON.parse(decodeBase64Url(accessToken.split(".")[1] ?? "")) as Partial<StoredAuthUser>;

    if (!payload.email || !isKnownRole(payload.role)) {
      return null;
    }

    return {
      email: payload.email,
      role: payload.role
    };
  } catch {
    return null;
  }
}

function isKnownRole(role: unknown): role is UserRole {
  return role === UserRole.Worker || role === UserRole.Facility || role === UserRole.Admin;
}

function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return window.atob(base64);
}
