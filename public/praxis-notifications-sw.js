self.addEventListener("push", (event) => {
  if (!event.data) {
    return;
  }

  const payload = event.data.json();

  event.waitUntil(
    self.registration.showNotification(payload.title || "Praxis Protocol", {
      body: payload.body || "Existe uma tarefa aguardando execução.",
      icon: payload.icon || "/logo.png",
      badge: payload.badge || "/logo.png",
      tag: payload.tag || "praxis-notification",
      data: {
        url: payload.url || "/tasks",
      },
      requireInteraction: payload.requireInteraction ?? true,
      silent: payload.silent ?? false,
      vibrate: payload.vibrate || [250, 100, 250],
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  const targetUrl = event.notification?.data?.url || "/tasks";
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
