self.addEventListener("push", (event) => {
  if (!event.data) {
    return;
  }

  const payload = event.data.json();
  const itemId = payload.tag || "praxis-notification";

  event.waitUntil(
    self.registration.showNotification(payload.title || "Praxis Protocol", {
      body: payload.body || "Existe uma tarefa aguardando execução.",
      icon: payload.icon || "/logo.png",
      badge: payload.badge || "/logo.png",
      tag: itemId,
      data: {
        url: payload.url || "/tasks",
        itemId,
        title: payload.title,
        body: payload.body,
      },
      requireInteraction: payload.requireInteraction ?? true,
      silent: payload.silent ?? false,
      vibrate: payload.vibrate || [250, 100, 250],
      // Botão "Adiar 15min" — o handler abaixo chama /api/notifications/snooze
      // que registra um re-disparo daqui a 15 min no dispatch loop.
      actions: [
        { action: "snooze", title: "Adiar 15 min" },
        { action: "open", title: "Abrir" },
      ],
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  const data = event.notification?.data || {};
  const targetUrl = data.url || "/tasks";
  const itemId = data.itemId;

  if (event.action === "snooze") {
    event.notification.close();
    event.waitUntil(
      fetch("/api/notifications/snooze", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: itemId || "unknown",
          minutes: 15,
          title: data.title || "",
          body: data.body || "",
        }),
      }).catch(() => undefined),
    );
    return;
  }

  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }

      return undefined;
    }),
  );
});
