// Web Push registration [add-on to #6].
//
// Everything here is capability-checked before it is used. Push is unavailable
// in more browsers than it is available in — Safari below 16.4, every browser in
// a private window, iOS unless the app is installed to the home screen — and the
// UI has to be able to ask "can this device even do it?" without throwing.

import { apiFetch } from "./api";

export function pushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function pushPermission() {
  if (!pushSupported()) return "unsupported";
  return Notification.permission; // "default" | "granted" | "denied"
}

// The VAPID public key arrives base64url and the browser wants raw bytes.
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function registration() {
  return navigator.serviceWorker.register("/sw.js");
}

/** Is push configured on the server at all? → { enabled, key } */
export async function pushConfig() {
  const res = await apiFetch("/push/key");
  if (!res.ok) return { enabled: false, key: null };
  return res.json();
}

/** Current subscription for this browser, or null. Never prompts. */
export async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

/**
 * Ask permission and subscribe. Returns true on success.
 *
 * MUST be called from a user gesture: browsers refuse (and Safari permanently
 * denies) a permission prompt raised on page load. That is why there is no
 * "subscribe on mount" anywhere — it has to be a tap.
 */
export async function enablePush() {
  if (!pushSupported()) throw new Error("This browser can't do notifications.");

  const { enabled, key } = await pushConfig();
  if (!enabled) throw new Error("Notifications aren't set up on this server yet.");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    // "denied" is sticky in every browser — the app cannot ask again, and the
    // reader has to change it in site settings. Say so rather than retrying.
    throw new Error(
      permission === "denied"
        ? "Notifications are blocked for this site. You can turn them back on in your browser's site settings."
        : "Notifications weren't allowed."
    );
  }

  const reg = await registration();
  await navigator.serviceWorker.ready;

  const sub =
    (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({
      // Required to be true by every browser: a push that shows nothing is not
      // allowed, so there is no silent-push path to opt into.
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    }));

  const json = sub.toJSON();
  const res = await apiFetch("/push/subscribe", {
    method: "POST",
    body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
  });
  if (!res.ok) throw new Error("Couldn't register this device.");
  return true;
}

/**
 * Subscribe WITHOUT prompting, but only if permission was already granted.
 *
 * This is the honest version of "on by default". The browser owns the
 * permission decision and will not surrender it — but once a reader has said
 * yes, staying subscribed should be the default, and they should not have to
 * re-enable it after clearing storage, reinstalling the app, or landing on a new
 * device where the grant already exists.
 *
 * Safe to call on every load: it never shows a prompt, and returns false rather
 * than throwing when there is nothing to do.
 */
export async function autoSubscribeIfGranted() {
  if (!pushSupported()) return false;
  if (Notification.permission !== "granted") return false;   // never prompts

  try {
    const existing = await currentSubscription();
    if (existing) {
      // Already subscribed in this browser — re-register with the server anyway.
      // The row may be gone (pruned as dead, or a fresh database), and the
      // browser would happily keep a subscription the server has never heard of.
      const json = existing.toJSON();
      await apiFetch("/push/subscribe", {
        method: "POST",
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      return true;
    }
    return await enablePush();
  } catch {
    // A courtesy layer: never let this break a page load.
    return false;
  }
}

/** Unsubscribe this browser. Tells the server first, so a failure to reach it
 *  doesn't leave a live server-side row pointing at a dead endpoint. */
export async function disablePush() {
  const sub = await currentSubscription();
  if (!sub) return true;

  await apiFetch("/push/unsubscribe", {
    method: "POST",
    body: JSON.stringify({ endpoint: sub.endpoint }),
  }).catch(() => {});

  await sub.unsubscribe();
  return true;
}
