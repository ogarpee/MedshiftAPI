"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing, Mail, MonitorSmartphone } from "lucide-react";
import { NotificationCategory, NotificationPreferences } from "@medshift/shared-types";
import { apiFetch } from "../../session-fetch";
import { useToast } from "../../toast-provider";

const rows = [
  [NotificationCategory.ShiftOpportunities, "Shift opportunities", "Nearby shifts matching your role and service area."],
  [NotificationCategory.ShiftUpdates, "Applications and assignments", "Application, invitation, acceptance, and assignment updates."],
  [NotificationCategory.ScheduleAndTimesheets, "Schedule and timesheets", "Attendance, schedule, and timesheet activity."],
  [NotificationCategory.ReviewsAndDisputes, "Reviews and disputes", "Review availability and dispute updates."],
  [NotificationCategory.AccountAndSecurity, "Account and security", "Verification, onboarding, password, and security alerts."]
] as const;

const defaults = Object.fromEntries(rows.map(([category]) => [category, { inApp: true, email: true }])) as NotificationPreferences;

export function NotificationSettings({ apiUrl }: { apiUrl: string }) {
  const { notify } = useToast();
  const [preferences, setPreferences] = useState(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiFetch(`${apiUrl}/notification-preferences/me`);
      if (!response.ok) throw new Error();
      setPreferences({ ...defaults, ...(await response.json()) });
    } catch {
      notify("Notification settings could not be loaded. Your current alerts remain unchanged.", "error");
    } finally { setLoading(false); }
  }, [apiUrl, notify]);

  useEffect(() => { void load(); }, [load]);

  async function toggle(category: NotificationCategory, channel: "inApp" | "email") {
    if (category === NotificationCategory.AccountAndSecurity || saving) return;
    const previous = preferences;
    const next = { ...preferences, [category]: { ...preferences[category], [channel]: !preferences[category][channel] } };
    setPreferences(next);
    setSaving(`${category}-${channel}`);
    try {
      const response = await apiFetch(`${apiUrl}/notification-preferences/me`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shiftOpportunities: next[NotificationCategory.ShiftOpportunities],
          shiftUpdates: next[NotificationCategory.ShiftUpdates],
          scheduleAndTimesheets: next[NotificationCategory.ScheduleAndTimesheets],
          reviewsAndDisputes: next[NotificationCategory.ReviewsAndDisputes]
        })
      });
      if (!response.ok) throw new Error();
      notify("Notification preferences saved.", "success");
    } catch {
      setPreferences(previous);
      notify("That preference could not be saved. Your previous setting was restored.", "error");
    } finally { setSaving(null); }
  }

  if (loading) return <div className="settings-loading-card" aria-busy="true">Loading notification preferences…</div>;

  return (
    <div className="notification-preferences" aria-label="Notification preferences">
      <div className="notification-preferences-head">
        <span><BellRing aria-hidden="true" /> Alert type</span>
        <span><MonitorSmartphone aria-hidden="true" /> In app</span>
        <span><Mail aria-hidden="true" /> Email</span>
      </div>
      {rows.map(([category, title, description]) => {
        const mandatory = category === NotificationCategory.AccountAndSecurity;
        return (
          <div className="notification-preference-row" key={category}>
            <div><strong>{title}</strong><p>{description}</p>{mandatory ? <small>Always on for your protection</small> : null}</div>
            <Toggle checked={preferences[category].inApp} disabled={mandatory || Boolean(saving)} label={`${title} in-app notifications`} onChange={() => void toggle(category, "inApp")} />
            <Toggle checked={preferences[category].email} disabled={mandatory || Boolean(saving)} label={`${title} email notifications`} onChange={() => void toggle(category, "email")} />
          </div>
        );
      })}
    </div>
  );
}

function Toggle({ checked, disabled, label, onChange }: { checked: boolean; disabled: boolean; label: string; onChange: () => void }) {
  return <button aria-checked={checked} aria-label={label} className={`settings-toggle ${checked ? "on" : ""}`} disabled={disabled} onClick={onChange} role="switch" type="button"><span /></button>;
}
