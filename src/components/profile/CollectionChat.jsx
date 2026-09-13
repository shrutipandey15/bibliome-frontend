import { useState, useEffect, useRef, useCallback, useLayoutEffect } from "react";
import {
  getCollectionConversations,
  getCollectionMessages,
  sendCollectionMessage,
  deleteCollectionMessage,
  reactToCollectionMessage,
  reportCollectionConversation,
  getCollectionSparks,
} from "../../services/api";
import CrisisInterstitial from "../echo/CrisisInterstitial";
import useRealtimeEvent from "../../hooks/useRealtimeEvent";
import useRealtimeStatus from "../../hooks/useRealtimeStatus";
import useScopePresence from "../../hooks/useScopePresence";
import { REACTION_KINDS } from "../../lib/reactions";
import "./CollectionChat.css";

function typingLabel(handles) {
  const names = [...handles];
  if (names.length === 1) return `@${names[0]} is typing…`;
  if (names.length === 2) return `@${names[0]} and @${names[1]} are typing…`;
  return "Several people are typing…";
}

const REPORT_CATEGORIES = [
  { id: "harassment", label: "harassment" },
  { id: "hate", label: "hate" },
  { id: "spam", label: "spam" },
  { id: "self_harm", label: "concern for their safety" },
  { id: "pii", label: "personal information" },
  { id: "other", label: "something else" },
];

const PAGE = 50;
// The realtime socket is the fast path — a new message pushes a "notify" event
// and this catches up instantly. The poll is the fallback for a dropped socket,
// so it can be gentler than the old 5s. Still visible-only.
const POLL_MS = 20000;
// Messages from the same person inside this window render as one block — the
// difference between a conversation and a list of stamped records.
const GROUP_WINDOW_MS = 5 * 60 * 1000;

/**
 * A collection's room [#6, revised].
 *
 * ONE room per collection. The first version gave every book its own, which
 * scattered a small group across mostly-empty rooms; a book is now an optional
 * label on a message and a filter over the same room.
 *
 * What makes it usable rather than merely correct:
 * - it polls while visible, so other people's messages arrive on their own;
 * - Enter sends, Shift+Enter is a newline;
 * - consecutive messages from one person group under a single name;
 * - times are relative ("2m"), with the exact stamp on hover;
 * - sparks give you something to say when a room is new and silent.
 */
export default function CollectionChat({ collectionId, collection }) {
  const id = collectionId || collection?.id;

  const [messages, setMessages] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [books, setBooks] = useState([]);
  const [attach, setAttach] = useState("");
  const [filter, setFilter] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [refusal, setRefusal] = useState(null);
  const [crisis, setCrisis] = useState(null);
  const [reported, setReported] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [sparks, setSparks] = useState([]);
  const [stale, setStale] = useState(false);
  const [newBelow, setNewBelow] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [justSent, setJustSent] = useState(false);

  const bottomRef = useRef(null);
  const scrollerRef = useRef(null);
  const composeRef = useRef(null);
  // Newest timestamp we hold, so the poll can ask "anything after this?" without
  // a stale-closure race inside the interval.
  const latestRef = useRef(null);
  const pinnedRef = useRef(true);
  const sendingRef = useRef(false);
  const messagesRef = useRef([]);
  // Height of the scroller immediately before older messages are prepended, so
  // the layout effect below can restore the exact spot the reader was at —
  // otherwise prepending pushes everything they were looking at further down.
  const prependFromRef = useRef(null);

  const remember = (list) => {
    const last = list[list.length - 1];
    if (last) latestRef.current = last.created_at;
  };

  const updateMessage = (mid, updater) => {
    messagesRef.current = messagesRef.current.map((m) => (m.id === mid ? updater(m) : m));
    setMessages(messagesRef.current);
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
      const r = await reactToCollectionMessage(id, m.id, kind, on);
      updateMessage(m.id, (cur) => ({ ...cur, reaction_counts: r.reaction_counts, my_reactions: r.my_reactions }));
    } catch {
      updateMessage(m.id, () => before);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const page = await getCollectionMessages(id, {
        limit: PAGE, bookId: filter || null,
      });
      setMessages(page.messages);
      messagesRef.current = page.messages;
      remember(page.messages);
      setCursor(page.next_before
        ? { before: page.next_before, beforeId: page.next_before_id } : null);
    } finally {
      setLoading(false);
    }
  }, [id, filter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    getCollectionConversations(id).then(setBooks).catch(() => setBooks([]));
    getCollectionSparks(id).then((r) => setSparks(r.sparks || [])).catch(() => {});
  }, [id]);

  // Pull anything that has arrived since the newest message we hold. Shared by
  // the realtime handler, the poll, and the tab-focus catch-up.
  const catchUp = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    try {
      // No `after` yet means the room was empty when it opened (or the first
      // page came back empty). Without this the poll never starts and the very
      // first message from someone else only appears on a reload.
      const page = await getCollectionMessages(id, {
        after: latestRef.current || undefined, bookId: filter || null, limit: PAGE,
      });
      if (!page.messages.length) return;

      const have = new Set(messagesRef.current.map((m) => m.id));
      // Our own send appends locally and this will see it again, so a dedupe
      // by id is required, not defensive.
      const fresh = page.messages.filter((m) => !have.has(m.id));
      if (fresh.length) {
        const next = [...messagesRef.current, ...fresh];
        messagesRef.current = next;
        setMessages(next);
        if (!pinnedRef.current) setNewBelow(true);
      }
      remember(page.messages);
      setStale(false);
    } catch { setStale(true); /* poll retries next interval regardless */ }
  }, [id, filter]);

  // ── Live: realtime first, poll as fallback, both visible-only ──
  useRealtimeEvent("notify", (ev) => { if (ev.kind === "collection_message") catchUp(); });

  const { present, typing, notifyTyping } = useScopePresence(id ? `collection:${id}` : null);
  const connected = useRealtimeStatus();

  useEffect(() => {
    const timer = setInterval(catchUp, POLL_MS);
    document.addEventListener("visibilitychange", catchUp);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", catchUp);
    };
  }, [catchUp]);

  // Follow new messages only if the reader is already at the bottom. Yanking
  // someone away from history they are reading is worse than a missed scroll.
  useEffect(() => {
    if (pinnedRef.current) bottomRef.current?.scrollIntoView?.({ block: "end" });
  }, [messages.length]);

  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const pinned = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    pinnedRef.current = pinned;
    if (pinned) setNewBelow(false);
  };

  const jumpToLatest = () => {
    pinnedRef.current = true;
    setNewBelow(false);
    bottomRef.current?.scrollIntoView?.({ behavior: "smooth", block: "end" });
  };

  // Grow the box with what you're typing, up to the CSS max-height (which
  // takes over with its own scrollbar). A fixed one-line box made every second
  // message an exercise in scrolling inside a slit while you typed it.
  useLayoutEffect(() => {
    const el = composeRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);

  // Restore the reader's spot after older messages are prepended above it —
  // same technique ResonanceThread uses for "read what came before".
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    const from = prependFromRef.current;
    if (!el || from == null) return;
    prependFromRef.current = null;
    el.scrollTop += el.scrollHeight - from;
  }, [messages]);

  const older = async () => {
    if (!cursor) return;
    const page = await getCollectionMessages(id, {
      ...cursor, bookId: filter || null, limit: PAGE,
    });
    pinnedRef.current = false;
    prependFromRef.current = scrollerRef.current?.scrollHeight ?? null;
    messagesRef.current = [...page.messages, ...messagesRef.current];
    setMessages(messagesRef.current);
    setCursor(page.next_before
      ? { before: page.next_before, beforeId: page.next_before_id } : null);
  };

  const send = async (e) => {
    e?.preventDefault();
    const body = draft.trim();
    if (!body || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setRefusal(null);
    try {
      const saved = await sendCollectionMessage(id, body, attach || null, replyTo?.id || null);
      pinnedRef.current = true;
      messagesRef.current = [...messagesRef.current, saved];
      setMessages(messagesRef.current);
      remember([saved]);
      setDraft("");
      setAttach("");
      setReplyTo(null);
      setJustSent(true);
      setTimeout(() => setJustSent(false), 500);
      if (saved.crisis) setCrisis(saved.crisis);
    } catch (err) {
      // A refusal is not a network hiccup. Keep the draft — it is still unsaid.
      setRefusal(err.message);
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const onKeyDown = (e) => {
    // Enter sends, Shift+Enter is a newline. isComposing guards IME input —
    // without it, Enter to confirm a character would fire off a half-typed line.
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent?.isComposing) {
      e.preventDefault();
      send();
    }
  };

  const remove = async (mid) => {
    try {
      await deleteCollectionMessage(id, mid);
      messagesRef.current = messagesRef.current.filter((m) => m.id !== mid);
      setMessages(messagesRef.current);
    } catch (err) { setRefusal(err.message); }
  };

  const report = async (category) => {
    try { await reportCollectionConversation(id, category); setReported(true); setReporting(false); }
    catch (err) { setRefusal(err.message); }
  };

  return (
    <div className="cc-room">
      {books.length > 0 && (
        <div className="cc-filter">
          <label className="cc-filter-label" htmlFor="cc-filter">Showing</label>
          <select
            id="cc-filter"
            className="cc-select"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">everything</option>
            {books.map((b) => (
              <option key={b.book_id} value={b.book_id}>only “{b.title}”</option>
            ))}
          </select>
        </div>
      )}

      {present.size > 0 && (
        <p className="cc-here-strip">
          <span className="cc-here-dot" aria-hidden="true" />
          {[...present].map((h) => `@${h}`).join(", ")} {present.size === 1 ? "is" : "are"} here now
        </p>
      )}

      {cursor && (
        <button className="cc-older" onClick={older}>load earlier messages</button>
      )}

      <div className="cc-messages" ref={scrollerRef} onScroll={onScroll}>
        {loading ? (
          <p className="cc-quiet">Loading…</p>
        ) : messages.length === 0 ? (
          <Empty sparks={sparks} onUse={setDraft} />
        ) : (
          <ul className="cc-list-msgs">
            {messages.map((m, i) => {
              const prev = messages[i - 1];
              // A book label always starts a fresh block — it is a change of
              // subject, and hiding it under a grouped run would lose it.
              const grouped =
                prev &&
                prev.handle === m.handle &&
                prev.is_mine === m.is_mine &&
                new Date(m.created_at) - new Date(prev.created_at) < GROUP_WINDOW_MS &&
                !m.book_title;
              return (
                <li
                  key={m.id}
                  className={`cc-msg ${m.is_mine ? "is-mine" : ""} ${grouped ? "is-grouped" : ""}`}
                >
                  {!grouped && (
                    <div className="cc-msg-meta">
                      <span className="cc-msg-who">
                        {m.is_mine ? "you" : `@${m.handle || "a reader"}`}
                        {!m.is_mine && m.handle && present.has(m.handle) && (
                          <span className="cc-here-dot" title="here now" aria-label="here now" />
                        )}
                      </span>
                      <time
                        className="cc-msg-when"
                        dateTime={m.created_at}
                        title={new Date(m.created_at).toLocaleString()}
                      >
                        {ago(m.created_at)}
                      </time>
                    </div>
                  )}
                  {m.book_title && <span className="cc-msg-book">on “{m.book_title}”</span>}
                  {m.reply_to && (
                    <div className="cc-quote">
                      <span className="cc-quote-who">
                        {m.reply_to.handle ? `@${m.reply_to.handle}` : "a reader"}
                      </span>
                      <p className="cc-quote-body">{m.reply_to.body}</p>
                    </div>
                  )}
                  <div className="cc-msg-line">
                    <p className="cc-msg-body">{m.body}</p>
                    {m.is_mine && (
                      <button
                        className="cc-msg-del"
                        onClick={() => remove(m.id)}
                        aria-label="Delete your message"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <div className="cc-msg-actions">
                    {REACTION_KINDS.map((r) => {
                      const count = m.reaction_counts?.[r.kind] || 0;
                      const on = (m.my_reactions || []).includes(r.kind);
                      return (
                        <button
                          key={r.kind}
                          type="button"
                          aria-pressed={on}
                          className={`cc-react ${on ? "on" : ""}`}
                          onClick={() => toggleReaction(m, r.kind)}
                          aria-label={`${r.label}${count ? ` (${count})` : ""}`}
                        >
                          <span className="cc-react-mark" aria-hidden="true">{r.mark}</span>
                          {count > 0 && <span className="cc-react-count">{count}</span>}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      className="cc-reply-btn"
                      onClick={() => setReplyTo({ id: m.id, handle: m.is_mine ? "yourself" : m.handle, body: m.body })}
                    >
                      reply
                    </button>
                  </div>
                </li>
              );
            })}
            <div ref={bottomRef} />
          </ul>
        )}
        {newBelow && (
          <button className="cc-jump" onClick={jumpToLatest}>↓ new messages</button>
        )}
      </div>

      {typing.size > 0 && <p className="cc-typing" aria-live="polite">{typingLabel(typing)}</p>}
      {!connected && <p className="cc-quiet" role="status">Reconnecting… messages still update every {POLL_MS / 1000}s</p>}
      {stale && <p className="cc-quiet" role="status">Trouble checking for new messages — retrying…</p>}

      {crisis && <CrisisInterstitial crisis={crisis} onClose={() => setCrisis(null)} />}

      {/* Textarea first, controls beneath. A select + textarea + button on one
          row has no good phone layout — it either squeezes the box you type in
          or wraps into something ragged. */}
      <form className="cc-compose" onSubmit={send}>
        {replyTo && (
          <div className="cc-replying">
            <div className="cc-replying-text">
              <span className="cc-replying-who">
                Replying to {replyTo.handle === "yourself" ? "yourself" : replyTo.handle ? `@${replyTo.handle}` : "a reader"}
              </span>
              <p className="cc-replying-body">{replyTo.body}</p>
            </div>
            <button type="button" className="cc-replying-cancel" onClick={() => setReplyTo(null)} aria-label="Cancel reply">
              ×
            </button>
          </div>
        )}
        <textarea
          ref={composeRef}
          className="cc-compose-input"
          value={draft}
          onChange={(e) => { setDraft(e.target.value); setRefusal(null); notifyTyping(); }}
          onKeyDown={onKeyDown}
          placeholder="Say something…"
          rows={1}
          maxLength={2000}
          aria-label="Your message"
        />
        <div className="cc-compose-row">
          {books.length > 0 && (
            <select
              className="cc-select cc-attach"
              value={attach}
              onChange={(e) => setAttach(e.target.value)}
              aria-label="Attach a book to this message"
            >
              <option value="">＋ tag a book</option>
              {books.map((b) => (
                <option key={b.book_id} value={b.book_id}>{b.title}</option>
              ))}
            </select>
          )}
          <span className="cc-hint">Enter to send</span>
          <button className={`btn brass cc-send ${justSent ? "is-sent" : ""}`} disabled={sending || !draft.trim()}>
            {sending ? "…" : "send"}
          </button>
        </div>
      </form>

      {refusal && <p className="cc-refusal" role="alert">{refusal}</p>}

      <div className="cc-room-foot">
        {reported ? (
          <span className="cc-quiet">
            Reported. A moderator will look. Nothing here changes for anyone else —
            block someone if you don’t want to see them.
          </span>
        ) : reporting ? (
          <div className="cc-report">
            {REPORT_CATEGORIES.map((c) => (
              <button key={c.id} className="cc-report-btn" onClick={() => report(c.id)}>
                report: {c.label}
              </button>
            ))}
            <button className="cc-plain" onClick={() => setReporting(false)}>never mind</button>
          </div>
        ) : (
          <button className="cc-plain" onClick={() => setReporting(true)}>report this conversation</button>
        )}
      </div>
    </div>
  );
}

/** A silent room is the hardest moment in any group chat, so it gets help.
 *  Tapping a spark fills the box rather than posting — the words stay yours. */
function Empty({ sparks, onUse }) {
  return (
    <div className="cc-empty">
      <p className="cc-quiet">Nothing said here yet. Someone has to go first.</p>
      {sparks.length > 0 && (
        <ul className="cc-sparks">
          {sparks.map((s, i) => (
            <li key={i}>
              <button className={`cc-spark is-${s.kind}`} onClick={() => onUse(s.text)}>
                {s.text}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Relative time. The exact stamp lives in the title attribute — in a live room
 *  "2m" is the useful fact; the date only matters when scrolling history. */
function ago(iso) {
  const secs = Math.max(0, (Date.now() - new Date(iso)) / 1000);
  if (secs < 45) return "just now";
  const mins = secs / 60;
  if (mins < 60) return `${Math.round(mins)}m`;
  const hrs = mins / 60;
  if (hrs < 24) return `${Math.round(hrs)}h`;
  const days = hrs / 24;
  if (days < 7) return `${Math.round(days)}d`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
