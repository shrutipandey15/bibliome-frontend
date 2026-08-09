import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { getNotifications, markNotificationsRead } from "../../services/api";
import { notificationTarget } from "./target";
import Modal from "../Modal";
import "./NotificationCenter.css";

/**
 * The notification center — the in-app source of truth. [F4.1 / B4.1]
 *
 * Calm-first: the bell shows a PRESENCE dot, not a number (no guilt-inducing
 * unread count). Renders the weekly digest [F4.2] and echo-reply notices [F3.8]
 * inline, and every item that has somewhere to go is a button that goes there.
 *
 * ## On "immediate" vs "batched"
 *
 * Direct notices — echo replies, resonance, a DNA shift — are tier 1 and the
 * server writes them with `deliver_after = now`. They are already immediate.
 * Only `weekly_digest` is weekly, and that one has its own switch in Settings.
 *
 * What used to make them FEEL slow was here, not there: this component fetched
 * once on mount and once per open, so a tab left sitting on the shelf never
 * learned anything had arrived. Hence the poll and the visibility refresh below.
 *
 * (Two server-side things can still delay or merge an item, and both are the
 * user's own settings: quiet hours defer tier 1/2 to the end of the window, and
 * repeat events on the SAME echo or thread coalesce into one unread row rather
 * than N rows. Neither is a delivery delay for the first event.)
 */

// Quiet enough not to be a drain, frequent enough that a reply lands within a
// minute of arriving. The tab also refetches whenever it regains focus, which is
// what actually covers the "came back after lunch" case.
const POLL_MS = 60_000;
function timeAgo(iso) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function DigestItem({ payload }) {
  const books = payload?.books_this_week ?? 0;
  return (
    <div className="nc-digest">
      <div className="label nc-digest-label">· your reading week ·</div>
      <div className="nc-digest-line">
        {books > 0
          ? <>You shelved <strong>{books}</strong> book{books === 1 ? "" : "s"} this week.</>
          : <>A quiet week — nothing shelved. That's allowed.</>}
      </div>
      {payload?.memory && <div className="nc-digest-memory">↺ {payload.memory}</div>}
    </div>
  );
}

function itemText(n) {
  const p = n.payload || {};
  if (n.kind === "echo_reply") {
    const actors = p.actors || [];
    const count = p.count || actors.length || 1;
    const who = count === 1 && actors[0] ? `@${actors[0]}` : `${count} readers`;
    return <>{who} replied to your echo{p.book_title ? <> about <em>{p.book_title}</em></> : ""}.</>;
  }
  // Resonance notices are deliberately contentless — the payload names no book
  // and no person, so a notification preview can't become the identity leak the
  // API is built to prevent. Copy stays just as vague on purpose.
  if (n.kind === "resonance_reach") return <>Someone who read a book the way you did left you a note.</>;
  if (n.kind === "resonance_connected") return <>You and another reader both said yes. Your letters are open.</>;
  if (n.kind === "resonance_message") return <>A letter arrived.</>;
  if (p.message) return p.message; // security + generic
  return n.kind.replace(/_/g, " ");
}

export default function NotificationCenter() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getNotifications();
    setItems(data.notifications || []);
    setUnread(data.unread_count || 0);
    setLoading(false);
  }, []);

  // Load once on mount so the presence dot is accurate before opening.
  useEffect(() => { load(); }, [load]);

  // Keep it accurate afterwards. Without this the dot only ever reflected the
  // state of the world at page load.
  const openRef = useRef(open);
  openRef.current = open;
  useEffect(() => {
    // Don't refetch while the panel is open — reordering the list under the
    // reader's cursor is worse than a few seconds of staleness.
    const tick = () => { if (!openRef.current && document.visibilityState === "visible") load(); };
    const id = setInterval(tick, POLL_MS);
    // A backgrounded tab is throttled and may have missed hours of ticks, so
    // catch up the moment it comes back rather than waiting for the next one.
    const onVisible = () => { if (document.visibilityState === "visible") tick(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [load]);

  // Clicking an item is an acknowledgement, so it reads itself on the way out —
  // no "mark read" chore for something you just went and looked at. Optimistic:
  // the navigation must not wait on the write, and a failed mark is harmless.
  const openItem = (n, to) => {
    if (!n.read) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setUnread((c) => Math.max(0, c - 1));
      markNotificationsRead([n.id]).catch(() => {});
    }
    setOpen(false);
    navigate(to);
  };

  const markAll = async () => {
    try {
      await markNotificationsRead(null);
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnread(0);
    } catch { /* keep state; a retry is harmless */ }
  };

  return (
    <>
      <button
        className="nc-bell"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        onClick={() => { setOpen(true); load(); }}
      >
        <Bell size={18} />
        {unread > 0 && <span className="nc-dot" aria-hidden="true" />}
      </button>

      {open && (
        <Modal onClose={() => setOpen(false)} ariaLabel="Notifications" className="rr-modal-card" backdropClassName="rr-modal-backdrop">
          <div className="nc">
            <div className="nc-head">
              <div className="label">notifications</div>
              {items.some((n) => !n.read) && (
                <button className="nc-markall" onClick={markAll}>mark all read</button>
              )}
            </div>

            <div className="nc-list" aria-live="polite">
              {loading ? (
                <div className="nc-empty">loading…</div>
              ) : items.length === 0 ? (
                <div className="nc-empty">You're all caught up. Nothing new.</div>
              ) : (
                items.map((n) => {
                  const to = notificationTarget(n);
                  const body = (
                    <>
                      {!n.read && <span className="nc-item-dot" aria-hidden="true" />}
                      <div className="nc-item-body">
                        {n.kind === "weekly_digest"
                          ? <DigestItem payload={n.payload} />
                          : <div className="nc-item-text">{itemText(n)}</div>}
                        <div className="nc-item-time">{timeAgo(n.created_at)}</div>
                      </div>
                      {/* A quiet affordance, not a call to action. */}
                      {to && <span className="nc-item-go" aria-hidden="true">→</span>}
                    </>
                  );
                  const cls = `nc-item ${n.read ? "" : "unread"}`;
                  // Only the ones that lead somewhere become buttons. A row that
                  // navigates nowhere should not look, focus, or announce like a
                  // control — an unrecognised kind is a message, not a link.
                  return to ? (
                    <button
                      key={n.id}
                      type="button"
                      className={`${cls} nc-item-clickable`}
                      onClick={() => openItem(n, to)}
                    >
                      {body}
                    </button>
                  ) : (
                    <div key={n.id} className={cls}>{body}</div>
                  );
                })
              )}
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
