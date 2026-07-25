"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ClinicalRole, ShiftMetrics, ShiftStatus, ShiftSummary } from "@medshift/shared-types";
import { DashboardShell, StatusBadge } from "@medshift/ui-components";
import {
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileCheck,
  MapPin,
  Plus,
  ShieldCheck,
  Star,
  Timer,
  Users,
  X
} from "lucide-react";

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

const coverageOverview = [
  { month: "Jan", completed: 46, total: 62 },
  { month: "Feb", completed: 58, total: 72 },
  { month: "Mar", completed: 51, total: 66 },
  { month: "Apr", completed: 74, total: 92 },
  { month: "May", completed: 62, total: 78 },
  { month: "Jun", completed: 84, total: 96 },
  { month: "Jul", completed: 55, total: 70 },
  { month: "Aug", completed: 0, total: 0 },
  { month: "Sep", completed: 0, total: 0 },
  { month: "Oct", completed: 0, total: 0 },
  { month: "Nov", completed: 0, total: 0 },
  { month: "Dec", completed: 0, total: 0 }
];

const weekDays = [
  { label: "SUN", day: 5 },
  { label: "MON", day: 6 },
  { label: "TUE", day: 7 },
  { label: "WED", day: 8, active: true },
  { label: "THU", day: 9 },
  { label: "FRI", day: 10 },
  { label: "SAT", day: 11 }
];

const staffingTimeline = [
  { time: "7 AM - 3 PM", title: "HCA shift posted", detail: "Memory care wing", icon: Calendar },
  { time: "3 PM", title: "RN match pending", detail: "Medication pass", icon: Clock },
  { time: "11 PM - 7 AM", title: "Night coverage", detail: "Awaiting acceptance", icon: ShieldCheck }
];

const workerReviews = [
  { name: "Sarah Johnson", role: "HCA", rating: "4.9" },
  { name: "Daniel Mensah", role: "RN", rating: "4.8" },
  { name: "Priya Shah", role: "LPN", rating: "5.0" }
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
      <section className="facility-shell facility-dashboard-refresh">
        <section className="worker-metric-strip facility-metric-strip" aria-label="Facility metrics">
          <MetricPill icon={<Timer aria-hidden="true" />} label="Average fill time" value={metrics.averageFillTimeMinutes ? `${metrics.averageFillTimeMinutes}m` : "<2h"} trend="+12%" />
          <MetricPill icon={<Users aria-hidden="true" />} label="Active shifts" value={String(metrics.activeShifts)} trend="+5%" />
          <MetricPill icon={<Calendar aria-hidden="true" />} label="Upcoming shifts" value={String(metrics.upcomingShifts)} />
          <MetricPill icon={<FileCheck aria-hidden="true" />} label="Completed" value={String(metrics.completedShifts)} trend="+8%" />
        </section>

        {message ? <p className="facility-message">{message}</p> : null}

        <section className="worker-dashboard-grid facility-dashboard-grid">
          <div className="worker-dashboard-main-column">
            <section className="work-overview-card facility-coverage-card" aria-label="Coverage overview">
              <div className="work-overview-heading">
                <div>
                  <h2>Coverage overview</h2>
                  <p>Last year <span>+12%</span></p>
                </div>
                <button className="soft-select-button" type="button">Year</button>
              </div>
              <div className="work-chart" aria-label="Filled shifts by month">
                <div className="work-chart-scale" aria-hidden="true">
                  <span>100</span>
                  <span>75</span>
                  <span>50</span>
                  <span>25</span>
                  <span>0</span>
                </div>
                <div className="work-chart-bars">
                  {coverageOverview.map((month) => (
                    <div className="work-chart-month" key={month.month}>
                      <div className="work-bar-track" aria-hidden="true">
                        {month.total ? <span style={{ height: `${month.total}%` }} /> : null}
                        {month.completed ? <strong style={{ height: `${month.completed}%` }} /> : null}
                      </div>
                      <span>{month.month}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="worker-section-heading">
              <h2>Shift requests</h2>
              <button type="button">View all</button>
            </section>

            <section className="worker-request-grid facility-request-grid" aria-label="Active and upcoming shifts">
              {shifts.slice(0, 2).map((shift) => (
                <article className="worker-request-card facility-request-card" key={shift.id}>
                  <div className="request-card-top">
                    <div className="request-avatar">{shift.roleRequired}</div>
                    <div>
                      <h3>{formatRoleLabel(shift.roleRequired)} coverage</h3>
                      <span>{shift.status === ShiftStatus.Open ? "Open for matching" : formatStatusLabel(shift.status)}</span>
                    </div>
                    <div className="request-actions">
                      <button aria-label="Cancel local request" type="button"><X aria-hidden="true" /></button>
                      <button aria-label="Review request" type="button"><Check aria-hidden="true" /></button>
                    </div>
                  </div>
                  <div className="request-meta">
                    <span><Calendar aria-hidden="true" /> {formatShortDate(shift.startTime)}</span>
                    <span><Clock aria-hidden="true" /> {formatTimeRange(shift.startTime, shift.endTime)}</span>
                  </div>
                  <div className="request-footer">
                    <span><MapPin aria-hidden="true" /> Calgary, AB</span>
                    <strong>${calculateShiftCost(shift)} <small>/{calculateShiftHours(shift)} hr</small></strong>
                  </div>
                </article>
              ))}
            </section>

            <section className="worker-section-heading" id="reviews">
              <h2>Worker reviews</h2>
              <button type="button">View all</button>
            </section>

            <section className="worker-review-card-grid" aria-label="Worker reviews">
              {workerReviews.map((review) => (
                <article className="facility-review-card" key={review.name}>
                  <div className="request-avatar">{getWorkerInitials(review.name)}</div>
                  <div>
                    <h3>{review.name}</h3>
                    <span>{review.role}</span>
                  </div>
                  <strong><Star aria-hidden="true" /> {review.rating}</strong>
                </article>
              ))}
            </section>

            <section className="facility-board facility-open-board">
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
          </div>

          <aside className="worker-dashboard-side-column facility-dashboard-side-column" aria-label="Facility schedule and readiness">
            <section className="pay-summary-grid facility-summary-grid">
              <SummaryTile icon={<Plus aria-hidden="true" />} label="Open needs" value={String(metrics.activeShifts)} hint="Live requests" featured />
              <SummaryTile icon={<ShieldCheck aria-hidden="true" />} label="Verified pool" value="100%" hint="Credential checked" />
              <SummaryTile icon={<Clock aria-hidden="true" />} label="Pending matches" value="3" hint="Awaiting acceptance" />
              <SummaryTile icon={<Star aria-hidden="true" />} label="Facility rating" value="4.8" hint="Current average" />
            </section>

            <section className="schedule-card" aria-label="April 2026 roster calendar">
              <div className="schedule-heading">
                <button aria-label="Previous week" type="button"><ChevronLeft aria-hidden="true" /></button>
                <h2>April 2026</h2>
                <button aria-label="Next week" type="button"><ChevronRight aria-hidden="true" /></button>
              </div>
              <div className="schedule-days">
                {weekDays.map((day) => (
                  <div className={day.active ? "active" : ""} key={day.label}>
                    <span>{day.label}</span>
                    <strong>{day.day}</strong>
                  </div>
                ))}
              </div>
            </section>

            <section className="schedule-timeline facility-timeline" aria-label="Daily roster timeline">
              {staffingTimeline.map((slot) => {
                const Icon = slot.icon;

                return (
                  <article key={`${slot.time}-${slot.title}`}>
                    <time>{slot.time}</time>
                    <div>
                      <span><Icon aria-hidden="true" /></span>
                      <div>
                        <h3>{slot.title}</h3>
                        <p>{slot.detail}</p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>

            <section className="facility-availability-card">
              <div>
                <h2>Ready to post</h2>
                <button type="button">View all</button>
              </div>
              <p>$36/hr starting rate</p>
              <div>
                <span><Check aria-hidden="true" /> Emergency coverage</span>
                <span><Check aria-hidden="true" /> Evening</span>
                <span><Check aria-hidden="true" /> Night</span>
              </div>
              <button className="auth-submit" type="button" onClick={() => setIsModalOpen(true)}>
                Post shift
              </button>
            </section>
          </aside>
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

function MetricPill({
  icon,
  label,
  trend,
  value
}: {
  icon: ReactNode;
  label: string;
  trend?: string;
  value: string;
}) {
  return (
    <article className="metric-pill">
      <span>{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
      {trend ? <em>{trend}</em> : null}
    </article>
  );
}

function SummaryTile({
  featured,
  hint,
  icon,
  label,
  value
}: {
  featured?: boolean;
  hint: string;
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <article className={featured ? "pay-tile featured" : "pay-tile"}>
      <div>
        <span>{icon}</span>
        <div>
          <small>{label}</small>
          <strong>{value}</strong>
                </div>
      </div>
      <p>{hint}</p>
    </article>
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

function formatShortDate(date: string) {
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric"
  }).format(new Date(date));
}

function formatTimeRange(startTime: string, endTime: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    hour: "numeric",
    minute: "2-digit"
  });

  return `${formatter.format(new Date(startTime))}-${formatter.format(new Date(endTime))}`;
}

function calculateShiftHours(shift: ShiftSummary) {
  const hours = (new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime()) / 3_600_000;
  return Math.max(1, Math.round(hours));
}

function calculateShiftCost(shift: ShiftSummary) {
  return calculateShiftHours(shift) * shift.hourlyRate;
}

function formatRoleLabel(role: ClinicalRole) {
  return role;
}

function formatStatusLabel(status: ShiftStatus) {
  return status.toLowerCase().replace(/_/g, " ");
}

function getWorkerInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
