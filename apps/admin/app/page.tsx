import { MedShiftLogo, StatusBadge } from "@medshift/ui-components";

const queue = [
  { name: "Sarah Jensen", role: "HCA", status: "Credentials pending", submitted: "12 min ago" },
  { name: "Michael Tran", role: "RN", status: "Background check", submitted: "28 min ago" },
  { name: "Amina Bello", role: "LPN", status: "Ready for approval", submitted: "43 min ago" }
];

export default function AdminPage() {
  return (
    <main className="admin-shell">
      <aside>
        <MedShiftLogo />
        <nav>
          <a href="/">Overview</a>
          <a href="/">Users</a>
          <a href="/">Facilities</a>
          <a href="/">Shifts</a>
        </nav>
      </aside>

      <section className="workspace">
        <header>
          <div>
            <StatusBadge tone="navy">Platform monitoring</StatusBadge>
            <h1>Operations overview</h1>
          </div>
          <button>Review queue</button>
        </header>

        <div className="metrics">
          <article>
            <span>Average fill time</span>
            <strong>1h 34m</strong>
          </article>
          <article>
            <span>Active shifts</span>
            <strong>18</strong>
          </article>
          <article>
            <span>Verified workers</span>
            <strong>74%</strong>
          </article>
        </div>

        <section className="table-panel">
          <div className="panel-title">
            <h2>Verification queue</h2>
            <StatusBadge tone="gold">3 urgent</StatusBadge>
          </div>
          <table>
            <thead>
              <tr>
                <th>Worker</th>
                <th>Role</th>
                <th>Status</th>
                <th>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {queue.map((item) => (
                <tr key={item.name}>
                  <td>{item.name}</td>
                  <td>{item.role}</td>
                  <td>{item.status}</td>
                  <td>{item.submitted}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </section>
    </main>
  );
}
