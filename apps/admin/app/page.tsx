"use client";

import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { AccountStatus, ClinicalRole, FacilityType, OnboardingStatus, ShiftStatus, UserRole, WorkerDocumentCategory } from "@medshift/shared-types";
import { apiFetch as fetch } from "./session-fetch";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DashboardShell,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SimpleBarChart,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea
} from "@medshift/ui-components";

type AdminSection = "overview" | "verification" | "users" | "facilities" | "shifts" | "marketplace";

type AdminUser = {
  id: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
  emailVerified?: boolean;
  createdAt?: string;
};

type AdminWorker = {
  id: string;
  firstName: string;
  lastName: string;
  title: ClinicalRole;
  backgroundCheck?: { status?: string };
  documents: Array<{ id: string; category: WorkerDocumentCategory; originalFilename?: string; verificationStatus?: string; rejectionReason?: string }>;
  onboarding?: { verificationStatus?: OnboardingStatus; rejectedReason?: string };
  createdAt?: string;
};

type AdminFacility = {
  id: string;
  name: string;
  facilityType?: FacilityType;
  billingStatus: string;
  address?: { street?: string; city?: string; province?: string; postalCode?: string };
  contactPerson?: { name?: string; email?: string; phone?: string };
  onboarding?: { verificationStatus?: OnboardingStatus; rejectedReason?: string };
};

type AdminShift = {
  id: string;
  roleRequired: ClinicalRole;
  status: ShiftStatus;
  hourlyRate: number;
  startTime: string;
  endTime?: string;
  matchedWorkerId?: string | null;
  description?: string;
};

type AdminMetrics = {
  totalUsers: number;
  totalFacilities: number;
  totalWorkers: number;
  activeShifts: number;
  openShifts: number;
  completedShifts: number;
  pendingApprovals: number;
  verifiedWorkerRate: number;
  activeSocketConnections: number;
  averageFillTimeMinutes: number | null;
};

type AdminOverview = {
  users: AdminUser[];
  workers: AdminWorker[];
  facilities: AdminFacility[];
  shifts: AdminShift[];
  metrics: AdminMetrics;
};

type AdminMarketplaceRecord = {
  id: string;
  action?: string;
  actorUserId?: string;
  entityType?: string;
  entityId?: string;
  openedBy?: string;
  reason?: string;
  shiftId?: string;
  status?: string;
  workedMinutes?: number;
  createdAt?: string;
};

type MarketplaceOverview = {
  applications: number;
  pendingApplications: number;
  invitations: number;
  pendingInvitations: number;
  assignments: number;
  activeAssignments: number;
  attendanceEvents: number;
  submittedTimesheets: number;
  openDisputes: number;
};

const emptyMarketplaceOverview: MarketplaceOverview = {
  applications: 0,
  pendingApplications: 0,
  invitations: 0,
  pendingInvitations: 0,
  assignments: 0,
  activeAssignments: 0,
  attendanceEvents: 0,
  submittedTimesheets: 0,
  openDisputes: 0
};

const emptyOverview: AdminOverview = {
  users: [],
  workers: [],
  facilities: [],
  shifts: [],
  metrics: {
    totalUsers: 0,
    totalFacilities: 0,
    totalWorkers: 0,
    activeShifts: 0,
    openShifts: 0,
    completedShifts: 0,
    pendingApprovals: 0,
    verifiedWorkerRate: 0,
    activeSocketConnections: 0,
    averageFillTimeMinutes: null
  }
};

export default function AdminPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
  const [overview, setOverview] = useState<AdminOverview>(emptyOverview);
  const [activeSection, setActiveSection] = useState<AdminSection>("overview");
  const [queueFilter, setQueueFilter] = useState<"all" | "workers" | "facilities">("all");
  const [userFilter, setUserFilter] = useState<"all" | UserRole>("all");
  const [shiftFilter, setShiftFilter] = useState<"all" | ShiftStatus>("all");
  const [search, setSearch] = useState("");
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});
  const [auditEvents, setAuditEvents] = useState<AdminMarketplaceRecord[]>([]);
  const [applications, setApplications] = useState<AdminMarketplaceRecord[]>([]);
  const [assignments, setAssignments] = useState<AdminMarketplaceRecord[]>([]);
  const [attendanceEvents, setAttendanceEvents] = useState<AdminMarketplaceRecord[]>([]);
  const [disputes, setDisputes] = useState<AdminMarketplaceRecord[]>([]);
  const [invitations, setInvitations] = useState<AdminMarketplaceRecord[]>([]);
  const [marketplaceOverview, setMarketplaceOverview] = useState<MarketplaceOverview>(emptyMarketplaceOverview);
  const [timesheets, setTimesheets] = useState<AdminMarketplaceRecord[]>([]);
  const [message, setMessage] = useState("Sign in as an admin to manage live operations.");
  const [isLoading, setIsLoading] = useState(false);

  const loadOverview = useCallback(async () => {
    setIsLoading(true);

    try {
      const [response, auditResponse, timesheetsResponse, disputesResponse, overviewResponse, applicationsResponse, invitationsResponse, assignmentsResponse, attendanceResponse] = await Promise.all([
        fetch(`${apiUrl}/admin/overview`),
        fetch(`${apiUrl}/audit-events`),
        fetch(`${apiUrl}/timesheets`),
        fetch(`${apiUrl}/disputes`),
        fetch(`${apiUrl}/marketplace/overview`),
        fetch(`${apiUrl}/applications/me`),
        fetch(`${apiUrl}/invitations/me`),
        fetch(`${apiUrl}/assignments/me`),
        fetch(`${apiUrl}/attendance`)
      ]);

      if (!response.ok) {
        throw new Error("Admin overview request failed");
      }

      const result = (await response.json()) as AdminOverview;
      setOverview(result);
      setAuditEvents(auditResponse.ok ? ((await auditResponse.json()) as AdminMarketplaceRecord[]) : []);
      setTimesheets(timesheetsResponse.ok ? ((await timesheetsResponse.json()) as AdminMarketplaceRecord[]) : []);
      setDisputes(disputesResponse.ok ? ((await disputesResponse.json()) as AdminMarketplaceRecord[]) : []);
      setMarketplaceOverview(overviewResponse.ok ? ((await overviewResponse.json()) as MarketplaceOverview) : emptyMarketplaceOverview);
      setApplications(applicationsResponse.ok ? ((await applicationsResponse.json()) as AdminMarketplaceRecord[]) : []);
      setInvitations(invitationsResponse.ok ? ((await invitationsResponse.json()) as AdminMarketplaceRecord[]) : []);
      setAssignments(assignmentsResponse.ok ? ((await assignmentsResponse.json()) as AdminMarketplaceRecord[]) : []);
      setAttendanceEvents(attendanceResponse.ok ? ((await attendanceResponse.json()) as AdminMarketplaceRecord[]) : []);
      setMessage("Live admin data loaded.");
    } catch {
      setOverview(emptyOverview);
      setAuditEvents([]);
      setApplications([]);
      setInvitations([]);
      setAssignments([]);
      setAttendanceEvents([]);
      setDisputes([]);
      setTimesheets([]);
      setMarketplaceOverview(emptyMarketplaceOverview);
      setMessage("Live admin data is unavailable. Check API connectivity or sign in again, then refresh.");
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const workerQueue = useMemo(() => overview.workers.filter(isWorkerPendingReview), [overview.workers]);
  const facilityQueue = useMemo(() => overview.facilities.filter(isFacilityPendingReview), [overview.facilities]);
  const visibleWorkerQueue = queueFilter === "all" || queueFilter === "workers" ? workerQueue : [];
  const visibleFacilityQueue = queueFilter === "all" || queueFilter === "facilities" ? facilityQueue : [];
  const filteredUsers = useMemo(
    () =>
      overview.users.filter((user) => {
        const matchesRole = userFilter === "all" || user.role === userFilter;
        const matchesSearch = !search || user.email.toLowerCase().includes(search.toLowerCase());

        return matchesRole && matchesSearch;
      }),
    [overview.users, search, userFilter]
  );
  const filteredFacilities = useMemo(
    () => overview.facilities.filter((facility) => `${facility.name} ${facility.contactPerson?.email ?? ""}`.toLowerCase().includes(search.toLowerCase())),
    [overview.facilities, search]
  );
  const filteredShifts = useMemo(
    () => overview.shifts.filter((shift) => (shiftFilter === "all" || shift.status === shiftFilter) && `${shift.roleRequired} ${shift.description ?? ""}`.toLowerCase().includes(search.toLowerCase())),
    [overview.shifts, search, shiftFilter]
  );

  async function updateUserStatus(user: AdminUser, status: AccountStatus) {
    const updated = await adminPatch<AdminUser>(apiUrl, `admin/users/${user.id}/status`, { status });

    if (!updated) {
      setMessage("User status update failed.");
      return;
    }

    setOverview((current) => ({
      ...current,
      users: current.users.map((item) => (item.id === updated.id ? { ...item, ...updated } : item))
    }));
    setMessage(`${updated.email} is now ${updated.status.toLowerCase()}.`);
  }

  async function updateShiftStatus(shift: AdminShift, status: ShiftStatus) {
    const updated = await adminPatch<AdminShift>(apiUrl, `admin/shifts/${shift.id}/status`, { status });

    if (!updated) {
      setMessage("Shift status update failed.");
      return;
    }

    setOverview((current) => ({
      ...current,
      shifts: current.shifts.map((item) => (item.id === updated.id ? { ...item, ...updated } : item))
    }));
    setMessage(`Shift moved to ${updated.status.toLowerCase().replaceAll("_", " ")}.`);
  }

  async function reviewDocument(worker: AdminWorker, documentId: string, approved: boolean) {
    const updated = await adminPatch<AdminWorker>(apiUrl, `admin/worker-profiles/${worker.id}/documents/${documentId}`, {
      approved,
      ...(!approved ? { rejectionReason: rejectionReasons[`worker-${worker.id}`]?.trim() || "Document was not approved" } : {})
    });
    if (!updated) { setMessage("Document review failed."); return; }
    setOverview((current) => ({ ...current, workers: current.workers.map((item) => (item.id === updated.id ? updated : item)) }));
    setMessage(approved ? "Document approved." : "Document rejected.");
  }

  async function viewDocument(worker: AdminWorker, documentId: string) {
    const response = await fetch(`${apiUrl}/uploads/worker-documents/${worker.id}/${documentId}/access-url`);
    const result = response.ok ? await response.json() as { url?: string } : {};
    if (!result.url) { setMessage("Document could not be opened."); return; }
    window.open(result.url, "_blank", "noopener,noreferrer");
  }

  async function reviewWorkerOnboarding(worker: AdminWorker, approved: boolean) {
    const reasonKey = `worker-${worker.id}`;
    const rejectedReason = rejectionReasons[reasonKey]?.trim();

    if (!approved && !rejectedReason) {
      setMessage("Add a rejection reason before rejecting worker onboarding.");
      return;
    }

    const updated = await adminPatch<AdminWorker>(apiUrl, `admin/worker-profiles/${worker.id}/onboarding`, { approved, rejectedReason });

    if (!updated) {
      setMessage("Worker onboarding review failed.");
      return;
    }

    setOverview((current) => ({
      ...current,
      workers: current.workers.map((item) => (item.id === updated.id ? updated : item))
    }));
    setMessage(approved ? "Worker onboarding approved and email sent." : "Worker onboarding rejected and email sent.");
  }

  async function reviewFacilityOnboarding(facility: AdminFacility, approved: boolean) {
    const reasonKey = `facility-${facility.id}`;
    const rejectedReason = rejectionReasons[reasonKey]?.trim();

    if (!approved && !rejectedReason) {
      setMessage("Add a rejection reason before rejecting facility registration.");
      return;
    }

    const updated = await adminPatch<AdminFacility>(apiUrl, `admin/facility-profiles/${facility.id}/onboarding`, { approved, rejectedReason });

    if (!updated) {
      setMessage("Facility onboarding review failed.");
      return;
    }

    setOverview((current) => ({
      ...current,
      facilities: current.facilities.map((item) => (item.id === updated.id ? updated : item))
    }));
    setMessage(approved ? "Facility registration approved and email sent." : "Facility registration rejected and email sent.");
  }

  return (
    <DashboardShell
      className="admin-shell"
      eyebrow={<StatusBadge tone="navy">{isLoading ? "Syncing" : "Live operations"}</StatusBadge>}
      navItems={[
        { label: "Overview", active: activeSection === "overview", onClick: () => setActiveSection("overview") },
        { label: "Verification", active: activeSection === "verification", onClick: () => setActiveSection("verification") },
        { label: "Users", active: activeSection === "users", onClick: () => setActiveSection("users") },
        { label: "Facilities", active: activeSection === "facilities", onClick: () => setActiveSection("facilities") },
        { label: "Shifts", active: activeSection === "shifts", onClick: () => setActiveSection("shifts") },
        { label: "Marketplace", active: activeSection === "marketplace", onClick: () => setActiveSection("marketplace") }
      ]}
      title={getAdminDashboardTitle(activeSection)}
      userLabel="Admin workspace"
    >
      <section className="workspace">
        <div className="admin-command-bar">
          <span className="admin-message">{message}</span>
        </div>

        <section className="metrics" aria-label="Platform metrics">
          <Metric label="Users" value={overview.metrics.totalUsers} detail={`${overview.metrics.totalWorkers} workers`} />
          <Metric label="Facilities" value={overview.metrics.totalFacilities} detail={`${facilityQueue.length} pending`} />
          <Metric label="Active shifts" value={overview.metrics.activeShifts} detail={`${overview.metrics.openShifts} open`} />
          <Metric label="Pending approvals" value={overview.metrics.pendingApprovals} detail={`${workerQueue.length + facilityQueue.length} in queue`} />
        </section>

        {activeSection === "overview" ? (
          <OverviewSection overview={overview} workerQueue={workerQueue} facilityQueue={facilityQueue} />
        ) : null}

        {activeSection === "verification" ? (
          <VerificationSection
            facilityQueue={facilityQueue}
            queueFilter={queueFilter}
            rejectionReasons={rejectionReasons}
            setQueueFilter={setQueueFilter}
            setRejectionReasons={setRejectionReasons}
            visibleFacilityQueue={visibleFacilityQueue}
            visibleWorkerQueue={visibleWorkerQueue}
            workerQueue={workerQueue}
            onDocumentReview={reviewDocument}
            onDocumentView={viewDocument}
            onFacilityReview={reviewFacilityOnboarding}
            onWorkerReview={reviewWorkerOnboarding}
          />
        ) : null}

        {activeSection === "users" ? (
          <UsersSection search={search} setSearch={setSearch} userFilter={userFilter} setUserFilter={setUserFilter} users={filteredUsers} onStatusChange={updateUserStatus} />
        ) : null}

        {activeSection === "facilities" ? (
          <FacilitiesSection facilities={filteredFacilities} search={search} setSearch={setSearch} />
        ) : null}

        {activeSection === "shifts" ? (
          <ShiftsSection search={search} setSearch={setSearch} shiftFilter={shiftFilter} setShiftFilter={setShiftFilter} shifts={filteredShifts} onStatusChange={updateShiftStatus} />
        ) : null}

        {activeSection === "marketplace" ? (
          <MarketplaceSection applications={applications} assignments={assignments} attendanceEvents={attendanceEvents} auditEvents={auditEvents} disputes={disputes} invitations={invitations} overview={marketplaceOverview} timesheets={timesheets} />
        ) : null}
      </section>
    </DashboardShell>
  );
}

function OverviewSection({ overview, workerQueue, facilityQueue }: { overview: AdminOverview; workerQueue: AdminWorker[]; facilityQueue: AdminFacility[] }) {
  const openUnmatchedShifts = overview.shifts.filter((shift) => shift.status === ShiftStatus.Open && !shift.matchedWorkerId);
  const pendingReviews = workerQueue.length + facilityQueue.length;
  const verifiedCapacityByRole = countBy(
    overview.workers.filter((worker) => worker.onboarding?.verificationStatus === OnboardingStatus.Approved && worker.backgroundCheck?.status === "PASSED"),
    (worker) => worker.title
  );
  const facilityDemandByRole = countBy(
    overview.shifts.filter((shift) => shift.status === ShiftStatus.Open || shift.status === ShiftStatus.Matched),
    (shift) => shift.roleRequired
  );
  const healthData = [
    { label: "Open load", value: Math.round(ratio(overview.metrics.openShifts, overview.metrics.activeShifts)) },
    { label: "Verified", value: Math.round(overview.metrics.verifiedWorkerRate) },
    { label: "Sockets", value: Math.round(Math.min(100, overview.metrics.activeSocketConnections * 10)) }
  ];

  return (
    <>
      <Card className="health-panel">
        <CardHeader>
          <CardTitle>Platform health</CardTitle>
          <CardDescription>Live operational indicators across shifts, verification, and realtime load.</CardDescription>
        </CardHeader>
        <CardContent>
          <SimpleBarChart data={healthData} dataKey="value" nameKey="label" valueLabel="Health score" />
        </CardContent>
      </Card>
      <section className="operations-grid" aria-label="Operational signals">
        <OperationsCard title="Unmatched open shifts" value={openUnmatchedShifts.length} detail="Need worker supply" items={openUnmatchedShifts.slice(0, 3).map((shift) => `${shift.roleRequired} · ${formatDate(shift.startTime)}`)} />
        <OperationsCard title="Pending reviews" value={pendingReviews} detail="Worker and facility approvals" items={[`${workerQueue.length} worker checks`, `${facilityQueue.length} facility checks`]} />
        <OperationsCard title="Verified capacity" value={sumRecord(verifiedCapacityByRole)} detail="Approved workers by role" items={recordItems(verifiedCapacityByRole)} />
        <OperationsCard title="Facility demand" value={sumRecord(facilityDemandByRole)} detail="Active shifts by role" items={recordItems(facilityDemandByRole)} />
        <OperationsCard title="Average fill time" value={formatFillTime(overview.metrics.averageFillTimeMinutes)} detail="Open to matched transition" items={["Computed from filled shifts"]} />
      </section>
      <section className="admin-grid">
        <Panel title="Action queue" badge={`${workerQueue.length + facilityQueue.length} pending`}>
          <div className="compact-list">
            {[...facilityQueue.slice(0, 3).map((facility) => ({ id: facility.id, title: facility.name, meta: `Facility · ${facility.onboarding?.verificationStatus ?? "Pending"}` })), ...workerQueue.slice(0, 3).map((worker) => ({ id: worker.id, title: `${worker.firstName} ${worker.lastName}`, meta: `Worker · ${worker.backgroundCheck?.status ?? "Pending"}` }))].map((item) => (
              <article key={item.id}><strong>{item.title}</strong><span>{item.meta}</span></article>
            ))}
          </div>
        </Panel>
        <Panel title="Recent shifts" badge={`${overview.shifts.length} total`}>
          <div className="compact-list admin-shift-compact-list">
            {overview.shifts.slice(0, 6).map((shift) => (
              <article key={shift.id}>
                <div>
                  <strong>{shift.roleRequired} coverage</strong>
                  <span>{formatDate(shift.startTime)}</span>
                </div>
                <StatusBadge tone={statusTone(shift.status)}>{labelize(shift.status)}</StatusBadge>
              </article>
            ))}
          </div>
        </Panel>
      </section>
    </>
  );
}

function getAdminDashboardTitle(section: AdminSection) {
  if (section === "verification") {
    return "Verification workspace";
  }

  if (section === "users") {
    return "User management";
  }

  if (section === "facilities") {
    return "Facility management";
  }

  if (section === "shifts") {
    return "Shift operations";
  }

  if (section === "marketplace") {
    return "Marketplace oversight";
  }

  return "Admin overview";
}

function MarketplaceSection({
  applications,
  assignments,
  attendanceEvents,
  auditEvents,
  disputes,
  invitations,
  overview,
  timesheets
}: {
  applications: AdminMarketplaceRecord[];
  assignments: AdminMarketplaceRecord[];
  attendanceEvents: AdminMarketplaceRecord[];
  auditEvents: AdminMarketplaceRecord[];
  disputes: AdminMarketplaceRecord[];
  invitations: AdminMarketplaceRecord[];
  overview: MarketplaceOverview;
  timesheets: AdminMarketplaceRecord[];
}) {
  const marketplaceEvents = auditEvents.filter((event) => event.action?.startsWith("shift.") || event.action?.startsWith("attendance.") || event.action?.startsWith("timesheet.") || event.action?.startsWith("dispute."));

  return (
    <section className="admin-grid">
      <Panel title="Marketplace performance" badge={`${overview.activeAssignments} active`}>
        <div className="marketplace-performance-grid">
          <MarketplaceMetric title="Applications" value={overview.applications} detail={`${overview.pendingApplications} pending`} items={applications.slice(0, 2).map((item) => item.status ?? item.id)} />
          <MarketplaceMetric title="Invitations" value={overview.invitations} detail={`${overview.pendingInvitations} pending`} items={invitations.slice(0, 2).map((item) => item.status ?? item.id)} />
          <MarketplaceMetric title="Assignments" value={overview.assignments} detail={`${overview.activeAssignments} active`} items={assignments.slice(0, 2).map((item) => item.status ?? item.shiftId ?? item.id)} />
          <MarketplaceMetric title="Attendance" value={overview.attendanceEvents} detail="GPS events" items={attendanceEvents.slice(0, 2).map((item) => item.status ?? item.shiftId ?? item.id)} />
        </div>
      </Panel>
      <Panel title="Marketplace audit events" badge={`${marketplaceEvents.length} events`}>
        <div className="compact-list">
          {marketplaceEvents.slice(0, 12).map((event) => (
            <article key={event.id}>
              <strong>{labelize(event.action ?? "event")}</strong>
              <span>{event.entityType ?? "Marketplace"} · {event.entityId ?? "No entity"} · {event.createdAt ? formatDate(event.createdAt) : "Live"}</span>
            </article>
          ))}
          {!marketplaceEvents.length ? <article><strong>No marketplace audit events</strong><span>Applications, invitations, assignments, attendance, timesheets, and disputes will appear here as live actions happen.</span></article> : null}
        </div>
      </Panel>
      <Panel title="Timesheet oversight" badge={`${timesheets.length} records`}>
        <div className="compact-list">
          {timesheets.slice(0, 8).map((timesheet) => (
            <article key={timesheet.id}>
              <strong>{timesheet.status ?? "SUBMITTED"}</strong>
              <span>{timesheet.shiftId ?? "Shift pending"} · {timesheet.workedMinutes ?? 0} minutes</span>
            </article>
          ))}
          {!timesheets.length ? <article><strong>No live timesheets</strong><span>Submitted worker timesheets will appear here.</span></article> : null}
        </div>
      </Panel>
      <Panel title="Dispute oversight" badge={`${disputes.length} cases`}>
        <div className="compact-list">
          {disputes.slice(0, 8).map((dispute) => (
            <article key={dispute.id}>
              <strong>{dispute.status ?? "OPEN"}</strong>
              <span>{dispute.reason ?? "No reason supplied"} · {dispute.shiftId ?? dispute.entityId ?? "No linked record"}</span>
            </article>
          ))}
          {!disputes.length ? <article><strong>No live disputes</strong><span>Shift, timesheet, and review disputes will appear here.</span></article> : null}
        </div>
      </Panel>
    </section>
  );
}

function MarketplaceMetric({ detail, items, title, value }: { detail: string; items: string[]; title: string; value: number | string }) {
  return (
    <article className="marketplace-metric-card">
      <div>
        <span>{title}</span>
        <strong>{value}</strong>
      </div>
      <small>{detail}</small>
      <div className="marketplace-metric-items">
        {items.length ? items.map((item) => <em key={item}>{item}</em>) : <em>No active signals</em>}
      </div>
    </article>
  );
}

function OperationsCard({ detail, items, title, value }: { detail: string; items: string[]; title: string; value: number | string }) {
  return (
    <article>
      <span>{title}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
      <div>
        {items.length ? items.map((item) => <em key={item}>{item}</em>) : <em>No active signals</em>}
      </div>
    </article>
  );
}

function VerificationSection(props: {
  facilityQueue: AdminFacility[];
  queueFilter: "all" | "workers" | "facilities";
  rejectionReasons: Record<string, string>;
  setQueueFilter: (filter: "all" | "workers" | "facilities") => void;
  setRejectionReasons: (updater: (current: Record<string, string>) => Record<string, string>) => void;
  visibleFacilityQueue: AdminFacility[];
  visibleWorkerQueue: AdminWorker[];
  workerQueue: AdminWorker[];
  onDocumentReview: (worker: AdminWorker, documentId: string, approved: boolean) => void;
  onDocumentView: (worker: AdminWorker, documentId: string) => void;
  onFacilityReview: (facility: AdminFacility, approved: boolean) => void;
  onWorkerReview: (worker: AdminWorker, approved: boolean) => void;
}) {
  return (
    <Panel title="Verification queue" badge={`${props.workerQueue.length + props.facilityQueue.length} pending`}>
      <FilterSelect
        id="verification-filter"
        label="Queue"
        value={props.queueFilter}
        onChange={(value) => props.setQueueFilter(value as "all" | "workers" | "facilities")}
        options={[
          { label: "All reviews", value: "all" },
          { label: "Workers", value: "workers" },
          { label: "Facilities", value: "facilities" }
        ]}
      />
      <div className="verification-list">
        {props.visibleFacilityQueue.map((facility) => (
          <article key={facility.id}>
            <div><strong>{facility.name}</strong><span>{facility.facilityType ?? "Facility"} · {facility.billingStatus} billing · {facility.contactPerson?.email ?? "Contact pending"}</span></div>
            <ActionRow label={`Registration · ${facility.onboarding?.verificationStatus ?? "Pending"}`} onApprove={() => props.onFacilityReview(facility, true)} onReject={() => props.onFacilityReview(facility, false)} />
            <ReasonInput id={`facility-${facility.id}`} rejectionReasons={props.rejectionReasons} setRejectionReasons={props.setRejectionReasons} />
          </article>
        ))}
        {props.visibleWorkerQueue.map((worker) => (
          <article key={worker.id}>
            <div><strong>{worker.firstName} {worker.lastName}</strong><span>{worker.title} · Background {worker.backgroundCheck?.status ?? "Pending"}</span></div>
            {worker.documents.map((document) => (
              <ActionRow key={document.id} label={`${formatDocumentCategory(document.category)} · ${document.verificationStatus ?? "Pending"}`} onView={() => props.onDocumentView(worker, document.id)} onApprove={() => props.onDocumentReview(worker, document.id, true)} onReject={() => props.onDocumentReview(worker, document.id, false)} />
            ))}
            <ActionRow label={`Onboarding · ${worker.onboarding?.verificationStatus ?? "Pending"}`} onApprove={() => props.onWorkerReview(worker, true)} onReject={() => props.onWorkerReview(worker, false)} approveLabel="Approve onboarding" rejectLabel="Reject onboarding" />
            <ReasonInput id={`worker-${worker.id}`} rejectionReasons={props.rejectionReasons} setRejectionReasons={props.setRejectionReasons} />
          </article>
        ))}
      </div>
    </Panel>
  );
}

function UsersSection(props: {
  search: string;
  setSearch: (value: string) => void;
  userFilter: "all" | UserRole;
  setUserFilter: (value: "all" | UserRole) => void;
  users: AdminUser[];
  onStatusChange: (user: AdminUser, status: AccountStatus) => void;
}) {
  return (
    <Panel title="User management" badge={`${props.users.length} records`}>
      <TableToolbar search={props.search} setSearch={props.setSearch} placeholder="Search users" />
      <FilterSelect
        id="user-role-filter"
        label="Role"
        value={props.userFilter}
        onChange={(value) => props.setUserFilter(value as "all" | UserRole)}
        options={(["all", UserRole.Worker, UserRole.Facility, UserRole.Admin] as const).map((role) => ({ label: role === "all" ? "All roles" : labelize(role), value: role }))}
      />
      <div className="table-scroll">
        <Table>
          <TableHeader><TableRow><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead>Email</TableHead><TableHead>Created</TableHead><TableHead>Manage</TableHead></TableRow></TableHeader>
          <TableBody>
            {props.users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.email}</TableCell>
                <TableCell>{user.role}</TableCell>
                <TableCell><StatusBadge tone={user.status === AccountStatus.Active ? "green" : user.status === AccountStatus.Suspended ? "red" : "gold"}>{user.status}</StatusBadge></TableCell>
                <TableCell>{user.emailVerified ? "Verified" : "Unverified"}</TableCell>
                <TableCell>{user.createdAt ? formatDate(user.createdAt) : "Pending"}</TableCell>
                <TableCell>
                  <Select value={user.status} onValueChange={(value) => props.onStatusChange(user, value as AccountStatus)}>
                    <SelectTrigger aria-label={`Manage ${user.email} status`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(AccountStatus).map((status) => <SelectItem key={status} value={status}>{labelize(status)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Panel>
  );
}

function FacilitiesSection({ facilities, search, setSearch }: { facilities: AdminFacility[]; search: string; setSearch: (value: string) => void }) {
  return (
    <Panel title="Facility management" badge={`${facilities.length} facilities`}>
      <TableToolbar search={search} setSearch={setSearch} placeholder="Search facilities" />
      <div className="facility-grid">
        {facilities.map((facility) => (
          <article key={facility.id}>
            <strong>{facility.name}</strong>
            <span>{facility.facilityType ?? "Care facility"} · {facility.billingStatus}</span>
            <span>{[facility.address?.street, facility.address?.city, facility.address?.province].filter(Boolean).join(", ") || "Address pending"}</span>
            <span>{facility.contactPerson?.name ?? "Contact pending"} · {facility.contactPerson?.email ?? "Email pending"}</span>
            <StatusBadge tone={facility.onboarding?.verificationStatus === OnboardingStatus.Approved ? "green" : facility.onboarding?.verificationStatus === OnboardingStatus.Rejected ? "red" : "gold"}>
              {facility.onboarding?.verificationStatus ?? "INCOMPLETE"}
            </StatusBadge>
          </article>
        ))}
      </div>
    </Panel>
  );
}

function ShiftsSection(props: {
  search: string;
  setSearch: (value: string) => void;
  shiftFilter: "all" | ShiftStatus;
  setShiftFilter: (value: "all" | ShiftStatus) => void;
  shifts: AdminShift[];
  onStatusChange: (shift: AdminShift, status: ShiftStatus) => void;
}) {
  return (
    <Panel title="Shift operations" badge={`${props.shifts.length} shifts`}>
      <TableToolbar search={props.search} setSearch={props.setSearch} placeholder="Search shifts" />
      <FilterSelect
        id="shift-status-filter"
        label="Status"
        value={props.shiftFilter}
        onChange={(value) => props.setShiftFilter(value as "all" | ShiftStatus)}
        options={(["all", ...Object.values(ShiftStatus)] as Array<"all" | ShiftStatus>).map((status) => ({ label: status === "all" ? "All statuses" : labelize(status), value: status }))}
      />
      <div className="table-scroll">
        <Table>
          <TableHeader><TableRow><TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead>Rate</TableHead><TableHead>Window</TableHead><TableHead>Matched</TableHead><TableHead>Manage</TableHead></TableRow></TableHeader>
          <TableBody>
            {props.shifts.map((shift) => (
              <TableRow className="admin-shift-row" key={shift.id}>
                <TableCell>
                  <div className="admin-shift-role-cell">
                    <strong>{shift.roleRequired}</strong>
                    <span>{shift.description || "Shift coverage"}</span>
                  </div>
                </TableCell>
                <TableCell><StatusBadge tone={statusTone(shift.status)}>{labelize(shift.status)}</StatusBadge></TableCell>
                <TableCell>
                  <div className="admin-shift-rate-cell">
                    <strong>${shift.hourlyRate}/hr</strong>
                    <span>{shift.endTime ? `${calculateAdminShiftHours(shift)} hr shift` : "Duration pending"}</span>
                  </div>
                </TableCell>
                <TableCell>{formatDate(shift.startTime)}{shift.endTime ? ` - ${formatDate(shift.endTime)}` : ""}</TableCell>
                <TableCell><span className={shift.matchedWorkerId ? "admin-match-pill matched" : "admin-match-pill"}>{shift.matchedWorkerId ? "Matched" : "Unfilled"}</span></TableCell>
                <TableCell>
                  <Select value={shift.status} onValueChange={(value) => props.onStatusChange(shift, value as ShiftStatus)}>
                    <SelectTrigger className="admin-shift-status-select" aria-label={`Manage ${shift.roleRequired} shift status`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(ShiftStatus).map((status) => <SelectItem key={status} value={status}>{labelize(status)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Panel>
  );
}

function Metric({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <Card className="metric-card">
      <CardContent>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </CardContent>
    </Card>
  );
}

function Panel({ badge, children, title }: { badge: string; children: ReactNode; title: string }) {
  return (
    <Card className="table-panel">
      <CardHeader className="panel-title">
        <CardTitle>{title}</CardTitle>
        <StatusBadge tone="gold">{badge}</StatusBadge>
      </CardHeader>
      {children}
    </Card>
  );
}

function TableToolbar({ placeholder, search, setSearch }: { placeholder: string; search: string; setSearch: (value: string) => void }) {
  return <div className="table-toolbar"><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={placeholder} /></div>;
}

function FilterSelect({ id, label, onChange, options, value }: { id: string; label: string; onChange: (value: string) => void; options: Array<{ label: string; value: string }>; value: string }) {
  return (
    <div className="admin-filter-row">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
        ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ActionRow({ approveLabel = "Approve", label, onApprove, onReject, onView, rejectLabel = "Reject" }: { approveLabel?: string; label: string; onApprove: () => void; onReject: () => void; onView?: () => void; rejectLabel?: string }) {
  return (
    <div className="credential-actions">
      <span>{label}{onView ? <button className="document-link-button" type="button" onClick={onView}>Open document</button> : null}</span>
      <Button type="button" size="sm" onClick={onApprove}>{approveLabel}</Button>
      <Button type="button" size="sm" variant="secondary" onClick={onReject}>{rejectLabel}</Button>
    </div>
  );
}

function ReasonInput({ id, rejectionReasons, setRejectionReasons }: { id: string; rejectionReasons: Record<string, string>; setRejectionReasons: (updater: (current: Record<string, string>) => Record<string, string>) => void }) {
  return <Textarea className="rejection-input" maxLength={280} onChange={(event) => setRejectionReasons((current) => ({ ...current, [id]: event.target.value }))} placeholder="Reason required when rejecting" value={rejectionReasons[id] ?? ""} />;
}

async function adminPatch<T>(apiUrl: string, path: string, body: unknown): Promise<T | null> {
  const response = await fetch(`${apiUrl}/${path}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  return response.ok ? response.json() : null;
}

function isWorkerPendingReview(worker: AdminWorker) {
  return worker.onboarding?.verificationStatus === OnboardingStatus.PendingReview || worker.backgroundCheck?.status !== "PASSED" || worker.documents.some((document) => document.verificationStatus !== "VERIFIED");
}

function formatDocumentCategory(category: WorkerDocumentCategory) {
  return category.split("_").map((part) => part.charAt(0) + part.slice(1).toLowerCase()).join(" ");
}

function isFacilityPendingReview(facility: AdminFacility) {
  return facility.onboarding?.verificationStatus === OnboardingStatus.PendingReview;
}

function ratio(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0;
}

function countBy<T>(items: T[], getKey: (item: T) => string) {
  return items.reduce<Record<string, number>>((counts, item) => {
    const key = getKey(item);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function sumRecord(record: Record<string, number>) {
  return Object.values(record).reduce((sum, value) => sum + value, 0);
}

function recordItems(record: Record<string, number>) {
  return Object.entries(record)
    .sort((first, second) => second[1] - first[1])
    .slice(0, 4)
    .map(([key, value]) => `${labelize(key)} · ${value}`);
}

function formatFillTime(value: number | null) {
  if (value === null) {
    return "Pending";
  }

  if (value < 60) {
    return `${Math.round(value)}m`;
  }

  return `${(value / 60).toFixed(1)}h`;
}

function calculateAdminShiftHours(shift: AdminShift) {
  if (!shift.endTime) {
    return 0;
  }

  const hours = (new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime()) / 3_600_000;
  return Math.max(1, Math.round(hours));
}

function statusTone(status: ShiftStatus): "gold" | "green" | "navy" | "red" {
  if (status === ShiftStatus.Cancelled) {
    return "red";
  }

  if (status === ShiftStatus.Open) {
    return "gold";
  }

  if (status === ShiftStatus.Completed) {
    return "green";
  }

  return "navy";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", hour: "numeric" }).format(new Date(value));
}

function labelize(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/^\w/, (match) => match.toUpperCase());
}
