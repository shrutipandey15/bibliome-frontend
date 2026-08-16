/* Service worker — Web Push only. [add-on to #6]
 *
 * Deliberately NOT a caching/offline worker. Adding a fetch handler here would
 * quietly put a cache in front of every request in the app, which is a large
 * behaviour change to smuggle in under "notifications". This worker listens for
 * pushes and nothing else.
 */

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // A malformed payload must still produce a knock rather than nothing.
    data = {};
  }

  const title = data.title || "Bibliome";
  const options = {
    body: data.body || "Something happened in your library.",
    icon: "/favicon.png",
    badge: "/favicon.png",
    // Collapses repeats about the same conversation into one notification,
    // matching how the server coalesces them.
    tag: data.tag || "bibliome",
    renotify: false,
    data: { url: data.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      // Reuse an open tab rather than piling up new ones. Only same-origin
      // clients are considered, and `url` is always a server-built path.
      for (const client of list) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
