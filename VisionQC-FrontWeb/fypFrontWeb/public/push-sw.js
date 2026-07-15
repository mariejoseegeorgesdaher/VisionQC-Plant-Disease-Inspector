self.addEventListener("push", (event) => {
  if (!event.data) {
    return;
  }

  let payload = {};

  try {
    payload = event.data.json();
  } catch {
    payload = {
      title: "Vision QC Reminder",
      body: event.data.text(),
      url: "/",
      tag: "visionqc-reminder",
    };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || "Vision QC Reminder", {
      body: payload.body || "It's time to re-scan your plant.",
      data: {
        url: payload.url || "/",
      },
      tag: payload.tag || "visionqc-reminder",
      badge: "/brand-logo.png",
      icon: "/brand-logo.png",
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.postMessage({ type: "visionqc-reminder-click", url: targetUrl });
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }

      return undefined;
    })
  );
});
