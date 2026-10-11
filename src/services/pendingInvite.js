// Where a signed-out reader was headed, so signing in (or signing up) lands them
// back on that exact page — path, query and #section — instead of the shelf.
// Covers every in-app link: a digest notification, a push, a shared deep link,
// a collection invite. [#5]
//
// Its own module rather than a constant exported from App: pages lazy-imported
// BY App use it too, and importing back from App is a cycle waiting to bite.
//
// sessionStorage, not localStorage — a half-finished trip should not outlive the
// tab. Every access is guarded: storage can be unavailable (private mode, blocked
// cookies) and a return path is never worth crashing the page over.

const KEY = "bibliome_return_to";

// Only ever a path inside this app: "/x", never "//evil.com" or a full URL.
const isAppPath = (p) => typeof p === "string" && p.startsWith("/") && !p.startsWith("//") && !p.includes("\\");

export function stashReturn(path) {
  if (!isAppPath(path)) return;
  try { sessionStorage.setItem(KEY, path); } catch { /* storage unavailable */ }
}

/** Read and clear in one step — a parked destination is used exactly once. */
export function takeReturn() {
  try {
    const path = sessionStorage.getItem(KEY);
    if (path) sessionStorage.removeItem(KEY);
    return isAppPath(path) ? path : null;
  } catch {
    return null;
  }
}

export function stashInvite(token) {
  stashReturn(`/collections/join/${token}`);
}
