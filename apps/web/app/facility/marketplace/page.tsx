"use client";

import { apiFetch as fetch } from "../../session-fetch";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { NotificationSummary, ShiftApplicationStatus, ShiftStatus, TimesheetStatus } from "@medshift/shared-types";
import { Button, Card, DashboardShell, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, StatusBadge } from "@medshift/ui-components";
import { Check, Clock, FileText, Send, Users, X } from "lucide-react";
import { useDashboardNotifications } from "../../use-dashboard-notifications";

type FacilityShift = {
  id: string;
  title?: string;
  roleRequired: string;
  startTime: string;
  endTime: string;
  hourlyRate: number;
  status: ShiftStatus;
  caregiversRequired?: number;
};

type MatchResult = {
  workerId: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  matchScore: number;
  reliabilityScore?: number;
  rating?: number;
};

type MarketplaceRecord = {
  id: string;
  eventType?: string;
  status?: string;
  message?: string;
  reason?: string;
  shiftId?: string;
  workerId?: string;
  workedMinutes?: number;
  facilityNotes?: string;
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

export default function FacilityMarketplacePage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
  const {
    isLoadingNotifications,
    markAllNotificationsRead,
    markNotificationRead,
    notifications,
    unreadNotificationCount
  } = useDashboardNotifications(apiUrl);
  const [applications, setApplications] = useState<MarketplaceRecord[]>([]);
  const [assignments, setAssignments] = useState<MarketplaceRecord[]>([]);
  const [attendanceEvents, setAttendanceEvents] = useState<MarketplaceRecord[]>([]);
  const [disputes, setDisputes] = useState<MarketplaceRecord[]>([]);
  const [invitations, setInvitations] = useState<MarketplaceRecord[]>([]);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [message, setMessage] = useState("Loading live marketplace operations...");
  const [overview, setOverview] = useState<MarketplaceOverview>(emptyMarketplaceOverview);
  const [selectedShiftId, setSelectedShiftId] = useState("");
  const [shifts, setShifts] = useState<FacilityShift[]>([]);
  const [timesheets, setTimesheets] = useState<MarketplaceRecord[]>([]);

  const selectedShift = useMemo(() => shifts.find((shift) => shift.id === selectedShiftId) ?? shifts[0], [selectedShiftId, shifts]);

  const loadMarketplace = useCallback(async () => {
    const token = "cookie-session";

    if (!token) {
      setMessage("Sign in as a facility to manage marketplace activity.");
      setShifts([]);
      setMatches([]);
      setApplications([]);
      setInvitations([]);
      setAssignments([]);
      setAttendanceEvents([]);
      setTimesheets([]);
      setDisputes([]);
      setOverview(emptyMarketplaceOverview);
      return;
    }

    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [shiftsResponse, timesheetsResponse, disputesResponse, assignmentsResponse, attendanceResponse, overviewResponse] = await Promise.all([
        fetch(`${apiUrl}/shifts`, { headers }),
        fetch(`${apiUrl}/timesheets`, { headers }),
        fetch(`${apiUrl}/disputes`, { headers }),
        fetch(`${apiUrl}/assignments/me`, { headers }),
        fetch(`${apiUrl}/attendance`, { headers }),
        fetch(`${apiUrl}/marketplace/overview`, { headers })
      ]);

      if (!shiftsResponse.ok) {
        throw new Error("Unable to load facility shifts");
      }

      const liveShifts = (await shiftsResponse.json()) as FacilityShift[];
      setShifts(liveShifts);
      setSelectedShiftId((current) => current || liveShifts[0]?.id || "");
      setTimesheets(timesheetsResponse.ok ? ((await timesheetsResponse.json()) as MarketplaceRecord[]) : []);
      setDisputes(disputesResponse.ok ? ((await disputesResponse.json()) as MarketplaceRecord[]) : []);
      setAssignments(assignmentsResponse.ok ? ((await assignmentsResponse.json()) as MarketplaceRecord[]) : []);
      setAttendanceEvents(attendanceResponse.ok ? ((await attendanceResponse.json()) as MarketplaceRecord[]) : []);
      setOverview(overviewResponse.ok ? ((await overviewResponse.json()) as MarketplaceOverview) : emptyMarketplaceOverview);
      setMessage(liveShifts.length ? "Live marketplace operations connected." : "Live marketplace connected. Post a shift to start receiving applications and matches.");
    } catch {
      setMessage("Live marketplace data is unavailable. Check the API connection and retry.");
      setShifts([]);
      setMatches([]);
      setApplications([]);
      setInvitations([]);
      setAssignments([]);
      setAttendanceEvents([]);
      setTimesheets([]);
      setDisputes([]);
      setOverview(emptyMarketplaceOverview);
    }
  }, [apiUrl]);

  const loadShiftActivity = useCallback(async (shiftId: string) => {
    const token = "cookie-session";

    if (!token || !shiftId) {
      setMatches([]);
      setApplications([]);
      setInvitations([]);
      return;
    }

    const headers = { Authorization: `Bearer ${token}` };
    const [matchesResponse, applicationsResponse, invitationsResponse] = await Promise.all([
      fetch(`${apiUrl}/shifts/${shiftId}/matches`, { headers }),
      fetch(`${apiUrl}/shifts/${shiftId}/applications`, { headers }),
      fetch(`${apiUrl}/shifts/${shiftId}/invitations`, { headers })
    ]);

    setMatches(matchesResponse.ok ? ((await matchesResponse.json()) as MatchResult[]) : []);
    setApplications(applicationsResponse.ok ? ((await applicationsResponse.json()) as MarketplaceRecord[]) : []);
    setInvitations(invitationsResponse.ok ? ((await invitationsResponse.json()) as MarketplaceRecord[]) : []);
  }, [apiUrl]);

  useEffect(() => {
    void loadMarketplace();
  }, [loadMarketplace]);

  useEffect(() => {
    void loadShiftActivity(selectedShift?.id ?? "");
  }, [loadShiftActivity, selectedShift?.id]);

  async function postAction(path: string, body: Record<string, unknown>, success: string) {
    const token = "cookie-session";

    if (!token) {
      setMessage("Sign in as a facility to continue.");
      return;
    }

    const response = await fetch(`${apiUrl}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    setMessage(response.ok ? success : "Marketplace action failed. Review the live API response and retry.");
    await loadMarketplace();
    if (selectedShift?.id) await loadShiftActivity(selectedShift.id);
  }

  async function patchAction(path: string, body: Record<string, unknown>, success: string) {
    const token = "cookie-session";

    if (!token) {
      setMessage("Sign in as a facility to continue.");
      return;
    }

    const response = await fetch(`${apiUrl}${path}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    setMessage(response.ok ? success : "Marketplace update failed. Review the live API response and retry.");
    await loadMarketplace();
    if (selectedShift?.id) await loadShiftActivity(selectedShift.id);
  }

  return (
    <DashboardShell
      className="facility-page worker-page"
      eyebrow={<StatusBadge tone="navy">Marketplace</StatusBadge>}
      navItems={[
        { label: "Shifts", href: "/facility" },
        { label: "Find Workers", href: "/facility/workers" },
        { label: "Roster", href: "/facility/roster" },
        { label: "Reviews", href: "/facility/reviews" },
        { label: "Marketplace", href: "/facility/marketplace", active: true },
        { label: "Settings", href: "/facility/settings" }
      ]}
      notificationLoading={isLoadingNotifications}
      notifications={notifications}
      onMarkAllNotificationsRead={markAllNotificationsRead}
      onNotificationClick={(notification) => void markNotificationRead(notification as NotificationSummary)}
      title="Marketplace operations"
      unreadNotificationCount={unreadNotificationCount}
      userLabel="Facility workspace"
    >
      <section className="facility-shell worker-dashboard-refresh">
        <p className="facility-message">{message}</p>

        <section className="facility-dashboard-grid">
          <MarketplacePanel icon={<Check aria-hidden="true" />} title="Marketplace performance" badge={`${overview.activeAssignments} active`}>
            <div className="worker-shift-card">
              <strong>{overview.pendingApplications} pending applications</strong>
              <span>{overview.assignments} assignments · {overview.attendanceEvents} attendance events · {overview.openDisputes} open disputes</span>
            </div>
          </MarketplacePanel>

          <section className="facility-board">
            <div className="facility-board-heading">
              <div>
                <h2>Shift staffing</h2>
                <p>Select a live shift to review matches, applications, and invitations.</p>
              </div>
              <StatusBadge tone="green">{shifts.length} shifts</StatusBadge>
            </div>
            <Label className="marketplace-select-field">
              Shift
              <Select value={selectedShift?.id ?? "none"} onValueChange={setSelectedShiftId} disabled={!shifts.length}>
                <SelectTrigger id="facility-marketplace-shift"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {shifts.length ? shifts.map((shift) => (
                    <SelectItem key={shift.id} value={shift.id}>
                      {shift.title || shift.roleRequired} · {formatDate(shift.startTime)}
                    </SelectItem>
                  )) : <SelectItem value="none">No live shifts</SelectItem>}
                </SelectContent>
              </Select>
            </Label>
          </section>

          <MarketplacePanel icon={<Users aria-hidden="true" />} title="Matches" badge={`${matches.length} workers`}>
            {matches.map((match) => (
              <div className="worker-shift-card" key={match.workerId}>
                <strong>{formatWorkerName(match)}</strong>
                <span>{match.title || "Worker"} · {match.matchScore}% match · {match.reliabilityScore ?? 0}% reliability</span>
                <Button type="button" size="sm" onClick={() => void postAction(`/shifts/${selectedShift?.id}/invitations`, { workerId: match.workerId }, "Invitation sent.")}>
                  <Send aria-hidden="true" /> Invite
                </Button>
              </div>
            ))}
            {!matches.length ? <EmptyLine text="No eligible live matches for this shift yet." /> : null}
          </MarketplacePanel>

          <MarketplacePanel icon={<FileText aria-hidden="true" />} title="Applications" badge={`${applications.length} open`}>
            {applications.map((application) => (
              <div className="worker-shift-card" key={application.id}>
                <strong>{application.workerId}</strong>
                <span>{application.status || "APPLIED"} · {application.message || "No message"}</span>
                <div className="facility-table-actions">
                  <Button type="button" size="sm" onClick={() => void patchAction(`/applications/${application.id}/status`, { status: ShiftApplicationStatus.Selected }, "Application selected.")}>
                    <Check aria-hidden="true" /> Select
                  </Button>
                  <Button type="button" size="sm" variant="secondary" onClick={() => void patchAction(`/applications/${application.id}/status`, { status: ShiftApplicationStatus.Declined }, "Application declined.")}>
                    <X aria-hidden="true" /> Decline
                  </Button>
                </div>
              </div>
            ))}
            {!applications.length ? <EmptyLine text="No live applications for this shift." /> : null}
          </MarketplacePanel>

          <MarketplacePanel icon={<Send aria-hidden="true" />} title="Invitations" badge={`${invitations.length} sent`}>
            {invitations.map((invitation) => (
              <div className="worker-shift-card" key={invitation.id}>
                <strong>{invitation.workerId}</strong>
                <span>{invitation.status || "PENDING"} · {invitation.message || "No message"}</span>
              </div>
            ))}
            {!invitations.length ? <EmptyLine text="No live invitations have been sent for this shift." /> : null}
          </MarketplacePanel>

          <MarketplacePanel icon={<Users aria-hidden="true" />} title="Assignments" badge={`${assignments.length} confirmed`}>
            {assignments.map((assignment) => (
              <div className="worker-shift-card" key={assignment.id}>
                <strong>{assignment.workerId}</strong>
                <span>{assignment.status || "CONFIRMED"} · {assignment.shiftId}</span>
              </div>
            ))}
            {!assignments.length ? <EmptyLine text="Confirmed worker assignments will appear here." /> : null}
          </MarketplacePanel>

          <MarketplacePanel icon={<Clock aria-hidden="true" />} title="Attendance" badge={`${attendanceEvents.length} events`}>
            {attendanceEvents.map((event) => (
              <div className="worker-shift-card" key={event.id}>
                <strong>{event.eventType || "ATTENDANCE"}</strong>
                <span>{event.shiftId} · {event.workerId}</span>
              </div>
            ))}
            {!attendanceEvents.length ? <EmptyLine text="Clock-in, break, and clock-out events will appear here." /> : null}
          </MarketplacePanel>

          <MarketplacePanel icon={<Clock aria-hidden="true" />} title="Timesheets" badge={`${timesheets.length} records`}>
            {timesheets.map((timesheet) => (
              <div className="worker-shift-card" key={timesheet.id}>
                <strong>{timesheet.shiftId}</strong>
                <span>{timesheet.status || "SUBMITTED"} · {timesheet.workedMinutes ?? 0} minutes</span>
                <div className="facility-table-actions">
                  <Button type="button" size="sm" onClick={() => void patchAction(`/timesheets/${timesheet.id}`, { status: TimesheetStatus.Approved }, "Timesheet approved.")}>Approve</Button>
                  <Button type="button" size="sm" variant="secondary" onClick={() => void patchAction(`/timesheets/${timesheet.id}`, { status: TimesheetStatus.Rejected }, "Timesheet rejected.")}>Reject</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => void patchAction(`/timesheets/${timesheet.id}`, { status: TimesheetStatus.CorrectionRequested }, "Correction requested.")}>Correction</Button>
                </div>
              </div>
            ))}
            {!timesheets.length ? <EmptyLine text="No submitted live timesheets yet." /> : null}
          </MarketplacePanel>

          <MarketplacePanel icon={<X aria-hidden="true" />} title="Disputes" badge={`${disputes.length} cases`}>
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
    <Card className="facility-board">
      <div className="facility-board-heading">
        <div>
          <h2>{icon} {title}</h2>
        </div>
        <StatusBadge tone="gold">{badge}</StatusBadge>
      </div>
      <div className="worker-shift-list">{children}</div>
    </Card>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <p className="worker-empty-state">{text}</p>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function formatWorkerName(match: MatchResult) {
  return [match.firstName, match.lastName].filter(Boolean).join(" ") || match.workerId;
}
