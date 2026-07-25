"use client";

import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { AccountStatus, ClinicalRole, FacilityType, OnboardingStatus, ShiftStatus, UserRole } from "@medshift/shared-types";
import { DashboardShell, StatusBadge } from "@medshift/ui-components";

type AdminSection = "overview" | "verification" | "users" | "facilities" | "shifts";

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
  credentials: Array<{ type?: string; documentUrl?: string; isVerified: boolean; verifiedAt?: string }>;
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

const previewOverview: AdminOverview = {
  users: [
    { id: "u1", email: "sarah@demo.medshift", role: UserRole.Worker, status: AccountStatus.Pending, emailVerified: true },
    { id: "u2", email: "ops@bowvalley.ca", role: UserRole.Facility, status: AccountStatus.Active, emailVerified: true },
    { id: "u3", email: "admin@medshift.ca", role: UserRole.Admin, status: AccountStatus.Active, emailVerified: true }
  ],
  workers: [
    {
      id: "w1",
      firstName: "Sarah",
      lastName: "Jensen",
      title: ClinicalRole.Hca,
      backgroundCheck: { status: "PENDING" },
      credentials: [{ type: "HCA certificate", documentUrl: "#", isVerified: false }],
      onboarding: { verificationStatus: OnboardingStatus.PendingReview }
    },
    {
      id: "w2",
      firstName: "Michael",
      lastName: "Tran",
      title: ClinicalRole.Rn,
      backgroundCheck: { status: "PASSED" },
      credentials: [{ type: "RN license", isVerified: true }],
      onboarding: { verificationStatus: OnboardingStatus.Approved }
    }
  ],
  facilities: [
    {
      id: "f1",
      name: "Bow Valley Care Centre",
      facilityType: FacilityType.LongTermCare,
      billingStatus: "ACTIVE",
      address: { city: "Calgary", province: "AB" },
      contactPerson: { name: "Amara Singh", email: "ops@bowvalley.ca" },
      onboarding: { verificationStatus: OnboardingStatus.PendingReview }
    },
    { id: "f2", name: "Prairie North Hospital", facilityType: FacilityType.Hospital, billingStatus: "INACTIVE", address: { city: "Calgary", province: "AB" } }
  ],
  shifts: [
    { id: "s1", roleRequired: ClinicalRole.Hca, status: ShiftStatus.Open, hourlyRate: 34, startTime: new Date().toISOString() },
    { id: "s2", roleRequired: ClinicalRole.Rn, status: ShiftStatus.Matched, hourlyRate: 52, startTime: new Date().toISOString(), matchedWorkerId: "w2" }
  ],
  metrics: {
    totalUsers: 3,
    totalFacilities: 2,
    totalWorkers: 2,
    activeShifts: 2,
    openShifts: 1,
    completedShifts: 18,
    pendingApprovals: 2,
    verifiedWorkerRate: 50,
    activeSocketConnections: 0,
    averageFillTimeMinutes: null
  }
};

export default function AdminPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  const [overview, setOverview] = useState<AdminOverview>(previewOverview);
  const [activeSection, setActiveSection] = useState<AdminSection>("overview");
  const [queueFilter, setQueueFilter] = useState<"all" | "workers" | "facilities">("all");
  const [userFilter, setUserFilter] = useState<"all" | UserRole>("all");
  const [shiftFilter, setShiftFilter] = useState<"all" | ShiftStatus>("all");
  const [search, setSearch] = useState("");
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("Showing preview data until an admin token is available.");
  const [isLoading, setIsLoading] = useState(false);

  const loadOverview = useCallback(async () => {
    const tokenFromHash = getAccessTokenFromHash(window.location.hash);

    if (tokenFromHash) {
      window.localStorage.setItem("medshift.accessToken", tokenFromHash);
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }

    const token = tokenFromHash ?? window.localStorage.getItem("medshift.accessToken");

    if (!token) {
      setMessage("Showing preview data. Sign in as an admin to manage live operations.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${apiUrl}/admin/overview`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error("Admin overview request failed");
      }

      const result = (await response.json()) as AdminOverview;
      setOverview(result);
      setMessage("Live admin data loaded.");
    } catch {
      setMessage("Showing preview data. Sign in as an admin to load live operations.");
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

  async function reviewCredential(worker: AdminWorker, credentialIndex: number, approved: boolean) {
    const updated = await adminPatch<AdminWorker>(apiUrl, `admin/worker-profiles/${worker.id}/credentials/${credentialIndex}`, { approved });

    if (!updated) {
      setMessage("Credential review failed.");
      return;
    }

    setOverview((current) => ({
      ...current,
      workers: current.workers.map((item) => (item.id === updated.id ? updated : item))
    }));
    setMessage(approved ? "Credential approved." : "Credential rejected.");
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

  function signOut() {
    window.localStorage.removeItem("medshift.accessToken");
    setOverview(previewOverview);
    setMessage("Signed out. Showing preview data.");
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
        { label: "Shifts", active: activeSection === "shifts", onClick: () => setActiveSection("shifts") }
      ]}
      title="Admin console"
      userLabel="Admin workspace"
    >
      <section className="workspace">
        <div className="admin-command-bar">
          <span className="admin-message">{message}</span>
          <div>
            <button type="button" onClick={() => void loadOverview()} disabled={isLoading}>{isLoading ? "Refreshing" : "Refresh"}</button>
            <button className="secondary-action" type="button" onClick={signOut}>Sign out</button>
          </div>
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
            onCredentialReview={reviewCredential}
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
      </section>
    </DashboardShell>
  );
}

function OverviewSection({ overview, workerQueue, facilityQueue }: { overview: AdminOverview; workerQueue: AdminWorker[]; facilityQueue: AdminFacility[] }) {
  return (
    <>
      <section className="health-panel">
        <HealthBar label="Open shift load" value={ratio(overview.metrics.openShifts, overview.metrics.activeShifts)} />
        <HealthBar label="Worker verification" value={overview.metrics.verifiedWorkerRate} />
        <HealthBar label="Socket activity" value={Math.min(100, overview.metrics.activeSocketConnections * 10)} />
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
          <div className="compact-list">
            {overview.shifts.slice(0, 6).map((shift) => (
              <article key={shift.id}><strong>{shift.roleRequired} · ${shift.hourlyRate}/hr</strong><span>{shift.status} · {formatDate(shift.startTime)}</span></article>
            ))}
          </div>
        </Panel>
      </section>
    </>
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
  onCredentialReview: (worker: AdminWorker, credentialIndex: number, approved: boolean) => void;
  onFacilityReview: (facility: AdminFacility, approved: boolean) => void;
  onWorkerReview: (worker: AdminWorker, approved: boolean) => void;
}) {
  return (
    <Panel title="Verification queue" badge={`${props.workerQueue.length + props.facilityQueue.length} pending`}>
      <div className="queue-filter" aria-label="Verification queue filter">
        {(["all", "workers", "facilities"] as const).map((filter) => (
          <button className={props.queueFilter === filter ? "active" : ""} type="button" key={filter} onClick={() => props.setQueueFilter(filter)}>{labelize(filter)}</button>
        ))}
      </div>
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
            {worker.credentials.map((credential, index) => (
              <ActionRow key={`${worker.id}-${index}`} label={`${credential.type ?? "Credential"} · ${credential.isVerified ? "Verified" : "Pending"}`} documentUrl={credential.documentUrl} onApprove={() => props.onCredentialReview(worker, index, true)} onReject={() => props.onCredentialReview(worker, index, false)} />
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
      <div className="queue-filter">
        {(["all", UserRole.Worker, UserRole.Facility, UserRole.Admin] as const).map((role) => (
          <button key={role} type="button" className={props.userFilter === role ? "active" : ""} onClick={() => props.setUserFilter(role)}>{labelize(role)}</button>
        ))}
      </div>
      <div className="table-scroll">
        <table>
          <thead><tr><th>Email</th><th>Role</th><th>Status</th><th>Email</th><th>Created</th><th>Manage</th></tr></thead>
          <tbody>
            {props.users.map((user) => (
              <tr key={user.id}>
                <td>{user.email}</td>
                <td>{user.role}</td>
                <td><StatusBadge tone={user.status === AccountStatus.Active ? "green" : user.status === AccountStatus.Suspended ? "red" : "gold"}>{user.status}</StatusBadge></td>
                <td>{user.emailVerified ? "Verified" : "Unverified"}</td>
                <td>{user.createdAt ? formatDate(user.createdAt) : "Preview"}</td>
                <td>
                  <select value={user.status} onChange={(event) => props.onStatusChange(user, event.target.value as AccountStatus)}>
                    {Object.values(AccountStatus).map((status) => <option key={status} value={status}>{labelize(status)}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
      <div className="queue-filter">
        {(["all", ...Object.values(ShiftStatus)] as Array<"all" | ShiftStatus>).map((status) => (
          <button key={status} type="button" className={props.shiftFilter === status ? "active" : ""} onClick={() => props.setShiftFilter(status)}>{labelize(status)}</button>
        ))}
      </div>
      <div className="table-scroll">
        <table>
          <thead><tr><th>Role</th><th>Status</th><th>Rate</th><th>Window</th><th>Matched</th><th>Manage</th></tr></thead>
          <tbody>
            {props.shifts.map((shift) => (
              <tr key={shift.id}>
                <td>{shift.roleRequired}</td>
                <td><StatusBadge tone={shift.status === ShiftStatus.Open ? "green" : shift.status === ShiftStatus.Cancelled ? "red" : "gold"}>{shift.status}</StatusBadge></td>
                <td>${shift.hourlyRate}/hr</td>
                <td>{formatDate(shift.startTime)}{shift.endTime ? ` - ${formatDate(shift.endTime)}` : ""}</td>
                <td>{shift.matchedWorkerId ? "Matched" : "Unfilled"}</td>
                <td>
                  <select value={shift.status} onChange={(event) => props.onStatusChange(shift, event.target.value as ShiftStatus)}>
                    {Object.values(ShiftStatus).map((status) => <option key={status} value={status}>{labelize(status)}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function Metric({ label, value, detail }: { label: string; value: number; detail: string }) {
  return <article><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

function Panel({ badge, children, title }: { badge: string; children: ReactNode; title: string }) {
  return (
    <section className="table-panel">
      <div className="panel-title"><h2>{title}</h2><StatusBadge tone="gold">{badge}</StatusBadge></div>
      {children}
    </section>
  );
}

function TableToolbar({ placeholder, search, setSearch }: { placeholder: string; search: string; setSearch: (value: string) => void }) {
  return <div className="table-toolbar"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={placeholder} /></div>;
}

function HealthBar({ label, value }: { label: string; value: number }) {
  return <div><span>{label}</span><div className="health-bar"><i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div></div>;
}

function ActionRow({ approveLabel = "Approve", documentUrl, label, onApprove, onReject, rejectLabel = "Reject" }: { approveLabel?: string; documentUrl?: string; label: string; onApprove: () => void; onReject: () => void; rejectLabel?: string }) {
  return (
    <div className="credential-actions">
      <span>{label}{documentUrl ? <a href={documentUrl} target="_blank" rel="noreferrer">Open document</a> : null}</span>
      <button type="button" onClick={onApprove}>{approveLabel}</button>
      <button type="button" className="secondary-action" onClick={onReject}>{rejectLabel}</button>
    </div>
  );
}

function ReasonInput({ id, rejectionReasons, setRejectionReasons }: { id: string; rejectionReasons: Record<string, string>; setRejectionReasons: (updater: (current: Record<string, string>) => Record<string, string>) => void }) {
  return <input className="rejection-input" maxLength={280} onChange={(event) => setRejectionReasons((current) => ({ ...current, [id]: event.target.value }))} placeholder="Reason required when rejecting" value={rejectionReasons[id] ?? ""} />;
}

async function adminPatch<T>(apiUrl: string, path: string, body: unknown): Promise<T | null> {
  const token = window.localStorage.getItem("medshift.accessToken");

  if (!token) {
    return null;
  }

  const response = await fetch(`${apiUrl}/${path}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  return response.ok ? response.json() : null;
}

function getAccessTokenFromHash(hash: string) {
  if (!hash.startsWith("#")) {
    return null;
  }

  return new URLSearchParams(hash.slice(1)).get("access_token");
}

function isWorkerPendingReview(worker: AdminWorker) {
  return worker.onboarding?.verificationStatus === OnboardingStatus.PendingReview || worker.backgroundCheck?.status !== "PASSED" || worker.credentials.some((credential) => !credential.isVerified);
}

function isFacilityPendingReview(facility: AdminFacility) {
  return facility.onboarding?.verificationStatus === OnboardingStatus.PendingReview;
}

function ratio(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", hour: "numeric" }).format(new Date(value));
}

function labelize(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/^\w/, (match) => match.toUpperCase());
}
