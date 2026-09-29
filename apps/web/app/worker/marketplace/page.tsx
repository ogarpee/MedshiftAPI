"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { AttendanceEventType, MatchedShiftSummary, NotificationSummary, ShiftInvitationStatus } from "@medshift/shared-types";
import { DashboardShell, StatusBadge } from "@medshift/ui-components";
import { Check, Clock, FileText, Send, ShieldAlert } from "lucide-react";
import { useDashboardNotifications } from "../../use-dashboard-notifications";

type MarketplaceRecord = {
  id: string;
  status?: string;
  message?: string;
  reason?: string;
  shiftId?: string;
  workedMinutes?: number;
};

export default function WorkerMarketplacePage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
  const {
    isLoadingNotifications,
    markAllNotificationsRead,
    markNotificationRead,
    notifications,
    unreadNotificationCount
  } = useDashboardNotifications(apiUrl);
  const [confirmedShifts, setConfirmedShifts] = useState<MatchedShiftSummary[]>([]);
  const [applications, setApplications] = useState<MarketplaceRecord[]>([]);
  const [disputes, setDisputes] = useState<MarketplaceRecord[]>([]);
  const [invitations, setInvitations] = useState<MarketplaceRecord[]>([]);
  const [message, setMessage] = useState("Loading live worker marketplace...");
  const [openShifts, setOpenShifts] = useState<MatchedShiftSummary[]>([]);
  const [timesheets, setTimesheets] = useState<MarketplaceRecord[]>([]);

  const loadMarketplace = useCallback(async () => {
    const token = window.localStorage.getItem("medshift.accessToken");

    if (!token) {
      setMessage("Sign in as a worker to use the marketplace.");
      setOpenShifts([]);
      setConfirmedShifts([]);
      setApplications([]);
      setInvitations([]);
      setTimesheets([]);
      setDisputes([]);
      return;
    }

    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [openResponse, workResponse, timesheetsResponse, disputesResponse, applicationsResponse, invitationsResponse] = await Promise.all([
        fetch(`${apiUrl}/matching/open-shifts?sort=START_TIME`, { headers }),
        fetch(`${apiUrl}/shifts/worker/me`, { headers }),
        fetch(`${apiUrl}/timesheets`, { headers }),
        fetch(`${apiUrl}/disputes`, { headers }),
        fetch(`${apiUrl}/applications/me`, { headers }),
        fetch(`${apiUrl}/invitations/me`, { headers })
      ]);

      if (!openResponse.ok || !workResponse.ok) {
        throw new Error("Unable to load live worker marketplace");
      }

      setOpenShifts((await openResponse.json()) as MatchedShiftSummary[]);
      setConfirmedShifts((await workResponse.json()) as MatchedShiftSummary[]);
      setTimesheets(timesheetsResponse.ok ? ((await timesheetsResponse.json()) as MarketplaceRecord[]) : []);
      setDisputes(disputesResponse.ok ? ((await disputesResponse.json()) as MarketplaceRecord[]) : []);
      setApplications(applicationsResponse.ok ? ((await applicationsResponse.json()) as MarketplaceRecord[]) : []);
      setInvitations(invitationsResponse.ok ? ((await invitationsResponse.json()) as MarketplaceRecord[]) : []);
      setMessage("Live worker marketplace connected.");
    } catch {
      setMessage("Live marketplace data is unavailable. Check the API connection and retry.");
      setOpenShifts([]);
      setConfirmedShifts([]);
      setApplications([]);
      setInvitations([]);
      setTimesheets([]);
      setDisputes([]);
    }
  }, [apiUrl]);

  useEffect(() => {
    void loadMarketplace();
  }, [loadMarketplace]);

  async function postAction(path: string, body: Record<string, unknown>, success: string) {
    const token = window.localStorage.getItem("medshift.accessToken");

    if (!token) {
      setMessage("Sign in as a worker to continue.");
      return;
    }

    const response = await fetch(`${apiUrl}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    setMessage(response.ok ? success : "Marketplace action failed. Review the live API response and retry.");
    await loadMarketplace();
  }

  async function patchAction(path: string, body: Record<string, unknown>, success: string) {
    const token = window.localStorage.getItem("medshift.accessToken");

    if (!token) {
      setMessage("Sign in as a worker to continue.");
      return;
    }

    const response = await fetch(`${apiUrl}${path}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    setMessage(response.ok ? success : "Marketplace update failed. Review the live API response and retry.");
    await loadMarketplace();
  }

  return (
    <DashboardShell
      actions={<button className="button-primary" type="button" onClick={() => void loadMarketplace()}>Retry</button>}
      className="worker-page"
      eyebrow={<StatusBadge tone="green">Marketplace</StatusBadge>}
      navItems={[
        { label: "Overview", href: "/worker" },
        { label: "Find Shifts", href: "/worker/shifts" },
        { label: "My Work", href: "/worker/work" },
        { label: "Reviews", href: "/worker/reviews" },
        { label: "Marketplace", href: "/worker/marketplace", active: true },
        { label: "Settings", href: "/worker/settings" }
      ]}
      notificationLoading={isLoadingNotifications}
      notifications={notifications}
      onMarkAllNotificationsRead={markAllNotificationsRead}
      onNotificationClick={(notification) => void markNotificationRead(notification as NotificationSummary)}
      title="Worker marketplace"
      unreadNotificationCount={unreadNotificationCount}
      userLabel="Worker workspace"
    >
      <section className="worker-shell worker-dashboard-refresh">
        <p className="worker-message">{message}</p>

        <section className="worker-dashboard-grid">
          <MarketplacePanel badge={`${openShifts.length} matches`} icon={<Send aria-hidden="true" />} title="Matching shifts">
            {openShifts.map((shift) => (
              <div className="worker-shift-card" key={shift.id}>
                <strong>{shift.title || shift.roleRequired}</strong>
                <span>{formatDate(shift.startTime)} · ${shift.hourlyRate}/hr · {shift.facility?.name || "Facility"}</span>
                <button type="button" onClick={() => void postAction(`/shifts/${shift.id}/applications`, {}, "Application submitted.")}>Apply</button>
              </div>
            ))}
            {!openShifts.length ? <EmptyLine text="No live matching shifts are currently available." /> : null}
          </MarketplacePanel>

          <MarketplacePanel badge={`${applications.length} records`} icon={<FileText aria-hidden="true" />} title="Applications">
            {applications.map((application) => (
              <div className="worker-shift-card" key={application.id}>
                <strong>{application.status || "APPLIED"}</strong>
                <span>{application.shiftId} · {application.message || "No message"}</span>
              </div>
            ))}
            {!applications.length ? <EmptyLine text="Your live shift applications will appear here." /> : null}
          </MarketplacePanel>

          <MarketplacePanel badge={`${invitations.length} invites`} icon={<Send aria-hidden="true" />} title="Invitations">
            {invitations.map((invitation) => (
              <div className="worker-shift-card" key={invitation.id}>
                <strong>{invitation.status || "PENDING"}</strong>
                <span>{invitation.shiftId} · {invitation.message || "No message"}</span>
                {invitation.status === ShiftInvitationStatus.Pending ? (
                  <div className="facility-table-actions">
                    <button type="button" onClick={() => void patchAction(`/invitations/${invitation.id}/status`, { status: ShiftInvitationStatus.Accepted }, "Invitation accepted.")}>Accept</button>
                    <button type="button" onClick={() => void patchAction(`/invitations/${invitation.id}/status`, { status: ShiftInvitationStatus.Declined }, "Invitation declined.")}>Decline</button>
                  </div>
                ) : null}
              </div>
            ))}
            {!invitations.length ? <EmptyLine text="Facility invitations will appear here." /> : null}
          </MarketplacePanel>

          <MarketplacePanel badge={`${confirmedShifts.length} shifts`} icon={<Clock aria-hidden="true" />} title="Confirmed schedule">
            {confirmedShifts.map((shift) => (
              <div className="worker-shift-card" key={shift.id}>
                <strong>{shift.title || shift.roleRequired}</strong>
                <span>{formatDate(shift.startTime)} · {shift.status}</span>
                <div className="facility-table-actions">
                  <button type="button" onClick={() => void postAction("/attendance/clock-in", buildAttendancePayload(shift.id, AttendanceEventType.ClockIn), "Clock-in recorded.")}>Clock in</button>
                  <button type="button" onClick={() => void postAction("/attendance/break/start", buildAttendancePayload(shift.id, AttendanceEventType.BreakStart), "Break start recorded.")}>Break</button>
                  <button type="button" onClick={() => void postAction("/attendance/break/end", buildAttendancePayload(shift.id, AttendanceEventType.BreakEnd), "Break end recorded.")}>Resume</button>
                  <button type="button" onClick={() => void postAction("/attendance/clock-out", buildAttendancePayload(shift.id, AttendanceEventType.ClockOut), "Clock-out recorded.")}>Clock out</button>
                </div>
                <button type="button" onClick={() => void postAction("/timesheets", buildTimesheetPayload(shift), "Timesheet submitted.")}>
                  <FileText aria-hidden="true" /> Submit timesheet
                </button>
              </div>
            ))}
            {!confirmedShifts.length ? <EmptyLine text="No confirmed live work yet." /> : null}
          </MarketplacePanel>

          <MarketplacePanel badge={`${timesheets.length} records`} icon={<Check aria-hidden="true" />} title="Timesheets">
            {timesheets.map((timesheet) => (
              <div className="worker-shift-card" key={timesheet.id}>
                <strong>{timesheet.status || "SUBMITTED"}</strong>
                <span>{timesheet.shiftId} · {timesheet.workedMinutes ?? 0} minutes</span>
              </div>
            ))}
            {!timesheets.length ? <EmptyLine text="No live timesheets have been submitted." /> : null}
          </MarketplacePanel>

          <MarketplacePanel badge={`${disputes.length} cases`} icon={<ShieldAlert aria-hidden="true" />} title="Disputes">
            {confirmedShifts[0] ? (
              <button type="button" onClick={() => void postAction("/disputes", { shiftId: confirmedShifts[0].id, reason: "Worker opened a marketplace dispute from the dashboard." }, "Dispute opened.")}>
                Open dispute for next shift
              </button>
            ) : null}
            {disputes.map((dispute) => (
              <div className="worker-shift-card" key={dispute.id}>
                <strong>{dispute.status || "OPEN"}</strong>
                <span>{dispute.reason || "No dispute reason supplied."}</span>
              </div>
            ))}
            {!disputes.length ? <EmptyLine text="No live disputes are open." /> : null}
          </MarketplacePanel>
        </section>
      </section>
    </DashboardShell>
  );
}

function MarketplacePanel({ badge, children, icon, title }: { badge: string; children: ReactNode; icon: ReactNode; title: string }) {
  return (
    <section className="facility-board">
      <div className="facility-board-heading">
        <div>
          <h2>{icon} {title}</h2>
        </div>
        <StatusBadge tone="gold">{badge}</StatusBadge>
      </div>
      <div className="worker-shift-list">{children}</div>
    </section>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <p className="worker-empty-state">{text}</p>;
}

function buildAttendancePayload(shiftId: string, eventType: AttendanceEventType) {
  return {
    shiftId,
    idempotencyKey: `${shiftId}-${eventType}-${Date.now()}`,
    occurredAt: new Date().toISOString()
  };
}

function buildTimesheetPayload(shift: MatchedShiftSummary) {
  return {
    shiftId: shift.id,
    actualStartTime: shift.startTime,
    actualEndTime: new Date().toISOString(),
    breakMinutes: shift.breakMinutes ?? 0
  };
}

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}
