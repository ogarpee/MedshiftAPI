"use client";

import { useCallback, useEffect, useState } from "react";
import type { NotificationSummary } from "@medshift/shared-types";

type NotificationResponse = {
  items: NotificationSummary[];
  unreadCount: number;
};

export function useDashboardNotifications(apiUrl: string) {
  const [notifications, setNotifications] = useState<NotificationSummary[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);

  const loadNotifications = useCallback(async () => {
    const token = window.localStorage.getItem("medshift.accessToken");

    if (!token) {
      setNotifications([]);
      setUnreadNotificationCount(0);
      return;
    }

    setIsLoadingNotifications(true);

    try {
      const response = await fetch(`${apiUrl}/notifications?limit=20`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error("Unable to load notifications");
      }

      const result = (await response.json()) as NotificationResponse;
      setNotifications(result.items);
      setUnreadNotificationCount(result.unreadCount);
    } catch {
      setNotifications([]);
      setUnreadNotificationCount(0);
    } finally {
      setIsLoadingNotifications(false);
    }
  }, [apiUrl]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const markNotificationRead = useCallback(
    async (notification: NotificationSummary) => {
      if (notification.readAt) {
        return;
      }

      const token = window.localStorage.getItem("medshift.accessToken");

      if (!token) {
        return;
      }

      setNotifications((current) =>
        current.map((item) => (item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item))
      );
      setUnreadNotificationCount((current) => Math.max(current - 1, 0));

      await fetch(`${apiUrl}/notifications/${notification.id}/read`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => {
        void loadNotifications();
      });
    },
    [apiUrl, loadNotifications]
  );

  const markAllNotificationsRead = useCallback(async () => {
    const token = window.localStorage.getItem("medshift.accessToken");

    if (!token) {
      return;
    }

    const readAt = new Date().toISOString();
    setNotifications((current) => current.map((notification) => ({ ...notification, readAt })));
    setUnreadNotificationCount(0);

    await fetch(`${apiUrl}/notifications/read-all`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` }
    }).catch(() => {
      void loadNotifications();
    });
  }, [apiUrl, loadNotifications]);

  return {
    isLoadingNotifications,
    loadNotifications,
    markAllNotificationsRead,
    markNotificationRead,
    notifications,
    unreadNotificationCount
  };
}
