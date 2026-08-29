/**
 * In-app realtime client. [realtime phase 1 — instant message + notification delivery]
 *
 * One WebSocket for the whole authed session, shared by every surface that
 * wants to know when something changed. Server→client only for now; sending
 * still goes over REST.
 *
 * Every consumer keeps its polling fallback, so if the socket can't connect
 * (no Redis on the server, a hostile proxy, an ancient browser) the app still
 * works — just not instantly. Nothing here throws into a caller.
 *
 * Auth: a browser can't set headers on the WS handshake, so the first frame we
 * send is {type:"auth", token:<access JWT>}. A stale token comes back as
 * {type:"auth_error"}; we refresh and the reconnect picks up the new one.
 */
import { getAccessToken, refreshOnce } from "./api";

const listeners = new Set();

let ws = null;
let started = false;
let backoff = 1000;
let reconnectTimer = null;
let heartbeatTimer = null;
let lastBeat = 0;

const MAX_BACKOFF = 30000;
const BEAT_TIMEOUT = 45000; // server beats every 15s

function socketUrl() {
  const base = import.meta.env.VITE_API_URL || "/api";
  if (/^https?:/i.test(base)) {
    return base.replace(/^http/i, "ws").replace(/\/+$/, "") + "/realtime/ws";
  }
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}${base.replace(/\/+$/, "")}/realtime/ws`;
}

function emit(event) {
  for (const fn of listeners) {
    try { fn(event); } catch (e) { console.error("realtime listener threw", e); }
  }
}

function scheduleReconnect() {
  clearTimeout(reconnectTimer);
  if (!started) return;
  reconnectTimer = setTimeout(connect, backoff);
  backoff = Math.min(backoff * 2, MAX_BACKOFF);
}

async function connect() {
  if (!started) return;
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

  let token = getAccessToken();
  if (!token) {
    try { await refreshOnce(); token = getAccessToken(); } catch { /* retry below */ }
  }
  if (!token) { scheduleReconnect(); return; }

  let sock;
  try { sock = new WebSocket(socketUrl()); }
  catch { scheduleReconnect(); return; }
  ws = sock;

  sock.onopen = () => {
    try { sock.send(JSON.stringify({ type: "auth", token })); } catch { /* onclose handles it */ }
  };

  sock.onmessage = (e) => {
    let msg;
    try { msg = JSON.parse(e.data); } catch { return; }

    if (msg.type === "ping") { lastBeat = Date.now(); return; }
    if (msg.type === "ready") {
      lastBeat = Date.now();
      backoff = 1000;
      emit({ type: "__status", connected: true });
      return;
    }
    if (msg.type === "auth_error") {
      // Token was stale — refresh so the next connect carries a fresh one.
      refreshOnce().catch(() => {});
      return;
    }
    emit(msg);
  };

  sock.onclose = () => {
    if (ws === sock) ws = null;
    emit({ type: "__status", connected: false });
    scheduleReconnect();
  };

  sock.onerror = () => { try { sock.close(); } catch { /* noop */ } };
}

function watchHeartbeat() {
  clearInterval(heartbeatTimer);
  heartbeatTimer = setInterval(() => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (lastBeat && Date.now() - lastBeat > BEAT_TIMEOUT) {
      try { ws.close(); } catch { /* onclose reconnects */ }
    }
  }, 15000);
}

function onVisible() {
  if (
    document.visibilityState === "visible" &&
    started &&
    (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING)
  ) {
    backoff = 1000;
    connect();
  }
}

/** Open the shared connection. Idempotent. Call once the session is authed. */
export function startRealtime() {
  if (started) return;
  started = true;
  lastBeat = 0;
  watchHeartbeat();
  connect();
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("online", onVisible);
}

/** Tear it down on logout / unmount. */
export function stopRealtime() {
  started = false;
  clearTimeout(reconnectTimer);
  clearInterval(heartbeatTimer);
  document.removeEventListener("visibilitychange", onVisible);
  window.removeEventListener("online", onVisible);
  if (ws) {
    try { ws.close(); } catch { /* noop */ }
    ws = null;
  }
}

/** Subscribe to every event. Returns an unsubscribe fn. */
export function onRealtime(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Current connection state, for a status indicator. */
export function isRealtimeConnected() {
  return !!ws && ws.readyState === WebSocket.OPEN;
}
