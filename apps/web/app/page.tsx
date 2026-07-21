"use client";

import { useState } from "react";

type SignupType = "worker" | "facility";

const steps = [
  {
    title: "Post or Browse",
    copy: "Facilities post open shifts in minutes. Workers browse available opportunities in their area and specialty."
  },
  {
    title: "Get Matched",
    copy: "MedShift surfaces the right fit - verified credentials, proximity, and availability - instantly."
  },
  {
    title: "Shift Filled",
    copy: "Confirm, show up, deliver care. Facilities get the coverage they need."
  }
];

const facilityFeatures = [
  {
    title: "Fill urgent gaps in hours, not days",
    copy: "Post a shift and have a qualified professional confirmed the same day.",
    icon: <BoltIcon />
  },
  {
    title: "Verified, credentialed professionals",
    copy: "Every worker is background-checked and credential-verified before they ever appear in your results.",
    icon: <ShieldIcon />
  },
  {
    title: "No agency markups",
    copy: "Transparent pricing. Pay workers directly through the platform - no middlemen, no surprises.",
    icon: <DollarIcon />
  }
];

const workerPerks = [
  {
    title: "You choose your schedule",
    copy: "Browse available shifts in your area and pick what works for you. No minimums, no obligations.",
    icon: <CalendarIcon />
  },
  {
    title: "Get paid",
    copy: "Finish your shift, get paid. No waiting weeks for a paycheque.",
    icon: <DollarIcon />
  },
  {
    title: "Work where you want",
    copy: "Filter by location, facility type, and shift length. Find opportunities near you.",
    icon: <PinIcon />
  },
  {
    title: "Build your reputation",
    copy: "Earn ratings, get repeat requests from facilities you love, and grow your network.",
    icon: <ShieldIcon />
  }
];

const stats = [
  ["<2h", "Average shift fill time"],
  ["100%", "Credential verified"],
  ["0", "Agency markups"],
  ["24/7", "Platform availability"]
];

const values = [
  ["🤝", "Compassion", "Every shift we fill improves patient care and a professional's livelihood."],
  ["🛡", "Reliability", "Facilities and workers can count on MedShift to deliver, every time."],
  ["✦", "Integrity", "Transparent pricing, honest matching, no hidden fees or surprises."],
  ["⭐", "Excellence", "We hold professionals and facilities to the highest standard of care."]
];

export default function HomePage() {
  const [signupType, setSignupType] = useState<SignupType>("worker");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  function handleSignup() {
    const trimmedEmail = email.trim();

    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      setMessage("Please enter a valid email address.");
      return;
    }

    setMessage(
      `Thanks for signing up as a ${signupType === "worker" ? "healthcare worker" : "facility"}! We'll be in touch soon.`
    );
    setEmail("");
  }

  return (
    <main className="marketing-page">
      <nav className="marketing-nav">
        <a className="nav-logo" href="#top" aria-label="MedShift home">
          <span>Med</span>Shift
        </a>
        <div className="nav-links">
          <a href="#workers">For Workers</a>
          <a href="#facilities">For Facilities</a>
          <a href="#how">How It Works</a>
          <a href="/login">Login</a>
          <a className="btn-nav" href="#signup">Join Now</a>
        </div>
      </nav>

      <section className="marketing-hero" id="top">
        <div className="hero-inner">
          <div>
            <div className="hero-tag fade-up">
              <DotIcon />
              Now accepting early access
            </div>
            <h1 className="fade-up-2">
              Fill Shifts.
              <br />
              <span className="gold">Change Lives.</span>
            </h1>
            <p className="hero-sub fade-up-3">
              MedShift connects healthcare professionals with facilities that need care - fast, reliable, and on
              demand.
            </p>
            <div className="hero-ctas fade-up-4">
              <a className="btn-primary" href="#workers">
                Find Shifts →
              </a>
              <a className="btn-secondary" href="#facilities">
                Hire Staff
              </a>
            </div>
            <div className="hero-trust fade-up-4">
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
            </div>
          </div>

          <div className="hero-card">
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
            <a className="card-cta" href="/facility">
              View Shift Details
            </a>
          </div>
        </div>

        <div className="hero-line">
          <svg viewBox="0 0 1440 60" preserveAspectRatio="none" fill="none" xmlns="http://www.w3.org/2000/svg">
            <polyline
              points="0,30 200,30 250,30 280,5 310,55 340,30 400,30 450,30 480,15 510,45 540,30 600,30 700,30 730,8 760,52 790,30 900,30 1000,30 1030,18 1060,42 1090,30 1200,30 1440,30"
              stroke="#D4AF37"
              strokeWidth="2"
              fill="none"
            />
          </svg>
        </div>
      </section>

      <section className="how" id="how">
        <div className="how-inner">
          <div className="how-header">
            <div className="section-label">Simple by design</div>
            <h2>How MedShift Works</h2>
            <p className="section-sub">
              Three steps between an open shift and a qualified professional walking through your door.
            </p>
          </div>
          <div className="steps">
            {steps.map((step, index) => (
              <article className="step" key={step.title}>
                <div className="step-num">{index + 1}</div>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="facilities" id="facilities">
        <div className="facilities-inner">
          <div>
            <div className="section-label">For healthcare facilities</div>
            <h2>
              Coverage you can count on.
              <br />
              Without the chaos.
            </h2>
            <p className="section-sub">
              Stop scrambling for last-minute coverage. MedShift gives you a vetted pool of local professionals ready
              to work - on your timeline.
            </p>
            <div className="feature-list">
              {facilityFeatures.map((feature) => (
                <article className="feature-item" key={feature.title}>
                  <div className="feature-icon">{feature.icon}</div>
                  <div>
                    <div className="feature-title">{feature.title}</div>
                    <div className="feature-desc">{feature.copy}</div>
                  </div>
                </article>
              ))}
            </div>
            <a className="btn-primary facility-cta" href="#signup">
              Get Early Access →
            </a>
          </div>
          <div className="stats-grid">
            {stats.map(([number, label]) => (
              <article className="stat-card" key={label}>
                <div className="stat-num">{number}</div>
                <div className="stat-label">{label}</div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="workers" id="workers">
        <div className="workers-inner">
          <div>
            <div className="section-label">For healthcare professionals</div>
            <h2>
              Work on your terms.
              <br />
              Get paid
            </h2>
            <p className="section-sub">
              Your schedule, your choice. Pick up shifts that fit your life - no long-term commitments, no agencies
              taking a cut.
            </p>
            <a className="btn-primary worker-cta" href="#signup">
              Join the Waitlist →
            </a>
          </div>
          <div>
            {workerPerks.map((perk) => (
              <article className="perk-card" key={perk.title}>
                <div className="perk-icon">{perk.icon}</div>
                <div>
                  <div className="perk-title">{perk.title}</div>
                  <div className="perk-desc">{perk.copy}</div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="signup" id="signup">
        <div className="signup-inner">
          <div className="section-label">Be first in line</div>
          <h2>Join the MedShift Waitlist</h2>
          <p className="section-sub">
            We're launching in Alberta first. Sign up and we'll notify you the moment your region goes live.
          </p>
          <div className="signup-tabs" aria-label="Waitlist type">
            <button
              className={`tab ${signupType === "worker" ? "active" : ""}`}
              type="button"
              onClick={() => setSignupType("worker")}
            >
              I'm a Healthcare Worker
            </button>
            <button
              className={`tab ${signupType === "facility" ? "active" : ""}`}
              type="button"
              onClick={() => setSignupType("facility")}
            >
              I'm a Facility
            </button>
          </div>
          <form
            className="signup-form"
            onSubmit={(event) => {
              event.preventDefault();
              handleSignup();
            }}
          >
            <input
              aria-label="Email address"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={signupType === "worker" ? "Enter your email address" : "Enter your work email"}
            />
            <button className="btn-primary" type="submit">
              Get Early Access →
            </button>
          </form>
          <p className="signup-note">No spam. Unsubscribe anytime. 🔒</p>
          {message ? <p className="signup-message">{message}</p> : null}
        </div>
      </section>

      <section className="values">
        <div className="values-inner">
          <div className="section-label">What we stand for</div>
          <h2>Built on values that matter in healthcare</h2>
          <div className="values-grid">
            {values.map(([icon, title, copy]) => (
              <article className="value-card" key={title}>
                <div className="value-icon">{icon}</div>
                <div className="value-title">{title}</div>
                <div className="value-desc">{copy}</div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="marketing-footer">
        <div>
          <div className="footer-logo-row">
            <div className="footer-brand">
              <span>Med</span>Shift
            </div>
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

function PinIcon() {
  return (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
