"use client";

import type { ReactNode } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { Avatar, AvatarFallback } from "./avatar";
import { Button } from "./button";
import { MedShiftLogo } from "./medshift-logo";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

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
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  className={unreadNotificationCount > 0 ? "dashboard-icon-button has-unread" : "dashboard-icon-button"}
                  size="icon"
                  type="button"
                  variant="outline"
                  aria-label={unreadNotificationCount > 0 ? `${unreadNotificationCount} unread notifications` : "Notifications"}
                >
                  <Bell aria-hidden="true" />
                  {unreadNotificationCount > 0 ? <span>{unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}</span> : null}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="notification-popover" align="end" aria-label="Notifications">
                  <header>
                    <strong>Notifications</strong>
                    <Button disabled={!unreadNotificationCount || !onMarkAllNotificationsRead} type="button" onClick={onMarkAllNotificationsRead} size="sm" variant="ghost">
                      <CheckCheck aria-hidden="true" />
                      Mark all read
                    </Button>
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
              </PopoverContent>
            </Popover>
            <Button className="dashboard-avatar" size="icon" type="button" variant="ghost" aria-label={userLabel ? `${userLabel} profile` : "User profile"}>
              <Avatar>
                <AvatarFallback>{getInitials(userLabel)}</AvatarFallback>
              </Avatar>
            </Button>
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
