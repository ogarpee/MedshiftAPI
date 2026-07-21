import { MedShiftLogo, StatusBadge } from "@medshift/ui-components";

const shifts = [
  { facility: "Bow River Care Centre", role: "HCA", time: "Today 7:00 AM - 3:00 PM", rate: "$34/hr" },
  { facility: "Calgary Community Clinic", role: "RN", time: "Tomorrow 3:00 PM - 11:00 PM", rate: "$52/hr" },
  { facility: "Prairie Long-Term Care", role: "LPN", time: "Fri 11:00 PM - 7:00 AM", rate: "$43/hr" }
];

export default function HomePage() {
  return (
    <main>
      <nav className="topbar">
        <MedShiftLogo />
        <a className="topbar-action" href="#early-access">Early access</a>
      </nav>

      <section className="hero">
        <div className="hero-copy">
          <StatusBadge tone="gold">Calgary early access</StatusBadge>
          <h1>MedShift</h1>
          <p>
            Fill urgent healthcare shifts with verified local workers, transparent pricing, and real-time matching.
          </p>
          <div className="hero-actions">
            <a className="button-primary" href="#early-access">Join waitlist</a>
            <a className="button-secondary" href="#shift-board">Browse preview</a>
          </div>
        </div>

        <div className="shift-board" id="shift-board" aria-label="Available shift preview">
          <div className="board-header">
            <div>
              <p>Worker shift board</p>
              <strong>Open near Calgary</strong>
            </div>
            <StatusBadge tone="green">Live</StatusBadge>
          </div>
          {shifts.map((shift) => (
            <article className="shift-card" key={`${shift.facility}-${shift.time}`}>
              <div>
                <h2>{shift.facility}</h2>
                <p>{shift.time}</p>
              </div>
              <div className="shift-meta">
                <span>{shift.role}</span>
                <strong>{shift.rate}</strong>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="early-access" id="early-access">
        <h2>Right care, right when it matters.</h2>
        <form>
          <input aria-label="Email address" placeholder="you@example.com" type="email" />
          <select aria-label="Account type" defaultValue="worker">
            <option value="worker">Healthcare worker</option>
            <option value="facility">Facility</option>
          </select>
          <button type="submit">Request access</button>
        </form>
      </section>
    </main>
  );
}
