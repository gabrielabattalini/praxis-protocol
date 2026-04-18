"use client";

import { useCallback, useMemo } from "react";
import {
  NotificationSyncProvider,
  useNotificationSync,
} from "@/components/providers/notification-sync-provider";
import { useAppStore } from "@/components/providers/app-store-provider";

type RegistrationState =
  | "idle"
  | "registered"
  | "registering"
  | "unsupported"
  | "error";

type SubscriptionState =
  | "idle"
  | "subscribed"
  | "subscribing"
  | "unsupported"
  | "error";

type SyncState =
  | "idle"
  | "syncing"
  | "synced"
  | "backend-unavailable"
  | "error";

export function NotificationsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <NotificationSyncProvider>{children}</NotificationSyncProvider>;
}

export function usePushNotifications() {
  const { state, actions } = useAppStore();
  const {
    supported,
    permission,
    subscriptionActive,
    syncing,
    busy,
    error,
    status,
    requestBrowserNotifications,
    disableBrowserNotifications,
    syncNow,
    sendTestNotification,
  } = useNotificationSync();

  const enabled = state.settings.notifications;

  const registrationState = useMemo<RegistrationState>(() => {
    if (!supported) return "unsupported";
    if (busy) return "registering";
    if (subscriptionActive || permission === "granted") return "registered";
    if (error) return "error";
    return "idle";
  }, [busy, error, permission, subscriptionActive, supported]);

  const subscriptionState = useMemo<SubscriptionState>(() => {
    if (!supported) return "unsupported";
    if (busy) return "subscribing";
    if (subscriptionActive) return "subscribed";
    if (error) return "error";
    return "idle";
  }, [busy, error, subscriptionActive, supported]);

  const syncState = useMemo<SyncState>(() => {
    if (!supported) return "idle";
    if (syncing) return "syncing";
    if (status.lastSyncedAt) return "synced";
    if (error) return "error";
    return "idle";
  }, [error, status.lastSyncedAt, supported, syncing]);

  const endpointStatus = useMemo(() => {
    if (!supported) {
      return "Navegador sem suporte a push.";
    }

    const parts = [
      `${status.deviceCount ?? 0} dispositivo(s)`,
      `${status.itemCount ?? 0} alerta(s)`,
    ];

    if (status.timezone) {
      parts.push(status.timezone);
    }

    return parts.join(" - ");
  }, [status.deviceCount, status.itemCount, status.timezone, supported]);

  const activatePush = useCallback(async () => {
    await requestBrowserNotifications();
  }, [requestBrowserNotifications]);

  const togglePush = useCallback(async () => {
    if (enabled || subscriptionActive) {
      if (state.settings.notifications) {
        actions.toggleSetting("notifications");
      }
      await disableBrowserNotifications();
      return;
    }

    await requestBrowserNotifications();
  }, [
    actions,
    disableBrowserNotifications,
    enabled,
    requestBrowserNotifications,
    state.settings.notifications,
    subscriptionActive,
  ]);

  return {
    supported,
    enabled,
    permission,
    registrationState,
    subscriptionState,
    syncState,
    lastSyncAt: status.lastSyncedAt,
    lastError: error,
    endpointStatus,
    hasSubscription: subscriptionActive,
    deviceCount: status.deviceCount ?? 0,
    itemCount: status.itemCount ?? 0,
    activatePush,
    togglePush,
    syncNow,
    sendTestNotification,
  };
}
