"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuthClient } from "@/components/providers/auth-client-provider";
import { useAppStore } from "@/components/providers/app-store-provider";
import { buildNotificationSyncPayload } from "@/lib/notification-schedule";

type NotificationPermissionState = NotificationPermission | "unsupported";

type NotificationStatus = {
  deviceCount: number;
  itemCount: number;
  lastSyncedAt?: string;
  timezone?: string;
};

type NotificationSyncContextValue = {
  supported: boolean;
  permission: NotificationPermissionState;
  subscriptionActive: boolean;
  syncing: boolean;
  busy: boolean;
  error: string;
  status: NotificationStatus;
  requestBrowserNotifications: () => Promise<void>;
  disableBrowserNotifications: () => Promise<void>;
  syncNow: () => Promise<void>;
  sendTestNotification: () => Promise<void>;
};

const NotificationSyncContext =
  createContext<NotificationSyncContextValue | null>(null);

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}

function getDefaultDeviceLabel() {
  if (typeof navigator === "undefined") {
    return "Navegador";
  }

  const userAgent = navigator.userAgent.toLowerCase();
  const platform = /android/.test(userAgent)
    ? "Android"
    : /iphone|ipad|ios/.test(userAgent)
      ? "iPhone"
      : /windows/.test(userAgent)
        ? "Windows"
        : /mac/.test(userAgent)
          ? "Mac"
          : "Navegador";

  return `Praxis em ${platform}`;
}

export function NotificationSyncProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId, isLoaded } = useAuthClient();
  const { hydrated, state, actions } = useAppStore();
  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;
  const [permission, setPermission] = useState<NotificationPermissionState>(
    supported ? Notification.permission : "unsupported",
  );
  const [subscriptionActive, setSubscriptionActive] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<NotificationStatus>({
    deviceCount: 0,
    itemCount: 0,
  });
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const syncTimerRef = useRef<number | null>(null);

  const timezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo",
    [],
  );
  const syncPayload = useMemo(
    () =>
      buildNotificationSyncPayload(
        state.tasks,
        state.reminders,
        timezone,
        state.mealPlan,
        (state.customQuotes ?? []).map((quote) =>
          quote.author?.trim()
            ? `${quote.text} — ${quote.author.trim()}`
            : quote.text,
        ),
        state.hiddenQuotes ?? [],
        state.notificationPreWarnMinutes ?? 5,
      ),
    [
      state.customQuotes,
      state.hiddenQuotes,
      state.mealPlan,
      state.notificationPreWarnMinutes,
      state.reminders,
      state.tasks,
      timezone,
    ],
  );

  const fetchStatus = useCallback(async () => {
    if (!userId) return;

    const response = await fetch("/api/notifications/status", {
      credentials: "same-origin",
    });

    if (!response.ok) {
      throw new Error("N\u00e3o foi poss\u00edvel ler o status das notifica\u00e7\u00f5es.");
    }

    const nextStatus = (await response.json()) as NotificationStatus;
    setStatus({
      deviceCount: nextStatus.deviceCount ?? 0,
      itemCount: nextStatus.itemCount ?? 0,
      lastSyncedAt: nextStatus.lastSyncedAt,
      timezone: nextStatus.timezone,
    });
  }, [userId]);

  const registerServiceWorker = useCallback(async () => {
    if (!supported) {
      return null;
    }

    if (registrationRef.current) {
      return registrationRef.current;
    }

    const registration = await navigator.serviceWorker.register(
      "/praxis-notifications-sw.js",
      {
        scope: "/",
      },
    );

    registrationRef.current = registration;
    const existingSubscription = await registration.pushManager.getSubscription();
    setSubscriptionActive(Boolean(existingSubscription));

    return registration;
  }, [supported]);

  const unsubscribeCurrentBrowser = useCallback(async () => {
    const registration = await registerServiceWorker();
    const subscription = await registration?.pushManager.getSubscription();

    if (!subscription) {
      setSubscriptionActive(false);
      return;
    }

    await fetch("/api/notifications/unsubscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "same-origin",
      body: JSON.stringify({
        endpoint: subscription.endpoint,
      }),
    });

    await subscription.unsubscribe();
    setSubscriptionActive(false);
    await fetchStatus();
  }, [fetchStatus, registerServiceWorker]);

  const ensurePushSubscription = useCallback(async () => {
    const registration = await registerServiceWorker();
    if (!registration) {
      return null;
    }

    const keyResponse = await fetch("/api/notifications/public-key", {
      credentials: "same-origin",
    });

    if (!keyResponse.ok) {
      throw new Error("N\u00e3o foi poss\u00edvel preparar a chave p\u00fablica de push.");
    }

    const { publicKey } = (await keyResponse.json()) as { publicKey: string };
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    const response = await fetch("/api/notifications/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "same-origin",
      body: JSON.stringify({
        subscription,
        deviceLabel: getDefaultDeviceLabel(),
        timezone,
        userAgent: navigator.userAgent,
      }),
    });

    if (!response.ok) {
      throw new Error(
        "N\u00e3o foi poss\u00edvel registrar este dispositivo para notifica\u00e7\u00f5es.",
      );
    }

    setSubscriptionActive(true);
    await fetchStatus();
    return subscription;
  }, [fetchStatus, registerServiceWorker, timezone]);

  const syncNow = useCallback(async () => {
    if (!userId || !hydrated) {
      return;
    }

    setSyncing(true);
    setError("");

    try {
      const response = await fetch("/api/notifications/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify(syncPayload),
      });

      if (!response.ok) {
        throw new Error("N\u00e3o foi poss\u00edvel sincronizar a agenda de notifica\u00e7\u00f5es.");
      }

      const nextStatus = (await response.json()) as NotificationStatus;
      setStatus({
        deviceCount: nextStatus.deviceCount ?? 0,
        itemCount: nextStatus.itemCount ?? 0,
        lastSyncedAt: nextStatus.lastSyncedAt,
        timezone: nextStatus.timezone,
      });
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "N\u00e3o foi poss\u00edvel sincronizar a agenda de notifica\u00e7\u00f5es.",
      );
      throw nextError;
    } finally {
      setSyncing(false);
    }
  }, [hydrated, syncPayload, userId]);

  const requestBrowserNotifications = useCallback(async () => {
    if (!supported) {
      setError("Este navegador n\u00e3o suporta notifica\u00e7\u00f5es push.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);

      if (nextPermission !== "granted") {
        throw new Error("A permiss\u00e3o do navegador n\u00e3o foi concedida.");
      }

      if (!state.settings.notifications) {
        actions.toggleSetting("notifications");
      }

      await ensurePushSubscription();
      await syncNow();
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "N\u00e3o foi poss\u00edvel ativar as notifica\u00e7\u00f5es do navegador.",
      );
    } finally {
      setBusy(false);
    }
  }, [
    actions,
    ensurePushSubscription,
    state.settings.notifications,
    supported,
    syncNow,
  ]);

  const disableBrowserNotifications = useCallback(async () => {
    setBusy(true);
    setError("");

    try {
      await unsubscribeCurrentBrowser();
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "N\u00e3o foi poss\u00edvel desativar este dispositivo.",
      );
    } finally {
      setBusy(false);
    }
  }, [unsubscribeCurrentBrowser]);

  const sendTestNotification = useCallback(async () => {
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/notifications/test", {
        method: "POST",
        credentials: "same-origin",
      });

      if (!response.ok) {
        throw new Error("N\u00e3o foi poss\u00edvel enviar a notifica\u00e7\u00e3o de teste.");
      }
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "N\u00e3o foi poss\u00edvel enviar a notifica\u00e7\u00e3o de teste.",
      );
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!supported) {
      return;
    }

    void registerServiceWorker()
      .then(() => fetchStatus())
      .catch(() => {});
  }, [fetchStatus, registerServiceWorker, supported]);

  useEffect(() => {
    if (!isLoaded || !userId || !hydrated) {
      return;
    }

    if (syncTimerRef.current) {
      window.clearTimeout(syncTimerRef.current);
    }

    syncTimerRef.current = window.setTimeout(() => {
      void syncNow().catch((nextError) => {
        setError(
          nextError instanceof Error
            ? nextError.message
            : "N\u00e3o foi poss\u00edvel sincronizar os lembretes.",
        );
      });
    }, 900);

    return () => {
      if (syncTimerRef.current) {
        window.clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
    };
  }, [hydrated, isLoaded, syncNow, syncPayload, userId]);

  useEffect(() => {
    if (!supported || !isLoaded || !userId) {
      return;
    }

    setPermission(Notification.permission);

    if (!state.settings.notifications) {
      void unsubscribeCurrentBrowser().catch(() => {});
      return;
    }

    if (Notification.permission === "granted") {
      void ensurePushSubscription().catch(() => {});
    }
  }, [
    ensurePushSubscription,
    isLoaded,
    state.settings.notifications,
    supported,
    unsubscribeCurrentBrowser,
    userId,
  ]);

  const value = useMemo<NotificationSyncContextValue>(
    () => ({
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
    }),
    [
      busy,
      disableBrowserNotifications,
      error,
      permission,
      requestBrowserNotifications,
      sendTestNotification,
      status,
      subscriptionActive,
      supported,
      syncNow,
      syncing,
    ],
  );

  return (
    <NotificationSyncContext.Provider value={value}>
      {children}
    </NotificationSyncContext.Provider>
  );
}

export function useNotificationSync() {
  const context = useContext(NotificationSyncContext);

  if (!context) {
    throw new Error(
      "useNotificationSync precisa ser usado dentro de NotificationSyncProvider.",
    );
  }

  return context;
}
