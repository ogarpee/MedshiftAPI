"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ClinicalRole, ShiftMetrics, ShiftStatus, ShiftSummary } from "@medshift/shared-types";
import { MedShiftLogo, StatusBadge } from "@medshift/ui-components";

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
  }
];

export default function FacilityDashboardPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [shifts, setShifts] = useState<ShiftSummary[]>(demoShifts);
  const [message, setMessage] = useState("");
  const [roleRequired, setRoleRequired] = useState<ClinicalRole>(ClinicalRole.Hca);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [hourlyRate, setHourlyRate] = useState("36");
  const [description, setDescription] = useState("");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

  const metrics: ShiftMetrics = useMemo(() => {
    const now = Date.now();
    const activeStatuses = new Set([ShiftStatus.Open, ShiftStatus.Matched, ShiftStatus.InProgress]);

    return {
      activeShifts: shifts.filter((shift) => activeStatuses.has(shift.status)).length,
      upcomingShifts: shifts.filter((shift) => new Date(shift.startTime).getTime() > now).length,
      completedShifts: shifts.filter((shift) => shift.status === ShiftStatus.Completed).length,
      averageFillTimeMinutes: null
    };
  }, [shifts]);

  useEffect(() => {
    const token = window.localStorage.getItem("medshift.accessToken");

    if (!token) {
      return;
    }

    fetch(`${apiUrl}/shifts`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((result: ShiftSummary[]) => setShifts(result))
      .catch(() => setMessage("Showing dashboard preview until your facility profile is connected."));
  }, [apiUrl]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const draftShift: ShiftSummary = {
      id: `draft-${Date.now()}`,
      facilityId: "current-facility",
      roleRequired,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      hourlyRate: Number(hourlyRate),
      status: ShiftStatus.Open,
      location: { type: "Point", coordinates: [-114.0719, 51.0447] },
      description
    };

    const token = window.localStorage.getItem("medshift.accessToken");

    if (token) {
      const response = await fetch(`${apiUrl}/shifts`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          roleRequired,
          startTime: draftShift.startTime,
          endTime: draftShift.endTime,
          hourlyRate: draftShift.hourlyRate,
          location: draftShift.location,
          description
        })
      });

      if (response.ok) {
        const savedShift = (await response.json()) as ShiftSummary;
        setShifts((current) => [savedShift, ...current]);
        setMessage("Shift published to your facility board.");
      } else {
        setShifts((current) => [draftShift, ...current]);
        setMessage("Saved as a local preview. Complete facility setup to publish.");
      }
    } else {
      setShifts((current) => [draftShift, ...current]);
      setMessage("Saved as a local preview. Sign in to publish to the network.");
    }

    setIsModalOpen(false);
    setDescription("");
  }

  return (
    <main className="facility-page">
      <nav className="facility-nav">
        <MedShiftLogo />
        <a href="/login">Login</a>
      </nav>

      <section className="facility-shell">
        <header className="facility-header">
          <div>
            <StatusBadge tone="navy">Facility roster</StatusBadge>
            <h1>Shift command centre</h1>
          </div>
          <button className="button-primary" type="button" onClick={() => setIsModalOpen(true)}>
            Post shift
          </button>
        </header>

        <section className="facility-metrics" aria-label="Dashboard metrics">
          <article>
            <span>Average fill time</span>
            <strong>{metrics.averageFillTimeMinutes ? `${metrics.averageFillTimeMinutes}m` : "< 2h goal"}</strong>
          </article>
          <article>
            <span>Active shifts</span>
            <strong>{metrics.activeShifts}</strong>
          </article>
          <article>
            <span>Upcoming shifts</span>
            <strong>{metrics.upcomingShifts}</strong>
          </article>
        </section>

        {message ? <p className="facility-message">{message}</p> : null}

        <section className="facility-board">
          <div className="facility-board-heading">
            <h2>Active and upcoming shifts</h2>
            <StatusBadge tone="green">{metrics.activeShifts} active</StatusBadge>
          </div>
          <div className="facility-shift-list">
            {shifts.map((shift) => (
              <article className="facility-shift-row" key={shift.id}>
                <div>
                  <h3>{shift.roleRequired}</h3>
                  <p>{formatWindow(shift.startTime, shift.endTime)}</p>
                  <span>{shift.description}</span>
                </div>
                <div className="facility-shift-status">
                  <StatusBadge tone={shift.status === ShiftStatus.Open ? "gold" : "green"}>{shift.status}</StatusBadge>
                  <strong>${shift.hourlyRate}/hr</strong>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>

      {isModalOpen ? (
        <div className="modal-backdrop" role="presentation">
          <section className="post-shift-modal" role="dialog" aria-modal="true" aria-labelledby="post-shift-title">
            <div className="modal-heading">
              <h2 id="post-shift-title">Post a shift</h2>
              <button type="button" onClick={() => setIsModalOpen(false)} aria-label="Close post shift modal">
                ×
              </button>
            </div>
            <form className="post-shift-form" onSubmit={handleSubmit}>
              <label>
                Role
                <select value={roleRequired} onChange={(event) => setRoleRequired(event.target.value as ClinicalRole)}>
                  <option value={ClinicalRole.Hca}>HCA</option>
                  <option value={ClinicalRole.Rn}>RN</option>
                  <option value={ClinicalRole.Lpn}>LPN</option>
                  <option value={ClinicalRole.Psw}>PSW</option>
                </select>
              </label>
              <label>
                Start
                <input value={startTime} onChange={(event) => setStartTime(event.target.value)} type="datetime-local" required />
              </label>
              <label>
                End
                <input value={endTime} onChange={(event) => setEndTime(event.target.value)} type="datetime-local" required />
              </label>
              <label>
                Hourly rate
                <input value={hourlyRate} onChange={(event) => setHourlyRate(event.target.value)} min="0" type="number" required />
              </label>
              <label className="wide-field">
                Description
                <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
              </label>
              <button className="auth-submit wide-field" type="submit">Publish to network</button>
            </form>
          </section>
        </div>
      ) : null}
    </main>
  );
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
