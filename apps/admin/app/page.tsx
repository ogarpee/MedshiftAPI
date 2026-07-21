"use client";

import { useEffect, useMemo, useState } from "react";
import { AccountStatus, ClinicalRole, FacilityType, ShiftStatus, UserRole } from "@medshift/shared-types";
import { MedShiftLogo, StatusBadge } from "@medshift/ui-components";

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
  createdAt?: string;
};

type AdminFacility = {
  id: string;
  name: string;
  facilityType?: FacilityType;
  billingStatus: string;
  address?: { city?: string; province?: string };
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
      credentials: [{ type: "HCA certificate", isVerified: false }]
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
    { id: "f1", name: "Bow Valley Care Centre", facilityType: FacilityType.LongTermCare, billingStatus: "ACTIVE", address: { city: "Calgary", province: "AB" } },
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

  return (
    <main className="admin-shell">
      <aside>
        <MedShiftLogo />
        <nav>
          <button type="button" className={activeTable === "users" ? "active" : ""} onClick={() => setActiveTable("users")}>
            Users
          </button>
          <button type="button" className={activeTable === "facilities" ? "active" : ""} onClick={() => setActiveTable("facilities")}>
            Facilities
          </button>
          <button type="button" className={activeTable === "shifts" ? "active" : ""} onClick={() => setActiveTable("shifts")}>
            Shifts
          </button>
        </nav>
      </aside>

      <section className="workspace">
        <header>
          <div>
            <StatusBadge tone="navy">Platform monitoring</StatusBadge>
            <h1>Operations overview</h1>
          </div>
          <span className="admin-message">{message}</span>
        </header>

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

        <section className="table-panel verification-panel">
          <div className="panel-title">
            <h2>Verification queue</h2>
            <StatusBadge tone="gold">{queue.length} pending</StatusBadge>
          </div>
          <div className="verification-list">
            {queue.map((worker) => (
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
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
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
