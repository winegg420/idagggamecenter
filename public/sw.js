/* Bildim! service worker — kurulabilirlik + (ileride) push bildirimleri */

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Ağ öncelikli: çevrimdışı destek değil, kurulabilirlik için yeterli
self.addEventListener("fetch", () => {});

// Push bildirimleri
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let veri = {};
  try {
    veri = event.data.json();
  } catch {
    veri = { baslik: "QuizzExam", govde: event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(veri.baslik ?? "QuizzExam", {
      body: veri.govde ?? "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: veri.url ?? "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((pencereler) => {
      for (const p of pencereler) {
        if ("focus" in p) {
          p.navigate(url);
          return p.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
