import type { ReactNode } from "react";
import { MedShiftLogo } from "./medshift-logo";

export type DashboardNavItem = {
  label: string;
  active?: boolean;
  href?: string;
  onClick?: () => void;
};

type DashboardShellProps = {
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  eyebrow?: ReactNode;
  navItems: DashboardNavItem[];
  status?: ReactNode;
  title: string;
  userLabel?: string;
};

export function DashboardShell({
  actions,
  children,
  className,
  eyebrow,
  navItems,
  status,
  title,
  userLabel
}: DashboardShellProps) {
  return (
    <main className={["dashboard-shell", className].filter(Boolean).join(" ")}>
      <aside className="dashboard-sidebar" aria-label="Dashboard navigation">
        <div className="dashboard-sidebar-primary">
          <MedShiftLogo href="/" />
          <nav className="dashboard-sidebar-nav" aria-label="Primary">
            {navItems.map((item) =>
              item.href ? (
                <a className={item.active ? "active" : ""} href={item.href} key={item.label}>
                  {item.label}
                </a>
              ) : (
                <button className={item.active ? "active" : ""} key={item.label} onClick={item.onClick} type="button">
                  {item.label}
                </button>
              )
            )}
          </nav>
        </div>
        <div className="dashboard-sidebar-footer">
          {userLabel ? <span>{userLabel}</span> : null}
          <a href="/login">Sign out</a>
        </div>
      </aside>

      <section className="dashboard-content">
        <header className="dashboard-topbar">
          <div className="dashboard-title-group">
            {eyebrow ? <div className="dashboard-eyebrow">{eyebrow}</div> : null}
            <h1>{title}</h1>
          </div>
          <div className="dashboard-topbar-actions">
            {actions}
            {status ? <div className="dashboard-status">{status}</div> : null}
            <button className="dashboard-icon-button" type="button" aria-label="Notifications">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path
                  d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 0 1-6 0m6 0H9"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                />
              </svg>
            </button>
            <button className="dashboard-avatar" type="button" aria-label={userLabel ? `${userLabel} profile` : "User profile"}>
              {getInitials(userLabel)}
            </button>
          </div>
        </header>
        <div className="dashboard-main" role="main">
          {children}
        </div>
      </section>
    </main>
  );
}

function getInitials(label?: string) {
  if (!label) {
    return "MS";
  }

  return label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
