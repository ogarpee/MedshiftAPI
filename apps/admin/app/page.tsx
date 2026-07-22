"use client";

import { useEffect, useMemo, useState } from "react";
import { AccountStatus, ClinicalRole, FacilityType, OnboardingStatus, ShiftStatus, UserRole } from "@medshift/shared-types";
import { DashboardShell, StatusBadge } from "@medshift/ui-components";

type AdminUser = {
  id: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
  createdAt?: string;
};

type AdminWorker = {
  id: string;
  firstName: string;
  lastName: string;
  title: ClinicalRole;
  backgroundCheck: { status: string };
  credentials: Array<{ type?: string; isVerified: boolean; verifiedAt?: string }>;
  onboarding?: { verificationStatus?: OnboardingStatus; rejectedReason?: string };
  createdAt?: string;
};

type AdminFacility = {
  id: string;
  name: string;
  facilityType?: FacilityType;
  billingStatus: string;
  address?: { city?: string; province?: string };
  contactPerson?: { name?: string; email?: string };
  onboarding?: { verificationStatus?: OnboardingStatus; rejectedReason?: string };
};

type AdminShift = {
  id: string;
  roleRequired: ClinicalRole;
  status: ShiftStatus;
  hourlyRate: number;
  startTime: string;
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
    { id: "u1", email: "sarah@demo.medshift", role: UserRole.Worker, status: AccountStatus.Pending },
    { id: "u2", email: "ops@bowvalley.ca", role: UserRole.Facility, status: AccountStatus.Active },
    { id: "u3", email: "admin@medshift.ca", role: UserRole.Admin, status: AccountStatus.Active }
  ],
  workers: [
    {
      id: "w1",
      firstName: "Sarah",
      lastName: "Jensen",
      title: ClinicalRole.Hca,
      backgroundCheck: { status: "PENDING" },
      credentials: [{ type: "HCA certificate", isVerified: false }],
      onboarding: { verificationStatus: OnboardingStatus.PendingReview }
    },
    {
      id: "w2",
      firstName: "Michael",
      lastName: "Tran",
      title: ClinicalRole.Rn,
      backgroundCheck: { status: "PASSED" },
      credentials: [{ type: "RN license", isVerified: true }]
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
    { id: "s2", roleRequired: ClinicalRole.Rn, status: ShiftStatus.Matched, hourlyRate: 52, startTime: new Date().toISOString() }
  ],
  metrics: {
    totalUsers: 3,
    totalFacilities: 2,
    totalWorkers: 2,
    activeShifts: 2,
    openShifts: 1,
    completedShifts: 18,
    pendingApprovals: 1,
    verifiedWorkerRate: 50,
    activeSocketConnections: 0,
    averageFillTimeMinutes: null
  }
};

export default function AdminPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  const [overview, setOverview] = useState<AdminOverview>(previewOverview);
  const [activeTable, setActiveTable] = useState<"users" | "facilities" | "shifts">("users");
  const [queueFilter, setQueueFilter] = useState<"all" | "workers" | "facilities">("all");
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("Showing preview data until an admin token is available.");

  useEffect(() => {
    const token = window.localStorage.getItem("medshift.accessToken");

    if (!token) {
      return;
    }

    fetch(`${apiUrl}/admin/overview`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((result: AdminOverview) => {
        setOverview(result);
        setMessage("Live admin data loaded.");
      })
      .catch(() => setMessage("Showing preview data. Sign in as an admin to load live operations."));
  }, [apiUrl]);

  const queue = useMemo(
    () =>
      overview.workers.filter(
        (worker) =>
          worker.backgroundCheck.status !== "PASSED" ||
          worker.credentials.some((credential) => !credential.isVerified)
      ),
    [overview.workers]
  );
  const facilityQueue = useMemo(
    () => overview.facilities.filter((facility) => facility.onboarding?.verificationStatus === OnboardingStatus.PendingReview),
    [overview.facilities]
  );
  const visibleWorkerQueue = queueFilter === "all" || queueFilter === "workers" ? queue : [];
  const visibleFacilityQueue = queueFilter === "all" || queueFilter === "facilities" ? facilityQueue : [];

  async function reviewCredential(worker: AdminWorker, credentialIndex: number, approved: boolean) {
    const token = window.localStorage.getItem("medshift.accessToken");

    if (!token) {
      setOverview((current) => ({
        ...current,
        workers: current.workers.map((item) =>
          item.id === worker.id
            ? {
                ...item,
                credentials: item.credentials.map((credential, index) =>
                  index === credentialIndex ? { ...credential, isVerified: approved } : credential
                ),
                backgroundCheck: { status: approved ? "PASSED" : item.backgroundCheck.status }
              }
            : item
        )
      }));
      setMessage("Preview credential action applied locally.");
      return;
    }

    const response = await fetch(`${apiUrl}/admin/worker-profiles/${worker.id}/credentials/${credentialIndex}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ approved })
    });

    if (response.ok) {
      const updated = (await response.json()) as AdminWorker;
      setOverview((current) => ({
        ...current,
        workers: current.workers.map((item) => (item.id === updated.id ? updated : item))
      }));
      setMessage(approved ? "Credential approved." : "Credential rejected.");
    } else {
      setMessage("Credential review failed.");
    }
  }

  async function reviewWorkerOnboarding(worker: AdminWorker, approved: boolean) {
    const reasonKey = `worker-${worker.id}`;
    const rejectedReason = rejectionReasons[reasonKey]?.trim();

    if (!approved && !rejectedReason) {
      setMessage("Add a rejection reason before rejecting worker onboarding.");
      return;
    }

    const token = window.localStorage.getItem("medshift.accessToken");

    if (!token) {
      setOverview((current) => ({
        ...current,
        workers: current.workers.map((item) =>
          item.id === worker.id
            ? {
                ...item,
                backgroundCheck: { status: approved ? "PASSED" : "FAILED" },
                credentials: item.credentials.map((credential) => ({ ...credential, isVerified: approved })),
                onboarding: {
                  rejectedReason: approved ? undefined : rejectedReason,
                  verificationStatus: approved ? OnboardingStatus.Approved : OnboardingStatus.Rejected
                }
              }
            : item
        )
      }));
      setMessage(approved ? "Preview worker onboarding approved." : "Preview worker onboarding rejected.");
      return;
    }

    const response = await fetch(`${apiUrl}/admin/worker-profiles/${worker.id}/onboarding`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ approved, rejectedReason })
    });

    if (response.ok) {
      const updated = (await response.json()) as AdminWorker;
      setOverview((current) => ({
        ...current,
        workers: current.workers.map((item) => (item.id === updated.id ? updated : item))
      }));
      setMessage(approved ? "Worker onboarding approved and email sent." : "Worker onboarding rejected and email sent.");
      return;
    }

    setMessage("Worker onboarding review failed.");
  }

  async function reviewFacilityOnboarding(facility: AdminFacility, approved: boolean) {
    const reasonKey = `facility-${facility.id}`;
    const rejectedReason = rejectionReasons[reasonKey]?.trim();

    if (!approved && !rejectedReason) {
      setMessage("Add a rejection reason before rejecting facility registration.");
      return;
    }

    const token = window.localStorage.getItem("medshift.accessToken");

    if (!token) {
      setOverview((current) => ({
        ...current,
        facilities: current.facilities.map((item) =>
          item.id === facility.id
            ? {
                ...item,
                billingStatus: approved ? "ACTIVE" : "INACTIVE",
                onboarding: {
                  rejectedReason: approved ? undefined : rejectedReason,
                  verificationStatus: approved ? OnboardingStatus.Approved : OnboardingStatus.Rejected
                }
              }
            : item
        )
      }));
      setMessage(approved ? "Preview facility registration approved." : "Preview facility registration rejected.");
      return;
    }

    const response = await fetch(`${apiUrl}/admin/facility-profiles/${facility.id}/onboarding`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ approved, rejectedReason })
    });

    if (response.ok) {
      const updated = (await response.json()) as AdminFacility;
      setOverview((current) => ({
        ...current,
        facilities: current.facilities.map((item) => (item.id === updated.id ? updated : item))
      }));
      setMessage(approved ? "Facility registration approved and email sent." : "Facility registration rejected and email sent.");
      return;
    }

    setMessage("Facility onboarding review failed.");
  }

  return (
    <DashboardShell
      className="admin-shell"
      eyebrow={<StatusBadge tone="navy">Platform monitoring</StatusBadge>}
      navItems={[
        { label: "Users", active: activeTable === "users", onClick: () => setActiveTable("users") },
        { label: "Facilities", active: activeTable === "facilities", onClick: () => setActiveTable("facilities") },
        { label: "Shifts", active: activeTable === "shifts", onClick: () => setActiveTable("shifts") },
        { label: "Verification", href: "#verification" }
      ]}
      title="Operations overview"
      userLabel="Admin workspace"
    >
      <section className="workspace">
        <span className="admin-message">{message}</span>

        <div className="metrics">
          <article>
            <span>Active shifts</span>
            <strong>{overview.metrics.activeShifts}</strong>
          </article>
          <article>
            <span>Verified workers</span>
            <strong>{overview.metrics.verifiedWorkerRate}%</strong>
          </article>
          <article>
            <span>Socket connections</span>
            <strong>{overview.metrics.activeSocketConnections}</strong>
          </article>
          <article>
            <span>Pending approvals</span>
            <strong>{overview.metrics.pendingApprovals}</strong>
          </article>
        </div>

        <section className="health-panel">
          <div>
            <span>Open shifts</span>
            <div className="health-bar"><i style={{ width: `${ratio(overview.metrics.openShifts, overview.metrics.activeShifts)}%` }} /></div>
          </div>
          <div>
            <span>Worker verification</span>
            <div className="health-bar"><i style={{ width: `${overview.metrics.verifiedWorkerRate}%` }} /></div>
          </div>
          <div>
            <span>Socket activity</span>
            <div className="health-bar"><i style={{ width: `${Math.min(100, overview.metrics.activeSocketConnections * 10)}%` }} /></div>
          </div>
        </section>

        <section className="table-panel">
          <div className="panel-title">
            <h2>{tableTitle(activeTable)}</h2>
            <StatusBadge tone="gold">{tableCount(overview, activeTable)} records</StatusBadge>
          </div>
          <AdminTable overview={overview} activeTable={activeTable} />
        </section>

        <section className="table-panel verification-panel" id="verification">
          <div className="panel-title">
            <h2>Verification queue</h2>
            <StatusBadge tone="gold">{queue.length + facilityQueue.length} pending</StatusBadge>
          </div>
          <div className="queue-filter" aria-label="Verification queue filter">
            <button className={queueFilter === "all" ? "active" : ""} type="button" onClick={() => setQueueFilter("all")}>
              All
            </button>
            <button className={queueFilter === "workers" ? "active" : ""} type="button" onClick={() => setQueueFilter("workers")}>
              Workers
            </button>
            <button className={queueFilter === "facilities" ? "active" : ""} type="button" onClick={() => setQueueFilter("facilities")}>
              Facilities
            </button>
          </div>
          <div className="verification-list">
            {visibleFacilityQueue.map((facility) => (
              <article key={facility.id}>
                <div>
                  <strong>{facility.name}</strong>
                  <span>{facility.facilityType ?? "Facility"} · {facility.billingStatus} billing · {facility.onboarding?.verificationStatus}</span>
                </div>
                <div className="credential-actions">
                  <span>{facility.contactPerson?.name ?? "Primary contact"} · {facility.contactPerson?.email ?? "Contact email pending"}</span>
                  <button type="button" onClick={() => reviewFacilityOnboarding(facility, true)}>Approve</button>
                  <button type="button" className="secondary-action" onClick={() => reviewFacilityOnboarding(facility, false)}>Reject</button>
                </div>
                <input
                  className="rejection-input"
                  maxLength={280}
                  onChange={(event) => setRejectionReasons((current) => ({ ...current, [`facility-${facility.id}`]: event.target.value }))}
                  placeholder="Reason required when rejecting"
                  value={rejectionReasons[`facility-${facility.id}`] ?? ""}
                />
              </article>
            ))}
            {visibleWorkerQueue.map((worker) => (
              <article key={worker.id}>
                <div>
                  <strong>{worker.firstName} {worker.lastName}</strong>
                  <span>{worker.title} · {worker.backgroundCheck.status}</span>
                </div>
                {worker.credentials.map((credential, index) => (
                  <div className="credential-actions" key={`${worker.id}-${index}`}>
                    <span>{credential.type ?? "Credential"} · {credential.isVerified ? "Verified" : "Pending"}</span>
                    <button type="button" onClick={() => reviewCredential(worker, index, true)}>Approve</button>
                    <button type="button" className="secondary-action" onClick={() => reviewCredential(worker, index, false)}>Reject</button>
                  </div>
                ))}
                <div className="credential-actions">
                  <span>Onboarding · {worker.onboarding?.verificationStatus ?? "Pending"}</span>
                  <button type="button" onClick={() => reviewWorkerOnboarding(worker, true)}>Approve onboarding</button>
                  <button type="button" className="secondary-action" onClick={() => reviewWorkerOnboarding(worker, false)}>Reject onboarding</button>
                </div>
                <input
                  className="rejection-input"
                  maxLength={280}
                  onChange={(event) => setRejectionReasons((current) => ({ ...current, [`worker-${worker.id}`]: event.target.value }))}
                  placeholder="Reason required when rejecting"
                  value={rejectionReasons[`worker-${worker.id}`] ?? ""}
                />
              </article>
            ))}
          </div>
        </section>
      </section>
    </DashboardShell>
  );
}

function AdminTable({ overview, activeTable }: { overview: AdminOverview; activeTable: "users" | "facilities" | "shifts" }) {
  if (activeTable === "facilities") {
    return (
      <table>
        <thead><tr><th>Facility</th><th>Type</th><th>Billing</th><th>Location</th></tr></thead>
        <tbody>
          {overview.facilities.map((facility) => (
            <tr key={facility.id}><td>{facility.name}</td><td>{facility.facilityType ?? "Unset"}</td><td>{facility.billingStatus}</td><td>{facility.address?.city ?? "Calgary"}</td></tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (activeTable === "shifts") {
    return (
      <table>
        <thead><tr><th>Role</th><th>Status</th><th>Rate</th><th>Start</th></tr></thead>
        <tbody>
          {overview.shifts.map((shift) => (
            <tr key={shift.id}><td>{shift.roleRequired}</td><td>{shift.status}</td><td>${shift.hourlyRate}/hr</td><td>{formatDate(shift.startTime)}</td></tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <table>
      <thead><tr><th>Email</th><th>Role</th><th>Status</th><th>Created</th></tr></thead>
      <tbody>
        {overview.users.map((user) => (
          <tr key={user.id}><td>{user.email}</td><td>{user.role}</td><td>{user.status}</td><td>{user.createdAt ? formatDate(user.createdAt) : "Preview"}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

function tableTitle(activeTable: "users" | "facilities" | "shifts") {
  return activeTable === "users" ? "Users" : activeTable === "facilities" ? "Facilities" : "Shifts";
}

function tableCount(overview: AdminOverview, activeTable: "users" | "facilities" | "shifts") {
  return activeTable === "users" ? overview.users.length : activeTable === "facilities" ? overview.facilities.length : overview.shifts.length;
}

function ratio(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", hour: "numeric" }).format(new Date(value));
}
