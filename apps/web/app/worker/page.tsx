"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ClinicalRole, FacilityType, GeoPoint, MatchedShiftSummary, NotificationSummary, OnboardingStatus, ReviewSummary, ShiftStatus } from "@medshift/shared-types";
import { DashboardShell, StatusBadge } from "@medshift/ui-components";
import { Calendar, Check, ChevronLeft, ChevronRight, Clock, Coins, Hourglass, MapPin, Star, Users, Wallet, X } from "lucide-react";
import type { Socket } from "socket.io-client";
import { useDashboardNotifications } from "../use-dashboard-notifications";
import { ShiftMap } from "./shift-map";

type ViewMode = "list" | "map";
type WorkerOnboardingStatus = {
  completed?: boolean;
  nextStep?: string;
  verificationStatus?: OnboardingStatus;
};

type WorkerProfileResponse = {
  firstName?: string;
  lastName?: string;
  location?: GeoPoint;
  preferences?: {
    maxDistanceKm?: number;
  };
  stats?: {
    averageRating?: number;
    totalShiftsCompleted?: number;
  };
  title?: ClinicalRole;
};

type DashboardReviewCard = {
  id: string;
  name: string;
  rating: string;
  type: string;
};

type ScheduleSlot = {
  detail: string;
  icon: typeof Calendar;
  time: string;
  title: string;
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

const demoOpenShifts = demoShifts.filter((shift) => shift.status === ShiftStatus.Open);
const demoWorkerShifts = demoShifts.filter((shift) => shift.status !== ShiftStatus.Open);

export default function WorkerDashboardPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  const {
    isLoadingNotifications,
    loadNotifications,
    markAllNotificationsRead,
    markNotificationRead,
    notifications,
    unreadNotificationCount
  } = useDashboardNotifications(apiUrl);
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedShiftId, setSelectedShiftId] = useState(demoShifts[0]?.id ?? "");
  const [openShifts, setOpenShifts] = useState<MatchedShiftSummary[]>(demoOpenShifts);
  const [workerShifts, setWorkerShifts] = useState<MatchedShiftSummary[]>(demoWorkerShifts);
  const [reviews, setReviews] = useState<ReviewSummary[]>([]);
  const [workerProfile, setWorkerProfile] = useState<WorkerProfileResponse | null>(null);
  const [message, setMessage] = useState("");
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(true);
  const [onboardingStatus, setOnboardingStatus] = useState<WorkerOnboardingStatus | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");

  const allDashboardShifts = useMemo(() => mergeShifts(openShifts, workerShifts), [openShifts, workerShifts]);
  const selectedShift = useMemo(
    () => allDashboardShifts.find((shift) => shift.id === selectedShiftId) ?? allDashboardShifts[0],
    [allDashboardShifts, selectedShiftId]
  );
  const approvedForLiveShifts = onboardingStatus?.verificationStatus === OnboardingStatus.Approved;
  const workOverview = useMemo(() => buildWorkOverview(workerShifts), [workerShifts]);
  const weekDays = useMemo(() => buildWeekDays(), []);
  const scheduleSlots = useMemo(() => buildScheduleSlots(workerShifts), [workerShifts]);
  const reviewCards = useMemo(() => buildReviewCards(workerShifts, reviews), [reviews, workerShifts]);
  const dashboardMetrics = useMemo(() => buildDashboardMetrics(workerShifts, workerProfile), [workerProfile, workerShifts]);
  const earnings = useMemo(() => buildEarnings(openShifts, workerShifts), [openShifts, workerShifts]);
  const hasSelectedShiftReview = selectedShift ? reviews.some((review) => review.shiftId === selectedShift.id) : false;

  const loadOpenShifts = useCallback(
    async (token: string, profile?: WorkerProfileResponse | null) => {
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

      return (await shiftsResponse.json()) as MatchedShiftSummary[];
    },
    [apiUrl]
  );

  const loadWorkerDashboard = useCallback(async () => {
    const token = window.localStorage.getItem("medshift.accessToken");

    if (!token) {
      setOpenShifts(demoOpenShifts);
      setWorkerShifts(demoWorkerShifts);
      setReviews([]);
      setWorkerProfile(null);
      setOnboardingStatus(null);
      setIsPreviewMode(true);
      setSelectedShiftId(demoShifts[0]?.id ?? "");
      setMessage("Showing a Calgary preview. Sign in as a worker to browse live matches.");
      return;
    }

    setIsLoadingDashboard(true);

    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [statusResponse, profileResponse, workerShiftsResponse, reviewsResponse] = await Promise.all([
        fetch(`${apiUrl}/worker-profiles/onboarding-status`, { headers }),
        fetch(`${apiUrl}/worker-profiles/me`, { headers }),
        fetch(`${apiUrl}/shifts/worker/me`, { headers }),
        fetch(`${apiUrl}/reviews/me`, { headers })
      ]);

      if (!statusResponse.ok) {
        throw new Error("Unable to load onboarding status");
      }

      const status = (await statusResponse.json()) as WorkerOnboardingStatus;
      const profile = profileResponse.ok ? ((await profileResponse.json()) as WorkerProfileResponse) : null;
      const ownedShifts = workerShiftsResponse.ok ? ((await workerShiftsResponse.json()) as MatchedShiftSummary[]) : [];
      const submittedReviews = reviewsResponse.ok ? ((await reviewsResponse.json()) as ReviewSummary[]) : [];
      const liveOpenShifts = profile ? await loadOpenShifts(token, profile) : [];

      setOnboardingStatus(status);
      setWorkerProfile(profile);
      setOpenShifts(liveOpenShifts);
      setWorkerShifts(ownedShifts);
      setReviews(submittedReviews);
      setIsPreviewMode(false);
      setSelectedShiftId(liveOpenShifts[0]?.id ?? ownedShifts[0]?.id ?? "");

      if (status.verificationStatus === OnboardingStatus.Approved) {
        setMessage(liveOpenShifts.length ? "Live board connected to your saved radius." : "Live board connected. No nearby open shifts are available yet.");
      } else if (status.verificationStatus === OnboardingStatus.Incomplete) {
        setMessage("Complete onboarding to unlock live shift matching.");
      } else {
        setMessage("Your onboarding is under review. Live dashboard data is visible, but shift acceptance is locked.");
      }
    } catch {
      setOpenShifts([]);
      setWorkerShifts([]);
      setReviews([]);
      setWorkerProfile(null);
      setOnboardingStatus(null);
      setIsPreviewMode(false);
      setSelectedShiftId("");
      setMessage("Live worker dashboard data is unavailable. Check API connectivity, then refresh this workspace.");
    } finally {
      setIsLoadingDashboard(false);
    }
  }, [apiUrl, loadOpenShifts]);

  useEffect(() => {
    void loadWorkerDashboard();
  }, [loadWorkerDashboard]);

  useEffect(() => {
    let socket: Socket | null = null;
    const token = window.localStorage.getItem("medshift.accessToken");

    if (!token) {
      return undefined;
    }

    import("socket.io-client")
      .then(({ io }) => {
        socket = io(`${apiUrl}/shifts`, { auth: { token }, transports: ["websocket"] });
        socket.on("shift.created", () => {
          loadOpenShifts(token, workerProfile)
            .then((result) => {
              setOpenShifts(result);
              setSelectedShiftId((current) => current || result[0]?.id || "");
              setMessage("New nearby shift posted. Live matches refreshed.");
              void loadNotifications();
            })
            .catch(() => setMessage("New shift posted, but live matches could not refresh."));
        });
        socket.on("shift.accepted", (shift: MatchedShiftSummary) => {
          setOpenShifts((current) => current.filter((item) => item.id !== shift.id));
          setSelectedShiftId((current) => (current === shift.id ? "" : current));
          void loadNotifications();
        });
      })
      .catch(() => {
        setMessage("Realtime updates are unavailable in this environment.");
      });

    return () => {
      socket?.disconnect();
    };
  }, [apiUrl, loadNotifications, loadOpenShifts, workerProfile]);

  async function acceptShift(shift: MatchedShiftSummary) {
    const token = window.localStorage.getItem("medshift.accessToken");

    if (!token || shift.id.startsWith("demo-")) {
      setOpenShifts((current) =>
        current.map((item) => (item.id === shift.id ? { ...item, status: ShiftStatus.Matched } : item))
      );
      setMessage("Preview accepted. Sign in as a worker to claim live shifts.");
      return;
    }

    if (!approvedForLiveShifts) {
      setMessage("Complete onboarding and wait for approval before accepting live shifts.");
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
      const acceptedShift = { ...shift, ...accepted, facility: shift.facility ?? accepted.facility };
      setOpenShifts((current) => current.filter((item) => item.id !== shift.id));
      setWorkerShifts((current) => mergeShifts([acceptedShift], current));
      setSelectedShiftId(acceptedShift.id);
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
      const review = (await response.json()) as ReviewSummary;
      setReviews((current) => [review, ...current.filter((item) => item.id !== review.id)]);
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
        { label: "Shift board", href: "/worker", active: true },
        { label: "Settings", href: "/worker/settings" }
      ]}
      notificationLoading={isLoadingNotifications}
      notifications={notifications}
      onMarkAllNotificationsRead={markAllNotificationsRead}
      onNotificationClick={(notification) => void markNotificationRead(notification as NotificationSummary)}
      title="Shift board"
      unreadNotificationCount={unreadNotificationCount}
      userLabel="Worker workspace"
    >
      <section className="worker-shell worker-dashboard-refresh">
        <section className="worker-metric-strip" aria-label="Worker metrics">
          <MetricPill icon={<Calendar aria-hidden="true" />} label="Total shifts" value={String(dashboardMetrics.totalShifts)} />
          <MetricPill icon={<Clock aria-hidden="true" />} label="Hours worked" value={`${dashboardMetrics.completedHours}h`} />
          <MetricPill icon={<Star aria-hidden="true" />} label="Rating" value={dashboardMetrics.rating} />
          <MetricPill icon={<Users aria-hidden="true" />} label="Repeat facilities" value={`${dashboardMetrics.repeatFacilities}%`} />
        </section>

        {onboardingStatus && onboardingStatus.verificationStatus !== OnboardingStatus.Approved ? (
          <section className="dashboard-onboarding-banner" aria-label="Complete worker onboarding">
            <div>
              <span>{onboardingStatus.verificationStatus === OnboardingStatus.Incomplete ? "Profile required" : "Verification pending"}</span>
              <h3>{onboardingStatus.verificationStatus === OnboardingStatus.Incomplete ? "Complete onboarding to unlock live shifts." : "Your worker profile is under review."}</h3>
              <p>{onboardingStatus.verificationStatus === OnboardingStatus.Incomplete ? "Finish profile, matching, availability, credentials, and consent." : "You can browse live data while acceptance stays locked until approval."}</p>
            </div>
            <a className="dashboard-banner-action" href="/worker/onboarding">
              {onboardingStatus.verificationStatus === OnboardingStatus.Incomplete ? "Continue onboarding" : "Review onboarding"}
            </a>
          </section>
        ) : null}

        <section className="worker-dashboard-grid">
          <div className="worker-dashboard-main-column">
            <section className="work-overview-card" aria-label="Work overview">
              <div className="work-overview-heading">
                <div>
                  <h2>Work overview</h2>
                  <p>{isPreviewMode ? "Preview data" : "Current year"} <span>{dashboardMetrics.completedShifts} completed</span></p>
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
              {openShifts.slice(0, 2).map((shift) => (
                <article className="worker-request-card" key={shift.id}>
                  <div className="request-card-top">
                    <div className="request-avatar">{getFacilityInitials(shift.facility?.name)}</div>
                    <div>
                      <h3>{shift.facility?.name ?? "MedShift facility"}</h3>
                      <span>{shift.roleRequired} shift</span>
                    </div>
                    <div className="request-actions">
                      <button aria-label="Decline request" type="button"><X aria-hidden="true" /></button>
                      <button aria-label="Accept request" type="button" onClick={() => acceptShift(shift)} disabled={isAccepting || shift.status !== ShiftStatus.Open || (!isPreviewMode && !approvedForLiveShifts)}><Check aria-hidden="true" /></button>
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
              {!openShifts.length ? (
                <div className="worker-empty-state">No open nearby shift requests right now.</div>
              ) : null}
            </section>

            <section className="worker-section-heading">
              <h2>Facility reviews</h2>
              <button type="button">View all</button>
            </section>

            <section className="worker-review-card-grid" aria-label="Facility reviews">
              {reviewCards.map((review) => (
                <article className="facility-review-card" key={review.id}>
                  <div className="facility-review-card-top">
                    <div className="request-avatar">{getFacilityInitials(review.name)}</div>
                    <span className={review.rating === "Review" ? "review-status pending" : "review-status submitted"}>
                      {review.rating === "Review" ? "Needs review" : "Submitted"}
                    </span>
                  </div>
                  <div className="facility-review-card-body">
                    <h3>{review.name}</h3>
                    <p>{review.type}</p>
                  </div>
                  <strong className={review.rating === "Review" ? "pending" : ""}>
                    <Star aria-hidden="true" />
                    {review.rating === "Review" ? "Awaiting rating" : `${review.rating}/5`}
                  </strong>
                </article>
              ))}
              {!reviewCards.length ? (
                <div className="worker-empty-state">Completed shifts ready for review will appear here.</div>
              ) : null}
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
                  openShifts.map((shift) => (
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
                  <ShiftMap shifts={openShifts} selectedShiftId={selectedShift?.id} token={mapboxToken} onSelectShift={setSelectedShiftId} />
                )}
                {viewMode === "list" && !openShifts.length ? (
                  <div className="worker-empty-state">No open shifts match your saved radius yet.</div>
                ) : null}
              </div>
            </section>
          </div>

          <aside className="worker-dashboard-side-column" aria-label="Schedule and earnings">
            <section className="pay-summary-grid">
              <PayTile icon={<Coins aria-hidden="true" />} label="Earned today" value={`+$${earnings.earnedToday}`} hint="Completed shift estimate" featured />
              <PayTile icon={<Calendar aria-hidden="true" />} label="This week" value={`$${earnings.thisWeek}`} hint="Completed this week" />
              <PayTile icon={<Hourglass aria-hidden="true" />} label="Pending" value={`$${earnings.pending}`} hint="Matched or in progress" />
              <PayTile icon={<Wallet aria-hidden="true" />} label="Projected" value={`$${earnings.projected}`} hint="Open matches nearby" />
            </section>

            <section className="schedule-card" aria-label="Worker weekly calendar">
              <div className="schedule-heading">
                <button aria-label="Previous week" type="button"><ChevronLeft aria-hidden="true" /></button>
                <h2>{formatMonthYear(new Date())}</h2>
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
              {!scheduleSlots.length ? (
                <div className="worker-empty-state">Accepted shifts for the next 7 days will appear here.</div>
              ) : null}
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
                  disabled={isAccepting || selectedShift.status !== ShiftStatus.Open || (!isPreviewMode && !approvedForLiveShifts)}
                  type="button"
                  onClick={() => acceptShift(selectedShift)}
                >
                  {selectedShift.status === ShiftStatus.Open ? (approvedForLiveShifts || isPreviewMode ? "Accept shift" : "Onboarding required") : "Matched"}
                </button>

                {selectedShift.status === ShiftStatus.Completed && !hasSelectedShiftReview ? (
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
                {selectedShift.status === ShiftStatus.Completed && hasSelectedShiftReview ? (
                  <p className="worker-review-complete">Facility review already submitted.</p>
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

function buildDashboardMetrics(workerShifts: MatchedShiftSummary[], profile: WorkerProfileResponse | null) {
  const completedShifts = workerShifts.filter((shift) => shift.status === ShiftStatus.Completed);
  const facilityIds = new Set(workerShifts.map((shift) => shift.facility?.id ?? shift.facilityId).filter(Boolean));
  const repeatFacilityCount = workerShifts.length - facilityIds.size;
  const repeatFacilities = workerShifts.length ? Math.round((Math.max(0, repeatFacilityCount) / workerShifts.length) * 100) : 0;
  const averageRating = profile?.stats?.averageRating;

  return {
    completedHours: completedShifts.reduce((total, shift) => total + calculateShiftHours(shift), 0),
    completedShifts: completedShifts.length,
    rating: averageRating ? averageRating.toFixed(1) : "New",
    repeatFacilities,
    totalShifts: workerShifts.length
  };
}

function buildWorkOverview(workerShifts: MatchedShiftSummary[]) {
  const currentYear = new Date().getFullYear();
  const monthFormatter = new Intl.DateTimeFormat("en-CA", { month: "short" });
  const monthlyTotals = Array.from({ length: 12 }, (_, index) => {
    const monthDate = new Date(currentYear, index, 1);

    return {
      completed: 0,
      month: monthFormatter.format(monthDate),
      total: 0
    };
  });
  const completedShifts = workerShifts.filter((shift) => shift.status === ShiftStatus.Completed);
  const maxCompletedHours = Math.max(1, ...completedShifts.map(calculateShiftHours));

  for (const shift of completedShifts) {
    const startDate = new Date(shift.startTime);

    if (startDate.getFullYear() !== currentYear) {
      continue;
    }

    const month = monthlyTotals[startDate.getMonth()];
    const hours = calculateShiftHours(shift);
    month.completed += hours;
    month.total += Math.max(hours, maxCompletedHours);
  }

  const maxTotal = Math.max(1, ...monthlyTotals.map((month) => month.total));

  return monthlyTotals.map((month) => ({
    ...month,
    completed: Math.min(100, Math.round((month.completed / maxTotal) * 100)),
    total: Math.min(100, Math.round((month.total / maxTotal) * 100))
  }));
}

function buildWeekDays() {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - today.getDay());

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);

    return {
      active: isSameDay(date, today),
      day: date.getDate(),
      label: new Intl.DateTimeFormat("en-CA", { weekday: "short" }).format(date).toUpperCase()
    };
  });
}

function buildScheduleSlots(workerShifts: MatchedShiftSummary[]): ScheduleSlot[] {
  const now = new Date();
  const sevenDaysFromNow = new Date(now);
  sevenDaysFromNow.setDate(now.getDate() + 7);

  return workerShifts
    .filter((shift) => shift.status === ShiftStatus.Matched || shift.status === ShiftStatus.InProgress)
    .filter((shift) => {
      const startDate = new Date(shift.startTime);
      return startDate >= now && startDate <= sevenDaysFromNow;
    })
    .sort((left, right) => new Date(left.startTime).getTime() - new Date(right.startTime).getTime())
    .slice(0, 4)
    .map((shift) => ({
      detail: shift.facility?.name ?? "MedShift facility",
      icon: shift.status === ShiftStatus.InProgress ? Clock : Calendar,
      time: formatTimeRange(shift.startTime, shift.endTime),
      title: `${shift.roleRequired} ${shift.status === ShiftStatus.InProgress ? "in progress" : "confirmed"}`
    }));
}

function buildReviewCards(workerShifts: MatchedShiftSummary[], reviews: ReviewSummary[]): DashboardReviewCard[] {
  const reviewedShiftIds = new Set(reviews.map((review) => review.shiftId));
  const completedShifts = workerShifts.filter((shift) => shift.status === ShiftStatus.Completed);
  const pendingReviewCards = completedShifts
    .filter((shift) => !reviewedShiftIds.has(shift.id))
    .map((shift) => ({
      id: `pending-${shift.id}`,
      name: shift.facility?.name ?? "MedShift facility",
      rating: "Review",
      type: `${formatFacilityType(shift.facility?.facilityType)} · ${formatShortDate(shift.startTime)}`
    }));
  const submittedReviewCards = reviews.map((review) => {
    const reviewedShift = workerShifts.find((shift) => shift.id === review.shiftId);

    return {
      id: review.id,
      name: reviewedShift?.facility?.name ?? `Shift ${review.shiftId.slice(-6)}`,
      rating: String(review.rating),
      type: review.comment || "Facility review submitted"
    };
  });

  return [...pendingReviewCards, ...submittedReviewCards].slice(0, 3);
}

function buildEarnings(openShifts: MatchedShiftSummary[], workerShifts: MatchedShiftSummary[]) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
  const completedShifts = workerShifts.filter((shift) => shift.status === ShiftStatus.Completed);
  const pendingShifts = workerShifts.filter((shift) => shift.status === ShiftStatus.Matched || shift.status === ShiftStatus.InProgress);

  return {
    earnedToday: sumShiftPay(completedShifts.filter((shift) => new Date(shift.endTime) >= startOfToday)),
    pending: sumShiftPay(pendingShifts),
    projected: sumShiftPay(openShifts),
    thisWeek: sumShiftPay(completedShifts.filter((shift) => new Date(shift.endTime) >= startOfWeek))
  };
}

function mergeShifts(primary: MatchedShiftSummary[], secondary: MatchedShiftSummary[]) {
  const shiftsById = new Map<string, MatchedShiftSummary>();

  for (const shift of [...primary, ...secondary]) {
    shiftsById.set(shift.id, { ...shiftsById.get(shift.id), ...shift });
  }

  return Array.from(shiftsById.values());
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

function formatFacilityType(type?: FacilityType) {
  if (!type) {
    return "Facility";
  }

  return type
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatMonthYear(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    month: "long",
    year: "numeric"
  }).format(date);
}

function formatShortDate(date: string) {
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    hour: "numeric"
  }).format(new Date(date));
}

function sumShiftPay(shifts: MatchedShiftSummary[]) {
  return shifts.reduce((total, shift) => total + calculateShiftPay(shift), 0);
}

function isSameDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
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
