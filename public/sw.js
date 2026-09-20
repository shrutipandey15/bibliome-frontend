/* Service worker — Web Push only. [add-on to #6]
 *
 * Deliberately NOT a caching/offline worker. Adding a fetch handler here would
 * quietly put a cache in front of every request in the app, which is a large
 * behaviour change to smuggle in under "notifications". This worker listens for
 * pushes and nothing else.
 */

// Take over as soon as a new worker is deployed, instead of waiting for every
// tab to close. An installed PWA is rarely all-closed, so without these two an
// updated worker could sit in "waiting" for weeks — including a fix to where a
// notification click lands. Safe here precisely because this worker has no
// fetch handler: claiming controls navigation, it does not put a cache in front
// of anything.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

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
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    // Collapses repeats about the same conversation into ONE notification in
    // the shade, matching how the server coalesces them.
    tag: data.tag || "bibliome",
    // ...but re-alerts when one does arrive. The server already decides when a
    // thread has earned another knock (it rate-limits repeats per thread), so
    // renotify:false here meant a genuine second knock landed silently — the
    // device replaced the old notification with no sound, no buzz, no screen.
    renotify: true,
    data: { url: data.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = (event.notification.data && event.notification.data.url) || "/";
  // Always same-origin: `url` is a server-built path, never a whole URL.
  const target = new URL(path, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const list = await self.clients.matchAll({ type: "window", includeUncontrolled: true });

      // Already looking at it — just bring it forward.
      for (const client of list) {
        if (client.url === target && "focus" in client) return client.focus();
      }

      // Otherwise steer an open tab there, rather than piling up new ones.
      //
      // navigate() only works on a client THIS worker controls, and a tab open
      // since before the worker activated is not controlled. That rejection used
      // to be swallowed — the promise was never awaited — so the tab came
      // forward still sitting on whatever page it was on, which is why every
      // notification looked like it opened the home page.
      for (const client of list) {
        try {
          const navigated = await client.navigate(target);
          if (navigated) return navigated.focus();
          // navigate() can resolve null when the client is gone; keep looking.
        } catch {
          // Uncontrolled or cross-origin — a new window still lands in the
          // right place, which is the thing that actually matters here.
          break;
        }
      }

      return self.clients.openWindow(target);
    })()
  );
});
