"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ClinicalRole, GeoPoint, NotificationSummary, OnboardingStatus, ReviewSummary, ShiftMetrics, ShiftStatus, ShiftSummary } from "@medshift/shared-types";
import { DashboardShell, StatusBadge } from "@medshift/ui-components";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileCheck,
  Pencil,
  ShieldCheck,
  Timer,
  Trash2,
  Users,
  X
} from "lucide-react";
import type { Socket } from "socket.io-client";
import { useDashboardNotifications } from "../use-dashboard-notifications";

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

type FacilityOnboardingStatus = {
  completed?: boolean;
  nextStep?: string;
  profileId?: string | null;
  verificationStatus?: OnboardingStatus;
};

type FacilityProfileResponse = {
  id: string;
  location?: GeoPoint;
  stats?: {
    averageRating?: number;
  };
};

type FacilityShiftSummary = ShiftSummary & {
  matchedWorkerId?: string | null;
};

type ScheduleDay = {
  active: boolean;
  day: number;
  label: string;
};

type StaffingTimelineSlot = {
  detail: string;
  icon: typeof Calendar;
  time: string;
  title: string;
};

export default function FacilityDashboardPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [shifts, setShifts] = useState<FacilityShiftSummary[]>(demoShifts);
  const [message, setMessage] = useState("");
  const [roleRequired, setRoleRequired] = useState<ClinicalRole>(ClinicalRole.Hca);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [hourlyRate, setHourlyRate] = useState("36");
  const [description, setDescription] = useState("");
  const [reviewRatings, setReviewRatings] = useState<Record<string, number>>({});
  const [reviewComments, setReviewComments] = useState<Record<string, string>>({});
  const [onboardingStatus, setOnboardingStatus] = useState<FacilityOnboardingStatus | null>(null);
  const [facilityProfile, setFacilityProfile] = useState<FacilityProfileResponse | null>(null);
  const [reviews, setReviews] = useState<ReviewSummary[]>([]);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedReviewShiftId, setSelectedReviewShiftId] = useState("");
  const [editingShiftId, setEditingShiftId] = useState("");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  const {
    isLoadingNotifications,
    loadNotifications,
    markAllNotificationsRead,
    markNotificationRead,
    notifications,
    unreadNotificationCount
  } = useDashboardNotifications(apiUrl);
  const approvedForPosting = !onboardingStatus || onboardingStatus.verificationStatus === OnboardingStatus.Approved;
  const reviewShiftIds = useMemo(() => new Set(reviews.map((review) => review.shiftId)), [reviews]);
  const selectedReviewShift = shifts.find((shift) => shift.id === selectedReviewShiftId && shift.status === ShiftStatus.Completed && !reviewShiftIds.has(shift.id));

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

  const weekDays = useMemo(() => buildWeekDays(weekOffset), [weekOffset]);
  const timelineSlots = useMemo(() => buildStaffingTimeline(shifts, weekOffset), [shifts, weekOffset]);
  const reviewCards = useMemo(() => buildWorkerReviewCards(shifts, reviews), [reviews, shifts]);
  const selectedWeekDate = useMemo(() => addDays(startOfWeek(new Date()), weekOffset * 7), [weekOffset]);
  const defaultShiftLocation = facilityProfile?.location ?? { type: "Point" as const, coordinates: [-114.0719, 51.0447] as [number, number] };

  const loadFacilityDashboard = useCallback(async () => {
    const token = window.localStorage.getItem("medshift.accessToken");

    if (!token) {
      setShifts(demoShifts);
      setReviews([]);
      setFacilityProfile(null);
      setOnboardingStatus(null);
      setMessage("Showing dashboard preview. Sign in as a facility to manage live shifts.");
      return;
    }

    setIsLoadingDashboard(true);

    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [statusResponse, profileResponse, shiftsResponse, reviewsResponse] = await Promise.all([
        fetch(`${apiUrl}/facility-profiles/onboarding-status`, { headers }),
        fetch(`${apiUrl}/facility-profiles/me`, { headers }),
        fetch(`${apiUrl}/shifts`, { headers }),
        fetch(`${apiUrl}/reviews/me`, { headers })
      ]);

      if (!statusResponse.ok || !shiftsResponse.ok) {
        throw new Error("Unable to load facility dashboard");
      }

      const status = (await statusResponse.json()) as FacilityOnboardingStatus;
      const liveShifts = (await shiftsResponse.json()) as FacilityShiftSummary[];
      const profile = profileResponse.ok ? ((await profileResponse.json()) as FacilityProfileResponse) : null;
      const submittedReviews = reviewsResponse.ok ? ((await reviewsResponse.json()) as ReviewSummary[]) : [];

      setOnboardingStatus(status);
      setFacilityProfile(profile);
      setShifts(liveShifts);
      setReviews(submittedReviews);

      if (status.verificationStatus === OnboardingStatus.Approved) {
        setMessage(liveShifts.length ? "Live facility dashboard connected." : "Live facility dashboard connected. Post your first shift to broadcast it to workers.");
      } else if (status.verificationStatus === OnboardingStatus.Incomplete) {
        setMessage("Complete facility onboarding to post live shifts.");
      } else {
        setMessage("Your facility onboarding is under review. Shift posting stays locked until approval.");
      }
    } catch {
      setShifts(demoShifts);
      setReviews([]);
      setFacilityProfile(null);
      setMessage("Showing dashboard preview until your facility profile and shifts can be loaded.");
    } finally {
      setIsLoadingDashboard(false);
    }
  }, [apiUrl]);

  useEffect(() => {
    void loadFacilityDashboard();
  }, [loadFacilityDashboard]);

  useEffect(() => {
    let socket: Socket | null = null;
    const token = window.localStorage.getItem("medshift.accessToken");
    const facilityId = facilityProfile?.id ?? onboardingStatus?.profileId;

    if (!token || !facilityId) {
      return undefined;
    }

    import("socket.io-client")
      .then(({ io }) => {
        socket = io(`${apiUrl}/shifts`, { transports: ["websocket"] });
        socket.emit("join.facility", { id: facilityId });
        socket.on("shift.accepted", (shift: FacilityShiftSummary) => {
          setShifts((current) => current.map((item) => (item.id === shift.id ? { ...item, ...shift } : item)));
          setMessage("A worker accepted one of your shifts. Dashboard updated.");
          void loadNotifications();
        });
      })
      .catch(() => {
        setMessage("Realtime facility updates are unavailable in this environment.");
      });

    return () => {
      socket?.disconnect();
    };
  }, [apiUrl, facilityProfile?.id, loadNotifications, onboardingStatus?.profileId]);

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

    const token = window.localStorage.getItem("medshift.accessToken");
    const payload = {
      roleRequired,
      startTime: new Date(startTimestamp).toISOString(),
      endTime: new Date(endTimestamp).toISOString(),
      hourlyRate: rate,
      location: defaultShiftLocation,
      description: trimmedDescription
    };
    const existingShift = shifts.find((shift) => shift.id === editingShiftId);

    if (existingShift && existingShift.status !== ShiftStatus.Open) {
      setMessage("Only open shifts can be edited.");
      return;
    }

    if (token && !approvedForPosting) {
      setMessage("Complete onboarding and wait for approval before posting live shifts.");
      return;
    }

    if (existingShift) {
      const nextShift: ShiftSummary = { ...existingShift, ...payload };

      if (!token || existingShift.id.startsWith("demo-") || existingShift.id.startsWith("draft-")) {
        setShifts((current) => current.map((shift) => (shift.id === existingShift.id ? nextShift : shift)));
        setMessage("Preview shift updated.");
        closeShiftModal();
        return;
      }

      const response = await fetch(`${apiUrl}/shifts/${existingShift.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const savedShift = (await response.json()) as FacilityShiftSummary;
        setShifts((current) => current.map((shift) => (shift.id === savedShift.id ? savedShift : shift)));
        setMessage("Shift updated.");
        closeShiftModal();
        return;
      }

      setMessage("Shift could not be updated.");
      return;
    }

    const draftShift: FacilityShiftSummary = {
      id: `draft-${Date.now()}`,
      facilityId: "current-facility",
      ...payload,
      status: ShiftStatus.Open
    };

    if (token) {
      const response = await fetch(`${apiUrl}/shifts`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const savedShift = (await response.json()) as FacilityShiftSummary;
        setShifts((current) => [savedShift, ...current]);
        setMessage("Shift published and broadcast to available workers.");
      } else {
        setMessage("Shift could not be published. Confirm onboarding approval and API connectivity.");
        return;
      }
    } else {
      setShifts((current) => [draftShift, ...current]);
      setMessage("Saved as a local preview. Sign in to publish to the network.");
    }

    closeShiftModal();
  }

  async function submitReview(shift: FacilityShiftSummary) {
    const rating = reviewRatings[shift.id] ?? 5;
    const comment = (reviewComments[shift.id] ?? "").trim();
    const token = window.localStorage.getItem("medshift.accessToken");

    if (!token || shift.id.startsWith("demo-")) {
      setMessage(`Preview review submitted with ${rating} stars.`);
      setSelectedReviewShiftId("");
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

    if (response.ok) {
      const review = (await response.json()) as ReviewSummary;
      setReviews((current) => [review, ...current.filter((item) => item.id !== review.id)]);
      setMessage("Worker review submitted.");
      setSelectedReviewShiftId("");
      return;
    }

    setMessage("Review could not be submitted for this shift.");
  }

  function openCreateShiftModal() {
    setEditingShiftId("");
    setRoleRequired(ClinicalRole.Hca);
    setStartTime("");
    setEndTime("");
    setHourlyRate("36");
    setDescription("");
    setIsModalOpen(true);
  }

  function openEditShiftModal(shift: FacilityShiftSummary) {
    if (shift.status !== ShiftStatus.Open) {
      setMessage("Only open shifts can be edited.");
      return;
    }

    setEditingShiftId(shift.id);
    setRoleRequired(shift.roleRequired);
    setStartTime(toDateTimeLocalValue(shift.startTime));
    setEndTime(toDateTimeLocalValue(shift.endTime));
    setHourlyRate(String(shift.hourlyRate));
    setDescription(shift.description ?? "");
    setIsModalOpen(true);
  }

  function closeShiftModal() {
    setIsModalOpen(false);
    setEditingShiftId("");
    setDescription("");
  }

  async function updateShiftStatus(shift: FacilityShiftSummary, status: ShiftStatus) {
    const token = window.localStorage.getItem("medshift.accessToken");

    if (!token || shift.id.startsWith("demo-") || shift.id.startsWith("draft-")) {
      setShifts((current) => current.map((item) => (item.id === shift.id ? { ...item, status } : item)));
      setMessage(`Preview shift moved to ${formatStatusLabel(status)}.`);
      return;
    }

    const response = await fetch(`${apiUrl}/shifts/${shift.id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ status })
    });

    if (response.ok) {
      const savedShift = (await response.json()) as FacilityShiftSummary;
      setShifts((current) => current.map((item) => (item.id === savedShift.id ? savedShift : item)));
      setMessage(`Shift moved to ${formatStatusLabel(savedShift.status)}.`);
      void loadNotifications();
      return;
    }

    setMessage("Shift status could not be updated.");
  }

  async function removeShift(shift: FacilityShiftSummary) {
    const token = window.localStorage.getItem("medshift.accessToken");

    if (!token || shift.id.startsWith("demo-") || shift.id.startsWith("draft-")) {
      setShifts((current) => current.filter((item) => item.id !== shift.id));
      setMessage("Preview shift removed.");
      return;
    }

    const response = await fetch(`${apiUrl}/shifts/${shift.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });

    if (response.ok) {
      setShifts((current) => current.filter((item) => item.id !== shift.id));
      setMessage("Shift removed from your facility board.");
      return;
    }

    setMessage("Shift could not be removed.");
  }

  function scrollToSection(sectionId: string) {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <DashboardShell
      actions={
        <button className="button-primary" disabled={!approvedForPosting} type="button" onClick={openCreateShiftModal}>
          Post shift
        </button>
      }
      className="facility-page"
      eyebrow={<StatusBadge tone="navy">Facility roster</StatusBadge>}
      navItems={[
        { label: "Roster", href: "/facility", active: true }
      ]}
      notificationLoading={isLoadingNotifications}
      notifications={notifications}
      onMarkAllNotificationsRead={markAllNotificationsRead}
      onNotificationClick={(notification) => void markNotificationRead(notification as NotificationSummary)}
      title="Shift command centre"
      unreadNotificationCount={unreadNotificationCount}
      userLabel="Facility workspace"
    >
      <section className="facility-shell facility-dashboard-refresh">
        {onboardingStatus && onboardingStatus.verificationStatus !== OnboardingStatus.Approved ? (
          <section className="dashboard-onboarding-banner" aria-label="Facility onboarding status">
            <div>
              <span>{onboardingStatus.verificationStatus === OnboardingStatus.Incomplete ? "Facility setup required" : "Verification pending"}</span>
              <h3>{onboardingStatus.verificationStatus === OnboardingStatus.Incomplete ? "Complete facility onboarding to post live shifts." : "Your facility registration is under review."}</h3>
              <p>{onboardingStatus.verificationStatus === OnboardingStatus.Incomplete ? "Finish profile, service location, contact, and billing readiness." : "Roster data can be previewed while posting stays locked until approval."}</p>
            </div>
            <a className="dashboard-banner-action" href="/facility/onboarding">
              {onboardingStatus.verificationStatus === OnboardingStatus.Incomplete ? "Continue onboarding" : "Review onboarding"}
            </a>
          </section>
        ) : null}
        <section className="worker-metric-strip facility-metric-strip" aria-label="Facility metrics">
          <MetricPill icon={<Timer aria-hidden="true" />} label="Average fill time" value={metrics.averageFillTimeMinutes ? `${metrics.averageFillTimeMinutes}m` : "<2h"} trend="+12%" />
          <MetricPill icon={<Users aria-hidden="true" />} label="Active shifts" value={String(metrics.activeShifts)} trend="+5%" />
          <MetricPill icon={<Calendar aria-hidden="true" />} label="Upcoming shifts" value={String(metrics.upcomingShifts)} />
          <MetricPill icon={<FileCheck aria-hidden="true" />} label="Completed" value={String(metrics.completedShifts)} trend="+8%" />
        </section>

        {message || isLoadingDashboard ? <p className="facility-message">{isLoadingDashboard ? "Loading live facility dashboard..." : message}</p> : null}

        <section className="facility-dashboard-grid">
          <section className="facility-board facility-open-board" id="facility-shifts">
            <div className="facility-board-heading">
              <div>
                <h2>Active and upcoming shifts</h2>
                <p>Manage posted shifts, worker matches, completion, cancellation, and reviews.</p>
              </div>
              <StatusBadge tone="green">{metrics.activeShifts} active</StatusBadge>
            </div>
            <div className="facility-shift-table-wrap">
              <table className="facility-shift-table">
                <thead>
                  <tr>
                    <th scope="col">Role</th>
                    <th scope="col">Window</th>
                    <th scope="col">Description</th>
                    <th scope="col">Rate</th>
                    <th scope="col">Status</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {shifts.map((shift) => (
                    <tr
                      className={getFacilityShiftRowClass(shift, selectedReviewShiftId)}
                      key={shift.id}
                      onClick={() => {
                        if (shift.status === ShiftStatus.Completed && !reviewShiftIds.has(shift.id)) {
                          setSelectedReviewShiftId(shift.id);
                        }
                      }}
                    >
                      <td>
                        <strong>{formatRoleLabel(shift.roleRequired)}</strong>
                        <span>{formatShortDate(shift.startTime)}</span>
                      </td>
                      <td>{formatTimeRange(shift.startTime, shift.endTime)}</td>
                      <td>{shift.description || "No description"}</td>
                      <td>${shift.hourlyRate}/hr</td>
                      <td>
                        <StatusBadge tone={shift.status === ShiftStatus.Open ? "gold" : shift.status === ShiftStatus.Cancelled ? "red" : "green"}>{formatStatusLabel(shift.status)}</StatusBadge>
                      </td>
                      <td>
                        <div className="facility-table-actions">
                          {shift.status === ShiftStatus.Matched ? (
                            <button type="button" onClick={(event) => { event.stopPropagation(); void updateShiftStatus(shift, ShiftStatus.InProgress); }}>
                              Start
                            </button>
                          ) : null}
                          {shift.status === ShiftStatus.InProgress ? (
                            <button type="button" onClick={(event) => { event.stopPropagation(); void updateShiftStatus(shift, ShiftStatus.Completed); }}>
                              Complete
                            </button>
                          ) : null}
                          {shift.status === ShiftStatus.Open || shift.status === ShiftStatus.Matched ? (
                            <button type="button" onClick={(event) => { event.stopPropagation(); void updateShiftStatus(shift, ShiftStatus.Cancelled); }}>
                              <X aria-hidden="true" /> Cancel
                            </button>
                          ) : null}
                          {shift.status === ShiftStatus.Open ? (
                            <button type="button" onClick={(event) => { event.stopPropagation(); openEditShiftModal(shift); }}>
                              <Pencil aria-hidden="true" /> Edit
                            </button>
                          ) : null}
                          {shift.status === ShiftStatus.Completed ? (
                            <button disabled={reviewShiftIds.has(shift.id)} type="button" onClick={(event) => { event.stopPropagation(); setSelectedReviewShiftId(shift.id); }}>
                              {reviewShiftIds.has(shift.id) ? "Reviewed" : "Review"}
                            </button>
                          ) : null}
                          {shift.status === ShiftStatus.Cancelled ? (
                            <button className="danger" type="button" onClick={(event) => { event.stopPropagation(); void removeShift(shift); }}>
                              <Trash2 aria-hidden="true" /> Remove
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!shifts.length ? (
                    <tr>
                      <td className="facility-table-empty" colSpan={6}>
                        Post your first shift to start building the roster.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="facility-insight-grid" aria-label="Facility insights">
            <section className="facility-roster-panel" aria-label="Facility roster calendar and timeline">
              <section className="schedule-card" aria-label="Facility roster calendar">
                <div className="schedule-heading">
                  <button aria-label="Previous week" type="button" onClick={() => setWeekOffset((current) => current - 1)}><ChevronLeft aria-hidden="true" /></button>
                  <h2>{formatMonthYear(selectedWeekDate)}</h2>
                  <button aria-label="Next week" type="button" onClick={() => setWeekOffset((current) => current + 1)}><ChevronRight aria-hidden="true" /></button>
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
                {timelineSlots.map((slot) => {
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
                {!timelineSlots.length ? <div className="worker-empty-state">No shifts scheduled for this week.</div> : null}
              </section>
            </section>

            <section className="facility-review-queue" id="reviews" aria-label="Worker review queue">
              <div className="facility-panel-heading">
                <div>
                  <h2>Worker review queue</h2>
                  <p>Completed matches that need feedback.</p>
                </div>
                <button type="button" onClick={() => scrollToSection("facility-shifts")}>Open table</button>
              </div>
              <div className="facility-review-list">
                {reviewCards.map((review) => (
                  <article key={review.id}>
                    <div className="request-avatar">{getWorkerInitials(review.name)}</div>
                    <div>
                      <h3>{review.name}</h3>
                      <p>{review.role}</p>
                    </div>
                    <span className={review.rating === "Review" ? "review-status pending" : "review-status submitted"}>{review.rating === "Review" ? "Needs review" : `${review.rating}/5`}</span>
                  </article>
                ))}
                {!reviewCards.length ? <div className="worker-empty-state">Completed matched shifts ready for worker review will appear here.</div> : null}
              </div>
            </section>
          </section>
        </section>
      </section>

      {isModalOpen ? (
        <div className="modal-backdrop" role="presentation">
          <section className="post-shift-modal" id="post-shift" role="dialog" aria-modal="true" aria-labelledby="post-shift-title">
            <div className="modal-heading">
              <h2 id="post-shift-title">{editingShiftId ? "Edit shift" : "Post a shift"}</h2>
              <button type="button" onClick={closeShiftModal} aria-label="Close post shift modal">
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
              <button className="auth-submit wide-field" type="submit">{editingShiftId ? "Save changes" : "Publish to network"}</button>
            </form>
          </section>
        </div>
      ) : null}

      {selectedReviewShift ? (
        <div className="modal-backdrop" role="presentation">
          <section className="post-shift-modal facility-review-modal" role="dialog" aria-modal="true" aria-labelledby="review-shift-title">
            <div className="modal-heading">
              <div>
                <span>Completed shift review</span>
                <h2 id="review-shift-title">{formatRoleLabel(selectedReviewShift.roleRequired)} · {formatShortDate(selectedReviewShift.startTime)}</h2>
              </div>
              <button type="button" onClick={() => setSelectedReviewShiftId("")} aria-label="Close review modal">
                ×
              </button>
            </div>
            <p>{selectedReviewShift.description || "Add feedback for the matched worker."}</p>
            <form className="review-inline-form facility-review-modal-form" onSubmit={(event) => { event.preventDefault(); void submitReview(selectedReviewShift); }}>
              <div className="star-row" aria-label="Worker rating">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    className={(reviewRatings[selectedReviewShift.id] ?? 5) >= rating ? "active" : ""}
                    key={rating}
                    type="button"
                    onClick={() => setReviewRatings((current) => ({ ...current, [selectedReviewShift.id]: rating }))}
                    aria-label={`${rating} star rating`}
                  >
                    ★
                  </button>
                ))}
              </div>
              <input
                maxLength={280}
                name={`review-${selectedReviewShift.id}`}
                value={reviewComments[selectedReviewShift.id] ?? ""}
                onChange={(event) => setReviewComments((current) => ({ ...current, [selectedReviewShift.id]: event.target.value }))}
                placeholder="Add worker feedback"
              />
              <button type="submit">Submit review</button>
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

function formatMonthYear(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    month: "long",
    year: "numeric"
  }).format(date);
}

function toDateTimeLocalValue(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const timezoneOffset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
}

function formatRoleLabel(role: ClinicalRole) {
  return role;
}

function formatStatusLabel(status: ShiftStatus) {
  return status.toLowerCase().replace(/_/g, " ");
}

function getFacilityShiftRowClass(shift: ShiftSummary, selectedReviewShiftId: string) {
  return [
    shift.status === ShiftStatus.Completed ? "is-reviewable" : "",
    shift.id === selectedReviewShiftId ? "is-selected" : ""
  ]
    .filter(Boolean)
    .join(" ");
}

function getWorkerInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function buildWeekDays(weekOffset: number): ScheduleDay[] {
  const today = new Date();
  const weekStart = addDays(startOfWeek(today), weekOffset * 7);

  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart, index);

    return {
      active: isSameDate(date, today),
      day: date.getDate(),
      label: new Intl.DateTimeFormat("en-CA", { weekday: "short" }).format(date).toUpperCase()
    };
  });
}

function buildStaffingTimeline(shifts: FacilityShiftSummary[], weekOffset: number): StaffingTimelineSlot[] {
  const weekStart = addDays(startOfWeek(new Date()), weekOffset * 7);
  const weekEnd = addDays(weekStart, 7);

  return [...shifts]
    .filter((shift) => {
      const start = new Date(shift.startTime);
      return start >= weekStart && start < weekEnd && shift.status !== ShiftStatus.Cancelled;
    })
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    .slice(0, 5)
    .map((shift) => ({
      detail: shift.description || `${formatStatusLabel(shift.status)} coverage`,
      icon: shift.status === ShiftStatus.Open ? Calendar : shift.status === ShiftStatus.Matched ? Clock : ShieldCheck,
      time: formatTimeRange(shift.startTime, shift.endTime),
      title: `${shift.roleRequired} ${formatStatusLabel(shift.status)}`
    }));
}

function buildWorkerReviewCards(shifts: FacilityShiftSummary[], reviews: ReviewSummary[]) {
  const reviewByShiftId = new Map(reviews.map((review) => [review.shiftId, review]));
  const completedMatchedShifts = shifts
    .filter((shift) => shift.status === ShiftStatus.Completed && Boolean(shift.matchedWorkerId))
    .sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime());
  const pendingCards = completedMatchedShifts
    .filter((shift) => !reviewByShiftId.has(shift.id))
    .map((shift) => ({
      id: `pending-${shift.id}`,
      name: getWorkerDisplayName(shift.matchedWorkerId),
      rating: "Review",
      role: `${shift.roleRequired} · ${formatShortDate(shift.startTime)}`
    }));
  const submittedCards = reviews.slice(0, 4).map((review) => {
    const shift = shifts.find((item) => item.id === review.shiftId);

    return {
      id: review.id,
      name: getWorkerDisplayName(review.revieweeId),
      rating: String(review.rating),
      role: shift ? `${shift.roleRequired} · ${formatShortDate(shift.startTime)}` : "Submitted worker review"
    };
  });

  return [...pendingCards, ...submittedCards].slice(0, 4);
}

function getWorkerDisplayName(id?: string | null) {
  if (!id) {
    return "Matched worker";
  }

  return `Worker ${id.slice(-4).toUpperCase()}`;
}

function startOfWeek(date: Date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  nextDate.setDate(nextDate.getDate() - nextDate.getDay());
  return nextDate;
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function isSameDate(first: Date, second: Date) {
  return first.getFullYear() === second.getFullYear() && first.getMonth() === second.getMonth() && first.getDate() === second.getDate();
}
