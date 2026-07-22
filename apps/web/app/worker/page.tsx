"use client";

import { useEffect, useMemo, useState } from "react";
import { ClinicalRole, FacilityType, MatchedShiftSummary, OnboardingStatus, ShiftStatus } from "@medshift/shared-types";
import { DashboardShell, StatusBadge } from "@medshift/ui-components";
import type { Socket } from "socket.io-client";
import { ShiftMap } from "./shift-map";

type ViewMode = "list" | "map";
type WorkerOnboardingStatus = {
  completed?: boolean;
  nextStep?: string;
  verificationStatus?: OnboardingStatus;
};

const demoShifts: MatchedShiftSummary[] = [
  {
    id: "demo-worker-1",
    facilityId: "demo-facility-1",
    roleRequired: ClinicalRole.Hca,
    startTime: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    endTime: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
    hourlyRate: 34,
    status: ShiftStatus.Open,
    location: { type: "Point", coordinates: [-114.0719, 51.0447] },
    description: "Memory care coverage with a small evening team.",
    distanceKm: 4.8,
    facility: {
      id: "demo-facility-1",
      name: "Bow Valley Care Centre",
      facilityType: FacilityType.LongTermCare,
      address: { city: "Calgary", province: "AB" },
      stats: { averageRating: 4.8 }
    }
  },
  {
    id: "demo-worker-2",
    facilityId: "demo-facility-2",
    roleRequired: ClinicalRole.Rn,
    startTime: new Date(Date.now() + 28 * 60 * 60 * 1000).toISOString(),
    endTime: new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString(),
    hourlyRate: 52,
    status: ShiftStatus.Open,
    location: { type: "Point", coordinates: [-114.095, 51.05] },
    description: "Medication pass and overnight admissions support.",
    distanceKm: 8.2,
    facility: {
      id: "demo-facility-2",
      name: "Prairie North Hospital",
      facilityType: FacilityType.Hospital,
      address: { city: "Calgary", province: "AB" },
      stats: { averageRating: 4.6 }
    }
  },
  {
    id: "demo-worker-3",
    facilityId: "demo-facility-3",
    roleRequired: ClinicalRole.Lpn,
    startTime: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(),
    endTime: new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString(),
    hourlyRate: 44,
    status: ShiftStatus.Completed,
    location: { type: "Point", coordinates: [-114.081, 51.04] },
    description: "Completed evening coverage ready for facility review.",
    distanceKm: 5.4,
    facility: {
      id: "demo-facility-3",
      name: "Foothills Community Clinic",
      facilityType: FacilityType.Clinic,
      address: { city: "Calgary", province: "AB" },
      stats: { averageRating: 4.9 }
    }
  }
];

export default function WorkerDashboardPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedShiftId, setSelectedShiftId] = useState(demoShifts[0]?.id ?? "");
  const [shifts, setShifts] = useState<MatchedShiftSummary[]>(demoShifts);
  const [message, setMessage] = useState("");
  const [isAccepting, setIsAccepting] = useState(false);
  const [onboardingStatus, setOnboardingStatus] = useState<WorkerOnboardingStatus | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");

  const selectedShift = useMemo(
    () => shifts.find((shift) => shift.id === selectedShiftId) ?? shifts[0],
    [selectedShiftId, shifts]
  );

  const openShifts = shifts.filter((shift) => shift.status === ShiftStatus.Open).length;
  const nextShift = shifts
    .filter((shift) => shift.status === ShiftStatus.Open)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0];

  useEffect(() => {
    const token = window.localStorage.getItem("medshift.accessToken");

    if (!token) {
      setMessage("Showing a Calgary preview. Sign in as a worker to browse live matches.");
      return;
    }

    fetch(`${apiUrl}/worker-profiles/onboarding-status`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((status: WorkerOnboardingStatus) => {
        setOnboardingStatus(status);

        if (status.verificationStatus !== OnboardingStatus.Approved) {
          setMessage(status.verificationStatus === OnboardingStatus.Incomplete ? "Complete onboarding to unlock live shift matching." : "Your onboarding is under review. Preview shifts are shown until approval.");
          return null;
        }

        return fetch(`${apiUrl}/matching/open-shifts?longitude=-114.0719&latitude=51.0447&radiusKm=25`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      })
      .then((response) => (response ? (response.ok ? response.json() : Promise.reject()) : []))
      .then((result: MatchedShiftSummary[]) => {
        if (result.length) {
          setShifts(result);
          setSelectedShiftId(result[0].id);
          setMessage("");
        }
      })
      .catch(() => setMessage("Live worker matching is unavailable, so this board is using preview shifts."));
  }, [apiUrl]);

  useEffect(() => {
    let socket: Socket | null = null;

    import("socket.io-client")
      .then(({ io }) => {
        socket = io(`${apiUrl}/shifts`, { transports: ["websocket"] });
        socket.emit("join.worker", { id: "current-worker" });
        socket.on("shift.created", (shift: MatchedShiftSummary) => {
          setShifts((current) => [shift, ...current.filter((item) => item.id !== shift.id)]);
          setSelectedShiftId((current) => current || shift.id);
          setMessage("New nearby shift posted.");
        });
      })
      .catch(() => {
        setMessage("Realtime updates are unavailable in this environment.");
      });

    return () => {
      socket?.disconnect();
    };
  }, [apiUrl]);

  async function acceptShift(shift: MatchedShiftSummary) {
    const token = window.localStorage.getItem("medshift.accessToken");

    if (!token || shift.id.startsWith("demo-")) {
      setShifts((current) =>
        current.map((item) => (item.id === shift.id ? { ...item, status: ShiftStatus.Matched } : item))
      );
      setMessage("Preview accepted. Sign in as a worker to claim live shifts.");
      return;
    }

    setIsAccepting(true);

    try {
      const response = await fetch(`${apiUrl}/shifts/${shift.id}/accept`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error("Unable to accept shift");
      }

      const accepted = (await response.json()) as MatchedShiftSummary;
      setShifts((current) => current.map((item) => (item.id === accepted.id ? accepted : item)));
      setSelectedShiftId(accepted.id);
      setMessage("Shift accepted. The facility has been notified.");
    } catch {
      setMessage("That shift could not be accepted. It may already be matched.");
    } finally {
      setIsAccepting(false);
    }
  }

  async function submitReview(shift: MatchedShiftSummary) {
    if (reviewComment.trim().length > 280) {
      setMessage("Facility feedback must be 280 characters or fewer.");
      return;
    }

    const token = window.localStorage.getItem("medshift.accessToken");
    const comment = reviewComment.trim();

    if (!token || shift.id.startsWith("demo-")) {
      setMessage(`Preview facility review submitted with ${reviewRating} stars.`);
      setReviewComment("");
      return;
    }

    const response = await fetch(`${apiUrl}/reviews/shifts/${shift.id}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ rating: reviewRating, comment })
    });

    if (response.ok) {
      setMessage("Facility review submitted.");
      setReviewComment("");
      return;
    }

    setMessage("Review could not be submitted for this shift.");
  }

  return (
    <DashboardShell
      className="worker-page"
      eyebrow={<StatusBadge tone="green">Available now</StatusBadge>}
      navItems={[
        { label: "Shift board", href: "/worker", active: true },
        { label: "Map view", href: "/worker#map" }
      ]}
      title="Shift board"
      userLabel="Worker workspace"
    >
      <section className="worker-shell">
        <header className="worker-header">
          <div>
            <h2>Nearby shifts</h2>
            <p>{nextShift ? `Next match starts ${formatShortDate(nextShift.startTime)}.` : "No open shifts in your radius yet."}</p>
          </div>
          <div className="worker-earnings" aria-label="Worker summary">
            <span>Projected today</span>
            <strong>${calculateProjectedPay(shifts)}</strong>
            <small>{openShifts} open matches</small>
          </div>
        </header>

        {onboardingStatus?.verificationStatus === OnboardingStatus.Incomplete ? (
          <section className="dashboard-onboarding-banner" aria-label="Complete worker onboarding">
            <div>
              <span>Profile required</span>
              <h3>Complete your onboarding to unlock live shifts.</h3>
              <p>Finish your profile, service area, availability, credentials, and background-check consent so MedShift can review your account.</p>
            </div>
            <a className="auth-submit" href="/worker/onboarding">
              Continue onboarding
            </a>
          </section>
        ) : null}

        <div className="worker-toolbar">
          <div className="segmented-control" aria-label="Shift view">
            <button className={viewMode === "list" ? "active" : ""} type="button" onClick={() => setViewMode("list")}>
              List
            </button>
            <button className={viewMode === "map" ? "active" : ""} type="button" onClick={() => setViewMode("map")}>
              Map
            </button>
          </div>
          <span>{message || "Live board connected to your saved radius."}</span>
        </div>

        <section className="worker-grid" id="map">
          <div className={viewMode === "map" ? "shift-map-panel" : "worker-shift-list"}>
            {viewMode === "list" ? (
              shifts.map((shift) => (
                <button
                  className={shift.id === selectedShift?.id ? "worker-shift-card active" : "worker-shift-card"}
                  key={shift.id}
                  type="button"
                  onClick={() => setSelectedShiftId(shift.id)}
                >
                  <span>{shift.facility?.name ?? "MedShift facility"}</span>
                  <strong>{shift.roleRequired} · ${shift.hourlyRate}/hr</strong>
                  <small>{formatWindow(shift.startTime, shift.endTime)}</small>
                  <em>{shift.distanceKm ? `${shift.distanceKm} km away` : "Nearby"}</em>
                </button>
              ))
            ) : (
              <ShiftMap shifts={shifts} selectedShiftId={selectedShift?.id} token={mapboxToken} onSelectShift={setSelectedShiftId} />
            )}
          </div>

          {selectedShift ? (
            <aside className="shift-detail-panel" aria-label="Shift details">
              <div>
                <StatusBadge tone={selectedShift.status === ShiftStatus.Open ? "gold" : "green"}>{selectedShift.status}</StatusBadge>
                <h2>{selectedShift.facility?.name ?? "MedShift facility"}</h2>
                <p>{selectedShift.description}</p>
              </div>

              <dl className="shift-detail-list">
                <div>
                  <dt>Role</dt>
                  <dd>{selectedShift.roleRequired}</dd>
                </div>
                <div>
                  <dt>Time</dt>
                  <dd>{formatWindow(selectedShift.startTime, selectedShift.endTime)}</dd>
                </div>
                <div>
                  <dt>Rate</dt>
                  <dd>${selectedShift.hourlyRate}/hr</dd>
                </div>
                <div>
                  <dt>Distance</dt>
                  <dd>{selectedShift.distanceKm ? `${selectedShift.distanceKm} km` : "Nearby"}</dd>
                </div>
                <div>
                  <dt>Facility rating</dt>
                  <dd>{selectedShift.facility?.stats?.averageRating ? selectedShift.facility.stats.averageRating.toFixed(1) : "New"}</dd>
                </div>
              </dl>

              <button
                className="auth-submit"
                disabled={isAccepting || selectedShift.status !== ShiftStatus.Open}
                type="button"
                onClick={() => acceptShift(selectedShift)}
              >
                {selectedShift.status === ShiftStatus.Open ? "Accept shift" : "Matched"}
              </button>

              {selectedShift.status === ShiftStatus.Completed ? (
                <form className="worker-review-form" onSubmit={(event) => { event.preventDefault(); void submitReview(selectedShift); }}>
                  <div className="star-row" aria-label="Facility rating">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        className={reviewRating >= rating ? "active" : ""}
                        key={rating}
                        type="button"
                        onClick={() => setReviewRating(rating)}
                        aria-label={`${rating} star rating`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                  <textarea
                    maxLength={280}
                    name="facilityReview"
                    value={reviewComment}
                    onChange={(event) => setReviewComment(event.target.value)}
                    placeholder="Add facility feedback"
                    rows={3}
                  />
                  <button type="submit">Submit review</button>
                </form>
              ) : null}
            </aside>
          ) : null}
        </section>
      </section>
    </DashboardShell>
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

function formatShortDate(date: string) {
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    hour: "numeric"
  }).format(new Date(date));
}

function calculateProjectedPay(shifts: MatchedShiftSummary[]) {
  return shifts
    .filter((shift) => shift.status === ShiftStatus.Open)
    .reduce((total, shift) => {
      const hours = (new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime()) / 3_600_000;
      return total + Math.max(0, Math.round(hours * shift.hourlyRate));
    }, 0);
}
