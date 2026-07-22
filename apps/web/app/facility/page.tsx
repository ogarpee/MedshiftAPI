"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ClinicalRole, ShiftMetrics, ShiftStatus, ShiftSummary } from "@medshift/shared-types";
import { DashboardShell, StatusBadge } from "@medshift/ui-components";

const demoShifts: ShiftSummary[] = [
  {
    id: "demo-1",
    facilityId: "demo-facility",
    roleRequired: ClinicalRole.Hca,
    startTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    endTime: new Date(Date.now() + 11 * 60 * 60 * 1000).toISOString(),
    hourlyRate: 34,
    status: ShiftStatus.Open,
    location: { type: "Point", coordinates: [-114.0719, 51.0447] },
    description: "Memory care wing coverage"
  },
  {
    id: "demo-2",
    facilityId: "demo-facility",
    roleRequired: ClinicalRole.Rn,
    startTime: new Date(Date.now() + 30 * 60 * 60 * 1000).toISOString(),
    endTime: new Date(Date.now() + 38 * 60 * 60 * 1000).toISOString(),
    hourlyRate: 52,
    status: ShiftStatus.Matched,
    location: { type: "Point", coordinates: [-114.0719, 51.0447] },
    description: "Evening medication pass"
  },
  {
    id: "demo-3",
    facilityId: "demo-facility",
    roleRequired: ClinicalRole.Lpn,
    startTime: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    endTime: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
    hourlyRate: 44,
    status: ShiftStatus.Completed,
    location: { type: "Point", coordinates: [-114.0719, 51.0447] },
    description: "Post-shift review ready"
  }
];

export default function FacilityDashboardPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [shifts, setShifts] = useState<ShiftSummary[]>(demoShifts);
  const [message, setMessage] = useState("");
  const [roleRequired, setRoleRequired] = useState<ClinicalRole>(ClinicalRole.Hca);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [hourlyRate, setHourlyRate] = useState("36");
  const [description, setDescription] = useState("");
  const [reviewRatings, setReviewRatings] = useState<Record<string, number>>({});
  const [reviewComments, setReviewComments] = useState<Record<string, string>>({});

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

  const metrics: ShiftMetrics = useMemo(() => {
    const now = Date.now();
    const activeStatuses = new Set<ShiftStatus>([ShiftStatus.Open, ShiftStatus.Matched, ShiftStatus.InProgress]);

    return {
      activeShifts: shifts.filter((shift) => activeStatuses.has(shift.status)).length,
      upcomingShifts: shifts.filter((shift) => new Date(shift.startTime).getTime() > now).length,
      completedShifts: shifts.filter((shift) => shift.status === ShiftStatus.Completed).length,
      averageFillTimeMinutes: null
    };
  }, [shifts]);

  useEffect(() => {
    const token = window.localStorage.getItem("medshift.accessToken");

    if (!token) {
      return;
    }

    fetch(`${apiUrl}/facility-profiles/onboarding-status`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((status: { completed?: boolean }) => {
        if (!status.completed) {
          window.location.assign("/facility/onboarding");
          return Promise.reject();
        }

        return fetch(`${apiUrl}/shifts`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((result: ShiftSummary[]) => setShifts(result))
      .catch(() => setMessage("Showing dashboard preview until your facility profile is connected."));
  }, [apiUrl]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedDescription = description.trim();
    const startTimestamp = new Date(startTime).getTime();
    const endTimestamp = new Date(endTime).getTime();
    const rate = Number(hourlyRate);

    if (!startTime || Number.isNaN(startTimestamp)) {
      setMessage("Choose a valid shift start date and time.");
      return;
    }

    if (!endTime || Number.isNaN(endTimestamp)) {
      setMessage("Choose a valid shift end date and time.");
      return;
    }

    if (endTimestamp <= startTimestamp) {
      setMessage("Shift end time must be after the start time.");
      return;
    }

    if (!Number.isFinite(rate) || rate <= 0) {
      setMessage("Enter a valid hourly rate greater than 0.");
      return;
    }

    if (trimmedDescription.length < 12) {
      setMessage("Add a shift description with at least 12 characters.");
      return;
    }

    const draftShift: ShiftSummary = {
      id: `draft-${Date.now()}`,
      facilityId: "current-facility",
      roleRequired,
      startTime: new Date(startTimestamp).toISOString(),
      endTime: new Date(endTimestamp).toISOString(),
      hourlyRate: rate,
      status: ShiftStatus.Open,
      location: { type: "Point", coordinates: [-114.0719, 51.0447] },
      description: trimmedDescription
    };

    const token = window.localStorage.getItem("medshift.accessToken");

    if (token) {
      const response = await fetch(`${apiUrl}/shifts`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          roleRequired,
          startTime: draftShift.startTime,
          endTime: draftShift.endTime,
          hourlyRate: draftShift.hourlyRate,
          location: draftShift.location,
          description: trimmedDescription
        })
      });

      if (response.ok) {
        const savedShift = (await response.json()) as ShiftSummary;
        setShifts((current) => [savedShift, ...current]);
        setMessage("Shift published to your facility board.");
      } else {
        setShifts((current) => [draftShift, ...current]);
        setMessage("Saved as a local preview. Complete facility setup to publish.");
      }
    } else {
      setShifts((current) => [draftShift, ...current]);
      setMessage("Saved as a local preview. Sign in to publish to the network.");
    }

    setIsModalOpen(false);
    setDescription("");
  }

  async function submitReview(shift: ShiftSummary) {
    const rating = reviewRatings[shift.id] ?? 5;
    const comment = (reviewComments[shift.id] ?? "").trim();
    const token = window.localStorage.getItem("medshift.accessToken");

    if (!token || shift.id.startsWith("demo-")) {
      setMessage(`Preview review submitted with ${rating} stars.`);
      return;
    }

    const response = await fetch(`${apiUrl}/reviews/shifts/${shift.id}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ rating, comment })
    });

    setMessage(response.ok ? "Worker review submitted." : "Review could not be submitted for this shift.");
  }

  return (
    <DashboardShell
      actions={
        <button className="button-primary" type="button" onClick={() => setIsModalOpen(true)}>
          Post shift
        </button>
      }
      className="facility-page"
      eyebrow={<StatusBadge tone="navy">Facility roster</StatusBadge>}
      navItems={[
        { label: "Roster", href: "/facility", active: true },
        { label: "Onboarding", href: "/facility/onboarding" },
        { label: "Post shifts", href: "/facility#post-shift" },
        { label: "Reviews", href: "/facility#reviews" },
        { label: "Worker portal", href: "/worker" }
      ]}
      title="Shift command centre"
      userLabel="Facility workspace"
    >
      <section className="facility-shell">
        <header className="facility-header">
          <div>
            <h2>Coverage overview</h2>
            <p>Track active shifts, fill status, and completed shift reviews.</p>
          </div>
        </header>

        <section className="facility-metrics" aria-label="Dashboard metrics">
          <article>
            <span>Average fill time</span>
            <strong>{metrics.averageFillTimeMinutes ? `${metrics.averageFillTimeMinutes}m` : "< 2h goal"}</strong>
          </article>
          <article>
            <span>Active shifts</span>
            <strong>{metrics.activeShifts}</strong>
          </article>
          <article>
            <span>Upcoming shifts</span>
            <strong>{metrics.upcomingShifts}</strong>
          </article>
        </section>

        {message ? <p className="facility-message">{message}</p> : null}

        <section className="facility-board">
          <div className="facility-board-heading">
            <h2>Active and upcoming shifts</h2>
            <StatusBadge tone="green">{metrics.activeShifts} active</StatusBadge>
          </div>
          <div className="facility-shift-list">
            {shifts.map((shift) => (
              <article className="facility-shift-row" key={shift.id}>
                <div>
                  <h3>{shift.roleRequired}</h3>
                  <p>{formatWindow(shift.startTime, shift.endTime)}</p>
                  <span>{shift.description}</span>
                </div>
                <div className="facility-shift-status">
                  <StatusBadge tone={shift.status === ShiftStatus.Open ? "gold" : "green"}>{shift.status}</StatusBadge>
                  <strong>${shift.hourlyRate}/hr</strong>
                </div>
                {shift.status === ShiftStatus.Completed ? (
                  <form className="review-inline-form" onSubmit={(event) => { event.preventDefault(); void submitReview(shift); }}>
                    <div className="star-row" aria-label="Worker rating">
                      {[1, 2, 3, 4, 5].map((rating) => (
                        <button
                          className={(reviewRatings[shift.id] ?? 5) >= rating ? "active" : ""}
                          key={rating}
                          type="button"
                          onClick={() => setReviewRatings((current) => ({ ...current, [shift.id]: rating }))}
                          aria-label={`${rating} star rating`}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                    <input
                      maxLength={280}
                      name={`review-${shift.id}`}
                      value={reviewComments[shift.id] ?? ""}
                      onChange={(event) => setReviewComments((current) => ({ ...current, [shift.id]: event.target.value }))}
                      placeholder="Add worker feedback"
                    />
                    <button type="submit">Submit review</button>
                  </form>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      </section>

      {isModalOpen ? (
        <div className="modal-backdrop" role="presentation">
          <section className="post-shift-modal" id="post-shift" role="dialog" aria-modal="true" aria-labelledby="post-shift-title">
            <div className="modal-heading">
              <h2 id="post-shift-title">Post a shift</h2>
              <button type="button" onClick={() => setIsModalOpen(false)} aria-label="Close post shift modal">
                ×
              </button>
            </div>
            <form className="post-shift-form" onSubmit={handleSubmit}>
              <label>
                Role
                <select
                  aria-label="Clinical role"
                  name="roleRequired"
                  required
                  value={roleRequired}
                  onChange={(event) => setRoleRequired(event.target.value as ClinicalRole)}
                >
                  <option value={ClinicalRole.Hca}>HCA</option>
                  <option value={ClinicalRole.Rn}>RN</option>
                  <option value={ClinicalRole.Lpn}>LPN</option>
                  <option value={ClinicalRole.Psw}>PSW</option>
                </select>
              </label>
              <label>
                Start
                <input
                  name="startTime"
                  onChange={(event) => setStartTime(event.target.value)}
                  placeholder="Select start date and time"
                  required
                  type="datetime-local"
                  value={startTime}
                />
              </label>
              <label>
                End
                <input
                  name="endTime"
                  onChange={(event) => setEndTime(event.target.value)}
                  placeholder="Select end date and time"
                  required
                  type="datetime-local"
                  value={endTime}
                />
              </label>
              <label>
                Hourly rate
                <input
                  inputMode="decimal"
                  max="250"
                  min="1"
                  name="hourlyRate"
                  onChange={(event) => setHourlyRate(event.target.value)}
                  placeholder="45.00"
                  required
                  step="0.01"
                  type="number"
                  value={hourlyRate}
                />
              </label>
              <label className="wide-field">
                Description
                <textarea
                  maxLength={240}
                  minLength={12}
                  name="description"
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Describe the unit, responsibilities, and shift notes"
                  required
                  rows={3}
                  value={description}
                />
              </label>
              <button className="auth-submit wide-field" type="submit">Publish to network</button>
            </form>
          </section>
        </div>
      ) : null}
    </DashboardShell>
  );
}

function formatWindow(startTime: string, endTime: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });

  return `${formatter.format(new Date(startTime))} - ${formatter.format(new Date(endTime))}`;
}
