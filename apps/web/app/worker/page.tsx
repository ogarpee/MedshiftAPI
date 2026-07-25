"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ClinicalRole, FacilityType, GeoPoint, MatchedShiftSummary, OnboardingStatus, ShiftStatus } from "@medshift/shared-types";
import { DashboardShell, StatusBadge } from "@medshift/ui-components";
import { Calendar, Check, ChevronLeft, ChevronRight, Clock, Coins, Hourglass, MapPin, Star, Users, Wallet, X } from "lucide-react";
import type { Socket } from "socket.io-client";
import { ShiftMap } from "./shift-map";

type ViewMode = "list" | "map";
type WorkerOnboardingStatus = {
  completed?: boolean;
  nextStep?: string;
  verificationStatus?: OnboardingStatus;
};

type WorkerProfileResponse = {
  location?: GeoPoint;
  preferences?: {
    maxDistanceKm?: number;
  };
};

const demoShifts: MatchedShiftSummary[] = [
  {
    id: "demo-worker-1",
    facilityId: "demo-facility-1",
    roleRequired: ClinicalRole.Hca,
    startTime: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    endTime: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
    hourlyRate: 34,
    status: ShiftStatus.Open,
    location: { type: "Point", coordinates: [-114.0719, 51.0447] },
    description: "Memory care coverage with a small evening team.",
    distanceKm: 4.8,
    facility: {
      id: "demo-facility-1",
      name: "Bow Valley Care Centre",
      facilityType: FacilityType.LongTermCare,
      address: { city: "Calgary", province: "AB" },
      stats: { averageRating: 4.8 }
    }
  },
  {
    id: "demo-worker-2",
    facilityId: "demo-facility-2",
    roleRequired: ClinicalRole.Rn,
    startTime: new Date(Date.now() + 28 * 60 * 60 * 1000).toISOString(),
    endTime: new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString(),
    hourlyRate: 52,
    status: ShiftStatus.Open,
    location: { type: "Point", coordinates: [-114.095, 51.05] },
    description: "Medication pass and overnight admissions support.",
    distanceKm: 8.2,
    facility: {
      id: "demo-facility-2",
      name: "Prairie North Hospital",
      facilityType: FacilityType.Hospital,
      address: { city: "Calgary", province: "AB" },
      stats: { averageRating: 4.6 }
    }
  },
  {
    id: "demo-worker-3",
    facilityId: "demo-facility-3",
    roleRequired: ClinicalRole.Lpn,
    startTime: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(),
    endTime: new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString(),
    hourlyRate: 44,
    status: ShiftStatus.Completed,
    location: { type: "Point", coordinates: [-114.081, 51.04] },
    description: "Completed evening coverage ready for facility review.",
    distanceKm: 5.4,
    facility: {
      id: "demo-facility-3",
      name: "Foothills Community Clinic",
      facilityType: FacilityType.Clinic,
      address: { city: "Calgary", province: "AB" },
      stats: { averageRating: 4.9 }
    }
  }
];

const workOverview = [
  { month: "Jan", completed: 28, total: 54 },
  { month: "Feb", completed: 49, total: 74 },
  { month: "Mar", completed: 39, total: 68 },
  { month: "Apr", completed: 66, total: 99 },
  { month: "May", completed: 35, total: 66 },
  { month: "Jun", completed: 77, total: 90 },
  { month: "Jul", completed: 28, total: 68 },
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

const scheduleSlots = [
  { time: "10 AM - 1 PM", title: "Confirmed shift", detail: "Bow Valley Care Centre", icon: Calendar },
  { time: "2 PM", title: "Available slot", detail: "Open for matching", icon: Clock },
  { time: "3 PM - 6 PM", title: "Confirmed shift", detail: "Prairie North Hospital", icon: Calendar }
];

const reviewCards = [
  { name: "Bow Valley Care Centre", type: "Long-term care", rating: "4.8" },
  { name: "Prairie North Hospital", type: "Hospital", rating: "4.6" },
  { name: "Foothills Clinic", type: "Community clinic", rating: "4.9" }
];

export default function WorkerDashboardPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedShiftId, setSelectedShiftId] = useState(demoShifts[0]?.id ?? "");
  const [shifts, setShifts] = useState<MatchedShiftSummary[]>(demoShifts);
  const [message, setMessage] = useState("");
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [onboardingStatus, setOnboardingStatus] = useState<WorkerOnboardingStatus | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");

  const selectedShift = useMemo(
    () => shifts.find((shift) => shift.id === selectedShiftId) ?? shifts[0],
    [selectedShiftId, shifts]
  );

  useEffect(() => {
    const token = window.localStorage.getItem("medshift.accessToken");

    if (!token) {
      setMessage("Showing a Calgary preview. Sign in as a worker to browse live matches.");
      return;
    }

    let cancelled = false;

    async function loadWorkerDashboard() {
      setIsLoadingDashboard(true);

      try {
        const statusResponse = await fetch(`${apiUrl}/worker-profiles/onboarding-status`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!statusResponse.ok) {
          throw new Error("Unable to load onboarding status");
        }

        const status = (await statusResponse.json()) as WorkerOnboardingStatus;

        if (cancelled) {
          return;
        }

        setOnboardingStatus(status);

        if (status.verificationStatus !== OnboardingStatus.Approved) {
          setMessage(status.verificationStatus === OnboardingStatus.Incomplete ? "Complete onboarding to unlock live shift matching." : "Your onboarding is under review. Preview shifts are shown until approval.");
        }

        const profileResponse = await fetch(`${apiUrl}/worker-profiles/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        const profile = profileResponse.ok ? ((await profileResponse.json()) as WorkerProfileResponse) : null;
        const [longitude, latitude] = profile?.location?.coordinates ?? [-114.0719, 51.0447];
        const radiusKm = profile?.preferences?.maxDistanceKm ?? 25;
        const query = new URLSearchParams({
          longitude: String(longitude),
          latitude: String(latitude),
          radiusKm: String(radiusKm)
        });
        const shiftsResponse = await fetch(`${apiUrl}/matching/open-shifts?${query.toString()}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!shiftsResponse.ok) {
          throw new Error("Unable to load open shifts");
        }

        const result = (await shiftsResponse.json()) as MatchedShiftSummary[];

        if (!cancelled && result.length) {
          setShifts(result);
          setSelectedShiftId(result[0].id);
          setMessage(status.verificationStatus === OnboardingStatus.Approved ? "Live board connected to your saved radius." : "Previewing live nearby shifts while onboarding is incomplete.");
        }
      } catch {
        if (!cancelled) {
          setMessage("Live worker matching is unavailable, so this board is using preview shifts.");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingDashboard(false);
        }
      }
    }

    void loadWorkerDashboard();

    return () => {
      cancelled = true;
    };
  }, [apiUrl]);

  useEffect(() => {
    let socket: Socket | null = null;
    const token = window.localStorage.getItem("medshift.accessToken");

    if (!token) {
      return undefined;
    }

    import("socket.io-client")
      .then(({ io }) => {
        socket = io(`${apiUrl}/shifts`, { transports: ["websocket"] });
        socket.emit("join.worker", { id: "current-worker" });
        socket.on("shift.created", (shift: MatchedShiftSummary) => {
          setShifts((current) => [shift, ...current.filter((item) => item.id !== shift.id)]);
          setSelectedShiftId((current) => current || shift.id);
          setMessage("New nearby shift posted.");
        });
      })
      .catch(() => {
        setMessage("Realtime updates are unavailable in this environment.");
      });

    return () => {
      socket?.disconnect();
    };
  }, [apiUrl]);

  async function acceptShift(shift: MatchedShiftSummary) {
    const token = window.localStorage.getItem("medshift.accessToken");

    if (!token || shift.id.startsWith("demo-")) {
      setShifts((current) =>
        current.map((item) => (item.id === shift.id ? { ...item, status: ShiftStatus.Matched } : item))
      );
      setMessage("Preview accepted. Sign in as a worker to claim live shifts.");
      return;
    }

    setIsAccepting(true);

    try {
      const response = await fetch(`${apiUrl}/shifts/${shift.id}/accept`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error("Unable to accept shift");
      }

      const accepted = (await response.json()) as MatchedShiftSummary;
      setShifts((current) => current.map((item) => (item.id === accepted.id ? accepted : item)));
      setSelectedShiftId(accepted.id);
      setMessage("Shift accepted. The facility has been notified.");
    } catch {
      setMessage("That shift could not be accepted. It may already be matched.");
    } finally {
      setIsAccepting(false);
    }
  }

  async function submitReview(shift: MatchedShiftSummary) {
    if (reviewComment.trim().length > 280) {
      setMessage("Facility feedback must be 280 characters or fewer.");
      return;
    }

    const token = window.localStorage.getItem("medshift.accessToken");
    const comment = reviewComment.trim();

    if (!token || shift.id.startsWith("demo-")) {
      setMessage(`Preview facility review submitted with ${reviewRating} stars.`);
      setReviewComment("");
      return;
    }

    const response = await fetch(`${apiUrl}/reviews/shifts/${shift.id}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ rating: reviewRating, comment })
    });

    if (response.ok) {
      setMessage("Facility review submitted.");
      setReviewComment("");
      return;
    }

    setMessage("Review could not be submitted for this shift.");
  }

  return (
    <DashboardShell
      className="worker-page"
      eyebrow={<StatusBadge tone="green">Available now</StatusBadge>}
      navItems={[
        { label: "Shift board", href: "/worker", active: true }
      ]}
      title="Shift board"
      userLabel="Worker workspace"
    >
      <section className="worker-shell worker-dashboard-refresh">
        <section className="worker-metric-strip" aria-label="Worker metrics">
          <MetricPill icon={<Calendar aria-hidden="true" />} label="Total shifts" value={String(shifts.length + 24)} trend="+5%" />
          <MetricPill icon={<Clock aria-hidden="true" />} label="Hours worked" value="66h" trend="-2%" tone="danger" />
          <MetricPill icon={<Star aria-hidden="true" />} label="Rating" value="4.8" />
          <MetricPill icon={<Users aria-hidden="true" />} label="Repeat facilities" value="78%" trend="+8%" />
        </section>

        {onboardingStatus?.verificationStatus === OnboardingStatus.Incomplete ? (
          <section className="dashboard-onboarding-banner" aria-label="Complete worker onboarding">
            <div>
              <span>Profile required</span>
              <h3>Complete your onboarding to unlock live shifts.</h3>
              <p>Finish your profile, service area, availability, credentials, and background-check consent so MedShift can review your account.</p>
            </div>
            <a className="dashboard-banner-action" href="/worker/onboarding">
              Continue onboarding
            </a>
          </section>
        ) : null}

        <section className="worker-dashboard-grid">
          <div className="worker-dashboard-main-column">
            <section className="work-overview-card" aria-label="Work overview">
              <div className="work-overview-heading">
                <div>
                  <h2>Work overview</h2>
                  <p>Last year <span>+12%</span></p>
                </div>
                <button className="soft-select-button" type="button">Year</button>
              </div>
              <div className="work-chart" aria-label="Completed shifts by month">
                <div className="work-chart-scale" aria-hidden="true">
                  <span>100</span>
                  <span>75</span>
                  <span>50</span>
                  <span>25</span>
                  <span>0</span>
                </div>
                <div className="work-chart-bars">
                  {workOverview.map((month) => (
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
              <h2>Requests</h2>
              <button type="button">View all</button>
            </section>

            <section className="worker-request-grid" aria-label="Shift requests">
              {shifts.slice(0, 2).map((shift) => (
                <article className="worker-request-card" key={shift.id}>
                  <div className="request-card-top">
                    <div className="request-avatar">{getFacilityInitials(shift.facility?.name)}</div>
                    <div>
                      <h3>{shift.facility?.name ?? "MedShift facility"}</h3>
                      <span>{shift.roleRequired} shift</span>
                    </div>
                    <div className="request-actions">
                      <button aria-label="Decline request" type="button"><X aria-hidden="true" /></button>
                      <button aria-label="Accept request" type="button" onClick={() => acceptShift(shift)} disabled={isAccepting || shift.status !== ShiftStatus.Open}><Check aria-hidden="true" /></button>
                    </div>
                  </div>
                  <div className="request-meta">
                    <span><Calendar aria-hidden="true" /> {formatShortDate(shift.startTime)}</span>
                    <span><Clock aria-hidden="true" /> {formatTimeRange(shift.startTime, shift.endTime)}</span>
                  </div>
                  <div className="request-footer">
                    <span><MapPin aria-hidden="true" /> {shift.facility?.address?.city ?? "Calgary"}, {shift.facility?.address?.province ?? "AB"}</span>
                    <strong>${calculateShiftPay(shift)} <small>/{calculateShiftHours(shift)} hr</small></strong>
                  </div>
                </article>
              ))}
            </section>

            <section className="worker-section-heading">
              <h2>Facility reviews</h2>
              <button type="button">View all</button>
            </section>

            <section className="worker-review-card-grid" aria-label="Facility reviews">
              {reviewCards.map((review) => (
                <article className="facility-review-card" key={review.name}>
                  <div className="request-avatar">{getFacilityInitials(review.name)}</div>
                  <div>
                    <h3>{review.name}</h3>
                    <span>{review.type}</span>
                  </div>
                  <strong><Star aria-hidden="true" /> {review.rating}</strong>
                </article>
              ))}
            </section>

            <section className="worker-open-matches" id="map">
              <div className="worker-toolbar">
                <div className="segmented-control" aria-label="Shift view">
                  <button className={viewMode === "list" ? "active" : ""} type="button" onClick={() => setViewMode("list")}>
                    List
                  </button>
                  <button className={viewMode === "map" ? "active" : ""} type="button" onClick={() => setViewMode("map")}>
                    Map
                  </button>
                </div>
                <span>{isLoadingDashboard ? "Loading live dashboard data..." : message || "Live board connected to your saved radius."}</span>
              </div>
              <div className={viewMode === "map" ? "shift-map-panel" : "worker-shift-list compact"}>
                {viewMode === "list" ? (
                  shifts.map((shift) => (
                    <button
                      className={shift.id === selectedShift?.id ? "worker-shift-card active" : "worker-shift-card"}
                      key={shift.id}
                      type="button"
                      onClick={() => setSelectedShiftId(shift.id)}
                    >
                      <span>{shift.facility?.name ?? "MedShift facility"}</span>
                      <strong>{shift.roleRequired} · ${shift.hourlyRate}/hr</strong>
                      <small>{formatWindow(shift.startTime, shift.endTime)}</small>
                      <em>{shift.distanceKm ? `${shift.distanceKm} km away` : "Nearby"}</em>
                    </button>
                  ))
                ) : (
                  <ShiftMap shifts={shifts} selectedShiftId={selectedShift?.id} token={mapboxToken} onSelectShift={setSelectedShiftId} />
                )}
              </div>
            </section>
          </div>

          <aside className="worker-dashboard-side-column" aria-label="Schedule and earnings">
            <section className="pay-summary-grid">
              <PayTile icon={<Coins aria-hidden="true" />} label="Earned today" value={`+$${calculateProjectedPay(shifts)}`} hint="$90 yesterday" featured />
              <PayTile icon={<Calendar aria-hidden="true" />} label="This week" value="$640" hint="$200 last week" />
              <PayTile icon={<Hourglass aria-hidden="true" />} label="Pending" value="$215" hint="3 payments" />
              <PayTile icon={<Wallet aria-hidden="true" />} label="Total balance" value="$2,849" hint="Available" />
            </section>

            <section className="schedule-card" aria-label="April 2026 calendar">
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

            <section className="schedule-timeline" aria-label="Daily schedule">
              {scheduleSlots.map((slot) => {
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

            {selectedShift ? (
              <section className="shift-detail-panel compact" aria-label="Selected shift details">
                <div>
                  <StatusBadge tone={selectedShift.status === ShiftStatus.Open ? "gold" : "green"}>{selectedShift.status}</StatusBadge>
                  <h2>{selectedShift.facility?.name ?? "MedShift facility"}</h2>
                  <p>{selectedShift.description}</p>
                </div>

                <dl className="shift-detail-list">
                  <div>
                    <dt>Role</dt>
                    <dd>{selectedShift.roleRequired}</dd>
                  </div>
                  <div>
                    <dt>Rate</dt>
                    <dd>${selectedShift.hourlyRate}/hr</dd>
                  </div>
                  <div>
                    <dt>Distance</dt>
                    <dd>{selectedShift.distanceKm ? `${selectedShift.distanceKm} km` : "Nearby"}</dd>
                  </div>
                </dl>

                <button
                  className="auth-submit"
                  disabled={isAccepting || selectedShift.status !== ShiftStatus.Open}
                  type="button"
                  onClick={() => acceptShift(selectedShift)}
                >
                  {selectedShift.status === ShiftStatus.Open ? "Accept shift" : "Matched"}
                </button>

                {selectedShift.status === ShiftStatus.Completed ? (
                  <form className="worker-review-form" onSubmit={(event) => { event.preventDefault(); void submitReview(selectedShift); }}>
                    <div className="star-row" aria-label="Facility rating">
                      {[1, 2, 3, 4, 5].map((rating) => (
                        <button
                          className={reviewRating >= rating ? "active" : ""}
                          key={rating}
                          type="button"
                          onClick={() => setReviewRating(rating)}
                          aria-label={`${rating} star rating`}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                    <textarea
                      maxLength={280}
                      name="facilityReview"
                      value={reviewComment}
                      onChange={(event) => setReviewComment(event.target.value)}
                      placeholder="Add facility feedback"
                      rows={3}
                    />
                    <button type="submit">Submit review</button>
                  </form>
                ) : null}
              </section>
            ) : null}
          </aside>
        </section>
      </section>
    </DashboardShell>
  );
}

function MetricPill({
  icon,
  label,
  tone = "success",
  trend,
  value
}: {
  icon: ReactNode;
  label: string;
  tone?: "success" | "danger";
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
      {trend ? <em className={tone}>{trend}</em> : null}
    </article>
  );
}

function PayTile({
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
    day: "numeric",
    hour: "numeric"
  }).format(new Date(date));
}

function calculateProjectedPay(shifts: MatchedShiftSummary[]) {
  return shifts
    .filter((shift) => shift.status === ShiftStatus.Open)
    .reduce((total, shift) => {
      const hours = (new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime()) / 3_600_000;
      return total + Math.max(0, Math.round(hours * shift.hourlyRate));
    }, 0);
}

function calculateShiftHours(shift: MatchedShiftSummary) {
  const hours = (new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime()) / 3_600_000;
  return Math.max(1, Math.round(hours));
}

function calculateShiftPay(shift: MatchedShiftSummary) {
  return calculateShiftHours(shift) * shift.hourlyRate;
}

function formatTimeRange(startTime: string, endTime: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    hour: "numeric",
    minute: "2-digit"
  });

  return `${formatter.format(new Date(startTime))}-${formatter.format(new Date(endTime))}`;
}

function getFacilityInitials(name?: string) {
  if (!name) {
    return "MS";
  }

  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
