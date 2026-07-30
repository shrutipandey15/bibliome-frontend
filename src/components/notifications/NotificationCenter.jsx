import { useState, useEffect, useCallback } from "react";
import { Bell } from "lucide-react";
import { getNotifications, markNotificationsRead } from "../../services/api";
import Modal from "../Modal";
import "./NotificationCenter.css";

/**
 * The notification center — the in-app source of truth. [F4.1 / B4.1]
 *
 * Calm-first: the bell shows a PRESENCE dot, not a number (no guilt-inducing
 * unread count). Items are already batched server-side (e.g. "3 readers replied").
 * Renders the weekly digest [F4.2] and echo-reply notices [F3.8] inline.
 */
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
                items.map((n) => (
                  <div key={n.id} className={`nc-item ${n.read ? "" : "unread"}`}>
                    {!n.read && <span className="nc-item-dot" aria-hidden="true" />}
                    <div className="nc-item-body">
                      {n.kind === "weekly_digest"
                        ? <DigestItem payload={n.payload} />
                        : <div className="nc-item-text">{itemText(n)}</div>}
                      <div className="nc-item-time">{timeAgo(n.created_at)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
