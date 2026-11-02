"use client";

import { apiFetch as fetch } from "../session-fetch";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { ClinicalRole, GeoPoint, NotificationSummary, OnboardingStatus, ReviewSummary, ShiftMetrics, ShiftStatus, ShiftSummary, WorkerSearchResult } from "@medshift/shared-types";
import {
  Button,
  DashboardShell,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea
} from "@medshift/ui-components";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Pencil,
  ShieldCheck,
  Trash2,
  X
} from "lucide-react";
import type { Socket } from "socket.io-client";
import { useDashboardNotifications } from "../use-dashboard-notifications";

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

type WorkerSearchFilters = {
  availableDay: string;
  clinicalRole: "" | ClinicalRole;
  minRating: string;
  radiusKm: string;
  shiftType: string;
};

type FacilityDashboardSection = "shifts" | "workers" | "roster" | "reviews";

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
  const pathname = usePathname();
  const activeSection = getFacilityDashboardSection(pathname);
  const pageTitle = getFacilityDashboardTitle(activeSection);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [shifts, setShifts] = useState<FacilityShiftSummary[]>([]);
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
  const [workerResults, setWorkerResults] = useState<WorkerSearchResult[]>([]);
  const [isSearchingWorkers, setIsSearchingWorkers] = useState(false);
  const [workerSearchMessage, setWorkerSearchMessage] = useState("Search approved workers by role, distance, availability, and rating.");
  const [workerFilters, setWorkerFilters] = useState<WorkerSearchFilters>({
    availableDay: "",
    clinicalRole: "",
    minRating: "",
    radiusKm: "25",
    shiftType: ""
  });

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
  const {
    isLoadingNotifications,
    loadNotifications,
    markAllNotificationsRead,
    markNotificationRead,
    notifications,
    unreadNotificationCount
  } = useDashboardNotifications(apiUrl);
  const approvedForPosting = onboardingStatus?.verificationStatus === OnboardingStatus.Approved;
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
    const token = "cookie-session";

    if (!token) {
      setShifts([]);
      setReviews([]);
      setFacilityProfile(null);
      setOnboardingStatus(null);
      setMessage("Sign in as a facility to manage live shifts.");
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
      setShifts([]);
      setReviews([]);
      setFacilityProfile(null);
      setOnboardingStatus(null);
      setMessage("Live facility dashboard data is unavailable. Check API connectivity, then refresh this workspace.");
    } finally {
      setIsLoadingDashboard(false);
    }
  }, [apiUrl]);

  useEffect(() => {
    void loadFacilityDashboard();
  }, [loadFacilityDashboard]);

  useEffect(() => {
    let socket: Socket | null = null;
    const token = "cookie-session";
    const facilityId = facilityProfile?.id ?? onboardingStatus?.profileId;

    if (!token || !facilityId) {
      return undefined;
    }

    import("socket.io-client")
      .then(({ io }) => {
        socket = io(`${apiUrl}/shifts`, { auth: { token }, transports: ["websocket"], withCredentials: true });
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

  async function searchWorkers() {
    const token = "cookie-session";

    if (!token) {
      setWorkerSearchMessage("Sign in as a facility to search live workers.");
      return;
    }

    setIsSearchingWorkers(true);

    try {
      const [longitude, latitude] = defaultShiftLocation.coordinates;
      const query = new URLSearchParams({
        longitude: String(longitude),
        latitude: String(latitude),
        radiusKm: workerFilters.radiusKm || "25"
      });

      if (workerFilters.clinicalRole) {
        query.set("clinicalRole", workerFilters.clinicalRole);
      }

      if (workerFilters.availableDay) {
        query.set("availableDay", workerFilters.availableDay);
      }

      if (workerFilters.shiftType) {
        query.set("shiftType", workerFilters.shiftType);
      }

      if (workerFilters.minRating) {
        query.set("minRating", workerFilters.minRating);
      }

      const response = await fetch(`${apiUrl}/matching/workers?${query.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error("Worker search failed");
      }

      const workers = (await response.json()) as WorkerSearchResult[];
      setWorkerResults(workers);
      setWorkerSearchMessage(`${workers.length} approved worker${workers.length === 1 ? "" : "s"} found.`);
    } catch {
      setWorkerResults([]);
      setWorkerSearchMessage("Worker search is unavailable. Check API connectivity and facility approval.");
    } finally {
      setIsSearchingWorkers(false);
    }
  }

  function postShiftForWorker(worker: WorkerSearchResult) {
    setRoleRequired(worker.title);
    setDescription(`Priority ${worker.title} coverage for worker pool near ${worker.distanceKm ?? "your facility"} km.`);
    setHourlyRate(worker.title === ClinicalRole.Rn ? "52" : worker.title === ClinicalRole.Lpn ? "44" : "36");
    setIsModalOpen(true);
    setMessage(`Posting form prepared for ${worker.title} coverage.`);
  }

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

    const token = "cookie-session";
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

    if (!token) {
      setMessage("Sign in as a facility to publish live shifts.");
      return;
    }

    if (!approvedForPosting) {
      setMessage("Complete onboarding and wait for approval before posting live shifts.");
      return;
    }

    if (existingShift) {
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

    closeShiftModal();
  }

  async function submitReview(shift: FacilityShiftSummary) {
    const rating = reviewRatings[shift.id] ?? 5;
    const comment = (reviewComments[shift.id] ?? "").trim();
    const token = "cookie-session";

    if (!token) {
      setMessage("Sign in as a facility to submit worker reviews.");
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
    const token = "cookie-session";

    if (!token) {
      setMessage("Sign in as a facility to update shift status.");
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
    const token = "cookie-session";

    if (!token) {
      setMessage("Sign in as a facility to remove shifts.");
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

  return (
    <DashboardShell
      actions={
        <Button className="button-primary" disabled={!approvedForPosting} type="button" onClick={openCreateShiftModal}>
          Post shift
        </Button>
      }
      className="facility-page"
      eyebrow={<StatusBadge tone="navy">Facility roster</StatusBadge>}
      navItems={[
        { label: "Shifts", href: "/facility", active: activeSection === "shifts" },
        { label: "Find Workers", href: "/facility/workers", active: activeSection === "workers" },
        { label: "Roster", href: "/facility/roster", active: activeSection === "roster" },
        { label: "Reviews", href: "/facility/reviews", active: activeSection === "reviews" },
        { label: "Marketplace", href: "/facility/marketplace" },
        { label: "Settings", href: "/facility/settings" }
      ]}
      notificationLoading={isLoadingNotifications}
      notifications={notifications}
      onMarkAllNotificationsRead={markAllNotificationsRead}
      onNotificationClick={(notification) => void markNotificationRead(notification as NotificationSummary)}
      title={pageTitle}
      unreadNotificationCount={unreadNotificationCount}
      userLabel="Facility workspace"
    >
      <section className="facility-shell facility-dashboard-refresh">
        {onboardingStatus && onboardingStatus.verificationStatus !== OnboardingStatus.Approved ? (
          <section className="dashboard-onboarding-banner" aria-label="Facility onboarding status">
            <div>
              <span>{onboardingStatus.verificationStatus === OnboardingStatus.Incomplete ? "Facility setup required" : "Verification pending"}</span>
              <h3>{onboardingStatus.verificationStatus === OnboardingStatus.Incomplete ? "Complete facility onboarding to post live shifts." : "Your facility registration is under review."}</h3>
              <p>{onboardingStatus.verificationStatus === OnboardingStatus.Incomplete ? "Finish profile, service location, contact, and billing readiness." : "Roster data remains live while posting stays locked until approval."}</p>
            </div>
            <a className="dashboard-banner-action" href="/facility/onboarding">
              {onboardingStatus.verificationStatus === OnboardingStatus.Incomplete ? "Continue onboarding" : "Review onboarding"}
            </a>
          </section>
        ) : null}
        {message || isLoadingDashboard ? <p className="facility-message">{isLoadingDashboard ? "Loading live facility dashboard..." : message}</p> : null}

        <section className="facility-dashboard-grid">
          {activeSection === "shifts" ? (
          <section className="facility-board facility-open-board" id="facility-shifts">
            <div className="facility-board-heading">
              <div>
                <h2>Active and upcoming shifts</h2>
                <p>Manage posted shifts, worker matches, completion, cancellation, and reviews.</p>
              </div>
              <StatusBadge tone="green">{metrics.activeShifts} active</StatusBadge>
            </div>
            <div className="facility-shift-table-wrap">
              <Table className="facility-shift-table">
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Role</TableHead>
                    <TableHead scope="col">Window</TableHead>
                    <TableHead scope="col">Description</TableHead>
                    <TableHead scope="col">Rate</TableHead>
                    <TableHead scope="col">Status</TableHead>
                    <TableHead scope="col">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shifts.map((shift) => (
                    <TableRow
                      className={getFacilityShiftRowClass(shift, selectedReviewShiftId)}
                      key={shift.id}
                      onClick={() => {
                        if (shift.status === ShiftStatus.Completed && !reviewShiftIds.has(shift.id)) {
                          setSelectedReviewShiftId(shift.id);
                        }
                      }}
                    >
                      <TableCell>
                        <div className="facility-shift-role-cell">
                          <strong>{formatRoleLabel(shift.roleRequired)}</strong>
                          <span>{formatShortDate(shift.startTime)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="facility-shift-window-cell">
                          <strong>{formatTimeRange(shift.startTime, shift.endTime)}</strong>
                          <span>{calculateFacilityShiftHours(shift)} hr shift</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="facility-shift-description-cell">
                          <strong>{shift.description || "No description"}</strong>
                          <span>{shift.matchedWorkerId ? "Worker matched" : "Awaiting match"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="facility-shift-rate-cell">
                          <strong>${shift.hourlyRate}/hr</strong>
                          <span>${calculateFacilityShiftPay(shift)} est.</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge tone={shift.status === ShiftStatus.Open ? "gold" : shift.status === ShiftStatus.Cancelled ? "red" : "green"}>{formatStatusLabel(shift.status)}</StatusBadge>
                      </TableCell>
                      <TableCell>
                        <div className="facility-table-actions">
                          {shift.status === ShiftStatus.Matched ? (
                            <Button type="button" size="sm" onClick={(event) => { event.stopPropagation(); void updateShiftStatus(shift, ShiftStatus.InProgress); }}>
                              Start
                            </Button>
                          ) : null}
                          {shift.status === ShiftStatus.InProgress ? (
                            <Button type="button" size="sm" onClick={(event) => { event.stopPropagation(); void updateShiftStatus(shift, ShiftStatus.Completed); }}>
                              Complete
                            </Button>
                          ) : null}
                          {shift.status === ShiftStatus.Open || shift.status === ShiftStatus.Matched ? (
                            <Button type="button" size="sm" variant="secondary" onClick={(event) => { event.stopPropagation(); void updateShiftStatus(shift, ShiftStatus.Cancelled); }}>
                              <X aria-hidden="true" /> Cancel
                            </Button>
                          ) : null}
                          {shift.status === ShiftStatus.Open ? (
                            <Button type="button" size="sm" variant="outline" onClick={(event) => { event.stopPropagation(); openEditShiftModal(shift); }}>
                              <Pencil aria-hidden="true" /> Edit
                            </Button>
                          ) : null}
                          {shift.status === ShiftStatus.Completed ? (
                            <Button disabled={reviewShiftIds.has(shift.id)} type="button" size="sm" onClick={(event) => { event.stopPropagation(); setSelectedReviewShiftId(shift.id); }}>
                              {reviewShiftIds.has(shift.id) ? "Reviewed" : "Review"}
                            </Button>
                          ) : null}
                          {shift.status === ShiftStatus.Cancelled ? (
                            <Button className="danger" type="button" size="sm" variant="destructive" onClick={(event) => { event.stopPropagation(); void removeShift(shift); }}>
                              <Trash2 aria-hidden="true" /> Remove
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!shifts.length ? (
                    <TableRow>
                      <TableCell className="facility-table-empty" colSpan={6}>
                        Post your first shift to start building the roster.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </section>
          ) : null}

          {activeSection === "workers" || activeSection === "roster" || activeSection === "reviews" ? (
          <section className="facility-insight-grid" aria-label="Facility insights">
            {activeSection === "workers" ? (
            <section className="facility-worker-search" aria-label="Find workers">
              <div className="facility-panel-heading">
                <div>
                  <h2>Find workers</h2>
                  <p>{workerSearchMessage}</p>
                </div>
                <Button type="button" onClick={searchWorkers} disabled={isSearchingWorkers}>{isSearchingWorkers ? "Searching..." : "Search"}</Button>
              </div>
              <div className="facility-worker-filter-grid">
                <Label>
                  Role
                  <Select value={workerFilters.clinicalRole || "any"} onValueChange={(value) => setWorkerFilters((current) => ({ ...current, clinicalRole: value === "any" ? "" : value as WorkerSearchFilters["clinicalRole"] }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      {Object.values(ClinicalRole).map((role) => <SelectItem key={role} value={role}>{role}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Label>
                <Label>
                  Radius
                  <Input inputMode="numeric" value={workerFilters.radiusKm} onChange={(event) => setWorkerFilters((current) => ({ ...current, radiusKm: event.target.value }))} />
                </Label>
                <Label>
                  Day
                  <Select value={workerFilters.availableDay || "any"} onValueChange={(value) => setWorkerFilters((current) => ({ ...current, availableDay: value === "any" ? "" : value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any day</SelectItem>
                      {["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"].map((day) => <SelectItem key={day} value={day}>{formatEnumLabel(day)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Label>
                <Label>
                  Shift
                  <Select value={workerFilters.shiftType || "any"} onValueChange={(value) => setWorkerFilters((current) => ({ ...current, shiftType: value === "any" ? "" : value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any shift</SelectItem>
                      {["DAY", "EVENING", "NIGHT", "WEEKEND"].map((type) => <SelectItem key={type} value={type}>{formatEnumLabel(type)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Label>
                <Label>
                  Min rating
                  <Input inputMode="decimal" value={workerFilters.minRating} onChange={(event) => setWorkerFilters((current) => ({ ...current, minRating: event.target.value }))} placeholder="4.5" />
                </Label>
              </div>
              <div className="facility-worker-results">
                {workerResults.map((worker) => (
                  <article className="facility-worker-card" key={worker.id}>
                    <div>
                      <strong>{worker.firstName} {worker.lastName}</strong>
                      <span>{worker.title} · {worker.distanceKm ?? "Nearby"} km · {worker.stats.averageRating.toFixed(1)}★</span>
                      <small>{worker.documents.verified}/{worker.documents.total} documents verified · {worker.stats.totalShiftsCompleted} shifts</small>
                    </div>
                    <Button type="button" size="sm" onClick={() => postShiftForWorker(worker)}>Post matching shift</Button>
                  </article>
                ))}
                {!workerResults.length ? <div className="worker-empty-state">No searched workers yet.</div> : null}
              </div>
            </section>
            ) : null}

            {activeSection === "roster" ? (
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
            ) : null}

            {activeSection === "reviews" ? (
            <section className="facility-review-queue" id="reviews" aria-label="Worker review queue">
              <div className="facility-panel-heading">
                <div>
                  <h2>Worker review queue</h2>
                  <p>Completed matches that need feedback.</p>
                </div>
                <Button asChild variant="outline"><a href="/facility/shifts">Open shift table</a></Button>
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
            ) : null}
          </section>
          ) : null}
        </section>
      </section>

      <Dialog open={isModalOpen} onOpenChange={(open) => { if (!open) closeShiftModal(); }}>
        <DialogContent className="post-shift-modal" id="post-shift">
            <DialogHeader>
              <DialogTitle id="post-shift-title">{editingShiftId ? "Edit shift" : "Post a shift"}</DialogTitle>
              <DialogDescription>Publish live staffing needs to approved MedShift workers.</DialogDescription>
            </DialogHeader>
            <form className="post-shift-form" onSubmit={handleSubmit}>
              <Label>
                Role
                <Select value={roleRequired} onValueChange={(value) => setRoleRequired(value as ClinicalRole)}>
                  <SelectTrigger aria-label="Clinical role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ClinicalRole.Hca}>HCA</SelectItem>
                    <SelectItem value={ClinicalRole.Rn}>RN</SelectItem>
                    <SelectItem value={ClinicalRole.Lpn}>LPN</SelectItem>
                    <SelectItem value={ClinicalRole.Psw}>PSW</SelectItem>
                  </SelectContent>
                </Select>
              </Label>
              <Label>
                Start
                <Input
                  name="startTime"
                  onChange={(event) => setStartTime(event.target.value)}
                  placeholder="Select start date and time"
                  required
                  type="datetime-local"
                  value={startTime}
                />
              </Label>
              <Label>
                End
                <Input
                  name="endTime"
                  onChange={(event) => setEndTime(event.target.value)}
                  placeholder="Select end date and time"
                  required
                  type="datetime-local"
                  value={endTime}
                />
              </Label>
              <Label>
                Hourly rate
                <Input
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
              </Label>
              <Label className="wide-field">
                Description
                <Textarea
                  maxLength={240}
                  minLength={12}
                  name="description"
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Describe the unit, responsibilities, and shift notes"
                  required
                  rows={3}
                  value={description}
                />
              </Label>
              <Button className="auth-submit wide-field" type="submit">{editingShiftId ? "Save changes" : "Publish to network"}</Button>
            </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedReviewShift)} onOpenChange={(open) => { if (!open) setSelectedReviewShiftId(""); }}>
        <DialogContent className="post-shift-modal facility-review-modal">
          {selectedReviewShift ? (
            <>
            <DialogHeader>
              <DialogDescription>Completed shift review</DialogDescription>
              <DialogTitle id="review-shift-title">{formatRoleLabel(selectedReviewShift.roleRequired)} · {formatShortDate(selectedReviewShift.startTime)}</DialogTitle>
            </DialogHeader>
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
              <Input
                maxLength={280}
                name={`review-${selectedReviewShift.id}`}
                value={reviewComments[selectedReviewShift.id] ?? ""}
                onChange={(event) => setReviewComments((current) => ({ ...current, [selectedReviewShift.id]: event.target.value }))}
                placeholder="Add worker feedback"
              />
              <Button type="submit">Submit review</Button>
            </form>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </DashboardShell>
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

function calculateFacilityShiftHours(shift: ShiftSummary) {
  const hours = (new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime()) / 3_600_000;
  return Math.max(1, Math.round(hours));
}

function calculateFacilityShiftPay(shift: ShiftSummary) {
  return calculateFacilityShiftHours(shift) * shift.hourlyRate;
}

function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
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

function getFacilityDashboardSection(pathname: string): FacilityDashboardSection {
  if (pathname.endsWith("/facility/shifts")) {
    return "shifts";
  }

  if (pathname.endsWith("/facility/workers")) {
    return "workers";
  }

  if (pathname.endsWith("/facility/roster")) {
    return "roster";
  }

  if (pathname.endsWith("/facility/reviews")) {
    return "reviews";
  }

  return "shifts";
}

function getFacilityDashboardTitle(section: FacilityDashboardSection) {
  if (section === "shifts") {
    return "Shift operations";
  }

  if (section === "workers") {
    return "Find workers";
  }

  if (section === "roster") {
    return "Roster";
  }

  if (section === "reviews") {
    return "Reviews";
  }

  return "Shift operations";
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
