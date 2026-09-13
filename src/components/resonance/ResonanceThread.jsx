import { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react";
import {
  getThreadMessages, sendThreadMessage, reactToThreadMessage, blockThread, reportThread,
} from "../../services/api";
import useRealtimeEvent from "../../hooks/useRealtimeEvent";
import useRealtimeStatus from "../../hooks/useRealtimeStatus";
import useScopePresence from "../../hooks/useScopePresence";
import { REACTION_KINDS } from "../../lib/reactions";
import { avatarColor } from "../../lib/avatar";
import Modal from "../Modal";

/**
 * The conversation, once both readers have said yes.
 *
 * This started life as "letters, not chat" — no live signals of any kind. That
 * was revisited deliberately (2026-08): it now carries the live signals a real
 * conversation has, over the realtime socket —
 *   - a reply appears at the end of the transcript as it lands (with a slow
 *     timer + tab-focus refetch as the socket-down fallback; see "Refresh")
 *   - the other reader's presence shows as "here now"
 *   - their typing shows in the compose footer
 *
 * The one line NOT crossed: read state stays private. No read receipts, no
 * "seen at", no notice of when a letter was opened — that is still promised in
 * the UI copy and enforced by the backend serving nothing of the sort.
 */

const MAX_MESSAGE = 2000; // matches resonance_service.MAX_MESSAGE_CHARS
const REPORT_CATEGORIES = [
  { id: "harassment", label: "harassment" },
  { id: "hate", label: "hate" },
  { id: "spam", label: "spam" },
  { id: "self_harm", label: "concern for their safety" },
  { id: "pii", label: "personal information" },
  { id: "other", label: "something else" },
];

/**
 * Scroll the transcript's tail into view, if the environment can.
 *
 * `endRef.current?.scrollIntoView(...)` guarded the ref but not the METHOD, and
 * jsdom implements no scrolling at all — so the effect below threw on mount,
 * React unmounted the tree, and the whole thread rendered as an empty div. It
 * failed as "the letters didn't appear", which points at the fetch rather than
 * at a scroll nicety three lines away.
 *
 * Landing on the newest letter is a courtesy, not a requirement: where it isn't
 * available the transcript simply opens at the top, which is what it did before
 * the courtesy existed.
 */
function scrollToEnd(el, opts) {
  el?.scrollIntoView?.(opts);
}

function letterDate(iso) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "long", day: "numeric" });
  } catch {
    return "";
  }
}


export default function ResonanceThread({ threadId, bookTitle, handle, onClose, onEnded }) {
  const [messages, setMessages] = useState([]);
  const [before, setBefore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [safety, setSafety] = useState(false);
  const [stale, setStale] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [justSent, setJustSent] = useState(false);

  // ── Scroll ──
  // The transcript is not its own scroll container; the PAGE scrolls. So opening
  // a thread put you at the top of it — on the oldest letter, with the whole
  // history and the reply box below. Every messaging surface ever built opens at
  // the newest message, and this one is a conversation whatever we style it as.
  const endRef = useRef(null);
  const composeRef = useRef(null);
  const didLandRef = useRef(false);
  // Height of the document immediately before older letters are prepended, so
  // the restore below can put the viewport back where the reader's eyes were.
  const prependFromRef = useRef(null);
  const latestRef = useRef(null);
  const sendingRef = useRef(false);

  const remember = (list) => {
    const last = list[list.length - 1];
    if (last) latestRef.current = last.created_at;
  };

  const updateMessage = (mid, updater) => {
    setMessages((prev) => prev.map((m) => (m.id === mid ? updater(m) : m)));
  };

  const toggleReaction = async (m, kind) => {
    const on = !(m.my_reactions || []).includes(kind);
    const before = m;
    updateMessage(m.id, (cur) => {
      const counts = { ...cur.reaction_counts };
      counts[kind] = (counts[kind] || 0) + (on ? 1 : -1);
      if (counts[kind] <= 0) delete counts[kind];
      return {
        ...cur,
        reaction_counts: counts,
        my_reactions: on
          ? [...(cur.my_reactions || []), kind]
          : (cur.my_reactions || []).filter((k) => k !== kind),
      };
    });
    try {
      const r = await reactToThreadMessage(threadId, m.id, kind, on);
      updateMessage(m.id, (cur) => ({ ...cur, reaction_counts: r.reaction_counts, my_reactions: r.my_reactions }));
    } catch {
      updateMessage(m.id, () => before);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getThreadMessages(threadId);
      setMessages(data.messages || []);
      remember(data.messages || []);
      setBefore(data.next_before || null);
    } catch {
      setError("Couldn't open this conversation.");
    }
    setLoading(false);
  }, [threadId]);

  useEffect(() => { load(); }, [load]);

  // ── Refresh ──
  // Merges by id and appends: never touches `loading` (so the transcript
  // doesn't flash "opening…"), never re-runs the open-on-newest scroll, never
  // scrolls the page under someone reading history. A letter just shows up at
  // the end.
  const refresh = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    let data;
    try {
      data = await getThreadMessages(threadId, { after: latestRef.current || undefined });
    } catch {
      setStale(true); // poll retries next interval regardless
      return;
    }
    setStale(false);
    const incoming = data.messages || [];
    if (!incoming.length) return;
    setMessages((prev) => {
      const have = new Set(prev.map((m) => m.id));
      const fresh = incoming.filter((m) => !have.has(m.id));
      return fresh.length ? [...prev, ...fresh] : prev;
    });
    remember(incoming);
  }, [threadId]);

  // Realtime is the fast path — a reply pushes a "notify" event and this picks
  // it up in ~100ms. The slow timer + tab-focus catch-up cover a dropped socket.
  useRealtimeEvent("notify", (ev) => { if (ev.kind === "resonance_message") refresh(); });

  const { present, typing, notifyTyping } = useScopePresence(threadId ? `thread:${threadId}` : null);
  const partnerHere = !!handle && present.has(handle);
  const partnerTyping = !!handle && typing.has(handle);
  const connected = useRealtimeStatus();

  useEffect(() => {
    const FALLBACK_MS = 45000;
    const id = setInterval(refresh, FALLBACK_MS);
    const onFocus = () => refresh();
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  // Land on the newest letter, once, on open. `auto` rather than `smooth`: this
  // should read as where the thread opened, not as a journey it took you on.
  useEffect(() => {
    if (loading || didLandRef.current || !messages.length) return;
    didLandRef.current = true;
    scrollToEnd(endRef.current, { block: "end" });
  }, [loading, messages.length]);

  // Prepending 50 letters above the viewport moves everything the reader was
  // looking at down by the height of what arrived. Re-anchoring by the exact
  // delta leaves the letter they were reading under their eyes, which is what
  // "read what came before" should feel like.
  useLayoutEffect(() => {
    const from = prependFromRef.current;
    if (from == null) return;
    prependFromRef.current = null;
    window.scrollBy(0, document.documentElement.scrollHeight - from);
  }, [messages]);

  const loadEarlier = async () => {
    if (!before) return;
    prependFromRef.current = document.documentElement.scrollHeight;
    try {
      const data = await getThreadMessages(threadId, { before });
      setMessages((prev) => [...(data.messages || []), ...prev]);
      setBefore(data.next_before || null);
    } catch {
      setError("Couldn't load what came before.");
    }
  };

  const send = async () => {
    const text = body.trim();
    if (!text || sendingRef.current) return;
    sendingRef.current = true;
    setError("");
    setSending(true);
    try {
      const saved = await sendThreadMessage(threadId, text, replyTo?.id || null);
      setMessages((prev) => [...prev, saved]);
      remember([saved]);
      setBody("");
      setReplyTo(null);
      // A brief acknowledgment, not a feature — a small seal-stamp flourish on
      // "send the letter", not gamification.
      setJustSent(true);
      setTimeout(() => setJustSent(false), 600);
      // Your own letter should be the thing you're looking at after you send it.
      requestAnimationFrame(() => scrollToEnd(endRef.current, { behavior: "smooth", block: "end" }));
    } catch (err) {
      setError(err?.message || "Couldn't send that.");
    }
    sendingRef.current = false;
    setSending(false);
  };

  // Block and report both end the conversation silently — the other reader is
  // told nothing, it simply stops. So we close out to the list without a
  // confirmation flourish.
  const endIt = async (fn) => {
    try { await fn(); onEnded?.(); }
    catch { setError("Couldn't do that just now."); }
  };

  return (
    <>
    <div className="rt">
      {/* Who and what this is, held permanently in the left column, so no letter
          has to carry it and the transcript can be nothing but the letters. */}
      <aside className="rt-aside">
        <button className="rt-back" onClick={onClose}>← resonance</button>

        {bookTitle && (
          <div className="rt-plate">
            <div className="rm-plate" aria-hidden="true">
              <div className="rm-plate-title">{bookTitle}</div>
            </div>
          </div>
        )}

        <div className="rt-who">
          <div className="rt-kicker">letters with</div>
          <div className="rt-with">{handle ? `@${handle}` : "your reader"}</div>
          {partnerHere && (
            <div className="rt-here"><span className="rt-here-dot" aria-hidden="true" /> here now</div>
          )}
        </div>

        <div className="rt-facts">
          {bookTitle ? <>about {bookTitle}<br /></> : null}
          one letter each turn<br />
          no receipts, ever
        </div>

        <button className="rt-quiet" onClick={() => setSafety(true)}>
          close the letters
        </button>
      </aside>

      <div className="rt-main">
        {/* Read state is still private: you can see when they're here and when
            they're writing, but never whether a letter has been opened. */}
        <p className="rt-pace">
          You'll see when they're here and when they're writing. A letter being
          read is never reported — no receipts, no “seen”.
        </p>

        <div className="rt-scroll">
          {loading ? (
            <div className="rt-loading">opening…</div>
          ) : (
            <>
              {before && (
                <button className="rt-earlier" onClick={loadEarlier}>read what came before</button>
              )}
              {/* The first two messages are the notes you each wrote before you
                  knew who the other was — the server seeds the thread with them,
                  so the conversation starts where you left off. */}
              {messages.map((m) => (
                <article key={m.id} className={`rt-msg ${m.is_mine ? "mine" : "theirs"}`}>
                  {/* Signature at the top, like a letter. Nothing is right-aligned:
                      a letter you have to read at the wrong margin is a bubble. */}
                  <div className="rt-msg-head">
                    <span
                      className="rt-avatar"
                      style={{ "--avatar-c": m.is_mine ? "var(--ink)" : avatarColor(m.handle || "reader") }}
                      aria-hidden="true"
                    >
                      {m.is_mine ? "Y" : (m.handle?.[0] || "?").toUpperCase()}
                    </span>
                    <span className="rt-msg-who">{m.is_mine ? "you wrote" : `@${m.handle} wrote`}</span>
                    <span className="rt-msg-date">{letterDate(m.created_at)}</span>
                  </div>
                  {m.reply_to && (
                    <div className="rt-quote">
                      <span className="rt-quote-who">
                        {m.reply_to.handle ? `@${m.reply_to.handle} wrote` : "earlier"}
                      </span>
                      <p className="rt-quote-body">{m.reply_to.body}</p>
                    </div>
                  )}
                  <div className="rt-msg-body">{m.body}</div>
                  <div className="rt-msg-actions">
                    {REACTION_KINDS.map((r) => {
                      const count = m.reaction_counts?.[r.kind] || 0;
                      const on = (m.my_reactions || []).includes(r.kind);
                      return (
                        <button
                          key={r.kind}
                          type="button"
                          aria-pressed={on}
                          className={`rt-react ${on ? "on" : ""}`}
                          onClick={() => toggleReaction(m, r.kind)}
                          aria-label={`${r.label}${count ? ` (${count})` : ""}`}
                          title={r.label}
                        >
                          <span className="rt-react-mark" aria-hidden="true">{r.mark}</span>
                          {count > 0 && <span className="rt-react-count">{count}</span>}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      className="rt-reply-btn"
                      onClick={() => {
                        setReplyTo({ id: m.id, handle: m.is_mine ? "yourself" : m.handle, body: m.body });
                        // The compose box is below the fold on a long thread — without
                        // this, "reply" silently attached a quote to a text field the
                        // reader couldn't see, and looked like it had done nothing.
                        requestAnimationFrame(() => {
                          scrollToEnd(composeRef.current, { behavior: "smooth", block: "center" });
                          composeRef.current?.focus();
                        });
                      }}
                    >
                      reply
                    </button>
                  </div>
                </article>
              ))}
              {/* Scroll target for "open at the newest letter". */}
              <div ref={endRef} />
            </>
          )}
        </div>

        {error && <div className="rt-error" role="alert">{error}</div>}
        {!connected && !error && (
          <div className="rt-error" role="status">Reconnecting… letters still arrive, just slower</div>
        )}
        {stale && !error && connected && (
          <div className="rt-error" role="status">Trouble checking for new letters — retrying…</div>
        )}

        <div className="rt-compose">
          <div className="rt-compose-label">write back</div>
          {replyTo && (
            <div className="rt-replying">
              <div className="rt-replying-text">
                <span className="rt-replying-who">
                  Replying to {replyTo.handle === "yourself" ? "yourself" : `@${replyTo.handle}`}
                </span>
                <p className="rt-replying-body">{replyTo.body}</p>
              </div>
              <button type="button" className="rt-replying-cancel" onClick={() => setReplyTo(null)} aria-label="Cancel reply">
                ×
              </button>
            </div>
          )}
          <textarea
            ref={composeRef}
            className="rt-compose-field"
            value={body}
            onChange={(e) => { setBody(e.target.value); notifyTyping(); }}
            placeholder="Take the time you'd take with paper."
            rows={5}
            maxLength={MAX_MESSAGE}
            aria-label="Your message"
          />
          <div className="rt-compose-foot">
            <span className="rt-compose-note" aria-live="polite">
              {partnerTyping ? `@${handle} is writing…` : "sent once · no edits after"}
            </span>
            <button
              className={`btn brass ${justSent ? "is-sent" : ""}`}
              onClick={send}
              disabled={!body.trim() || sending}
            >
              {sending ? "sending…" : "send the letter"}
            </button>
          </div>
        </div>
      </div>
    </div>

    {safety && (
      <Modal
        onClose={() => setSafety(false)}
        title="End this conversation?"
        className="rt-safety-modal"
        backdropClassName="rr-modal-backdrop"
      >
        <p className="rt-safety-line">
          Ending this is silent — they aren't told, the conversation just stops.
        </p>
        <button className="btn oxblood" onClick={() => endIt(() => blockThread(threadId))}>
          stop this conversation
        </button>
        <div className="rt-safety-report">
          <div className="rt-safety-report-label">or report a reason first</div>
          <div className="rt-safety-actions">
            {REPORT_CATEGORIES.map((c) => (
              <button
                key={c.id}
                className="rt-report-btn"
                onClick={() => endIt(() => reportThread(threadId, c.id, true))}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </Modal>
    )}
    </>
  );
}
