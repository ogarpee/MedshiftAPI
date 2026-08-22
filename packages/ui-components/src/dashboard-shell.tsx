"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { MedShiftLogo } from "./medshift-logo";

export type DashboardNavItem = {
  label: string;
  active?: boolean;
  href?: string;
  onClick?: () => void;
};

export type DashboardNotificationItem = {
  body: string;
  createdAt?: string;
  href?: string;
  id: string;
  metadata?: Record<string, string>;
  readAt?: string | null;
  title: string;
  type: string;
  userId: string;
};

type DashboardShellProps = {
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  eyebrow?: ReactNode;
  navItems: DashboardNavItem[];
  notificationLoading?: boolean;
  notifications?: DashboardNotificationItem[];
  onMarkAllNotificationsRead?: () => void;
  onNotificationClick?: (notification: DashboardNotificationItem) => void;
  status?: ReactNode;
  title: string;
  unreadNotificationCount?: number;
  userLabel?: string;
};

export function DashboardShell({
  actions,
  children,
  className,
  eyebrow,
  navItems,
  notificationLoading,
  notifications = [],
  onMarkAllNotificationsRead,
  onNotificationClick,
  status,
  title,
  unreadNotificationCount = 0,
  userLabel
}: DashboardShellProps) {
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);

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
            <h1>{title}</h1>
          </div>
          <div className="dashboard-topbar-actions">
            {eyebrow ? <div className="dashboard-eyebrow">{eyebrow}</div> : null}
            {actions}
            {status ? <div className="dashboard-status">{status}</div> : null}
            <div className="dashboard-notification-menu">
              <button
                className={unreadNotificationCount > 0 ? "dashboard-icon-button has-unread" : "dashboard-icon-button"}
                type="button"
                aria-expanded={isNotificationPanelOpen}
                aria-label={unreadNotificationCount > 0 ? `${unreadNotificationCount} unread notifications` : "Notifications"}
                onClick={() => setIsNotificationPanelOpen((current) => !current)}
              >
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
                {unreadNotificationCount > 0 ? <span>{unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}</span> : null}
              </button>
              {isNotificationPanelOpen ? (
                <section className="notification-popover" aria-label="Notifications">
                  <header>
                    <strong>Notifications</strong>
                    <button disabled={!unreadNotificationCount || !onMarkAllNotificationsRead} type="button" onClick={onMarkAllNotificationsRead}>
                      Mark all read
                    </button>
                  </header>
                  <div className="notification-list">
                    {notificationLoading ? <p className="notification-empty">Loading notifications...</p> : null}
                    {!notificationLoading && notifications.length === 0 ? <p className="notification-empty">No notifications yet.</p> : null}
                    {!notificationLoading
                      ? notifications.map((notification) => (
                          <a
                            className={notification.readAt ? "notification-item" : "notification-item unread"}
                            href={notification.href ?? "#"}
                            key={notification.id}
                            onClick={(event) => {
                              if (!notification.href) {
                                event.preventDefault();
                              }

                              onNotificationClick?.(notification);
                              setIsNotificationPanelOpen(false);
                            }}
                          >
                            <span />
                            <div>
                              <strong>{notification.title}</strong>
                              <p>{notification.body}</p>
                              {notification.createdAt ? <time>{formatNotificationTime(notification.createdAt)}</time> : null}
                            </div>
                          </a>
                        ))
                      : null}
                  </div>
                </section>
              ) : null}
            </div>
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

function formatNotificationTime(value: string) {
  const timestamp = new Date(value).getTime();

  if (Number.isNaN(timestamp)) {
    return "";
  }

  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) {
    return "Just now";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  return new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric" }).format(new Date(value));
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
