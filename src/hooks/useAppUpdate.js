import { useEffect, useRef, useState } from "react";

/**
 * Notices when a newer build has been deployed and gets the app onto it.
 *
 * Why this exists: an installed PWA window can stay open for days. Nothing here
 * caches (the service worker is push-only), but a window that is never closed
 * also never re-fetches index.html, so it keeps running whatever build it
 * loaded. This polls a tiny /version.json — written per build by the
 * `bibliome-version-manifest` Vite plugin — and compares it to the id baked
 * into the running bundle.
 *
 * Behaviour when a new build is seen:
 *   - returning to the window after it was backgrounded for >1 min → reload
 *     immediately. That is the safe moment: nothing is half-typed, and the OS
 *     may have been about to evict the tab anyway.
 *   - otherwise → surface `updateReady` so the UI can offer a tap-to-refresh.
 *     We never yank the page out from under someone mid-entry.
 *
 * For this to work in production, the server must send index.html and
 * version.json with `Cache-Control: no-store` (the hashed assets stay
 * immutable). See deploy/bibliome.nginx.conf in the backend repo.
 */

const BUILD_ID = typeof __BUILD_ID__ !== "undefined" ? __BUILD_ID__ : "dev";
const POLL_MS = 10 * 60 * 1000;
const AWAY_BEFORE_AUTORELOAD_MS = 60 * 1000;

async function fetchDeployedBuildId() {
  try {
    const res = await fetch("/version.json", { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.buildId === "string" ? data.buildId : null;
  } catch {
    // Offline or a transient blip — try again on the next tick.
    return null;
  }
}

export default function useAppUpdate() {
  const [updateReady, setUpdateReady] = useState(false);
  const readyRef = useRef(false);

  useEffect(() => {
    // Dev restarts change the build id on every boot; leave HMR alone.
    if (!import.meta.env.PROD) return;

    let cancelled = false;
    let hiddenAt = 0;

    const markReady = () => {
      if (cancelled || readyRef.current) return;
      readyRef.current = true;
      setUpdateReady(true);
    };

    const check = async () => {
      const deployed = await fetchDeployedBuildId();
      if (deployed && deployed !== BUILD_ID) markReady();
    };

    const onVisibility = async () => {
      if (document.hidden) {
        hiddenAt = Date.now();
        return;
      }
      const awayMs = hiddenAt ? Date.now() - hiddenAt : 0;
      await check();
      if (!cancelled && readyRef.current && awayMs > AWAY_BEFORE_AUTORELOAD_MS) {
        window.location.reload();
      }
    };

    check();
    const id = setInterval(check, POLL_MS);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return updateReady;
}
