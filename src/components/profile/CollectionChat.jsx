import { useState, useEffect, useRef, useCallback } from "react";
import {
  getCollectionConversations,
  getCollectionMessages,
  sendCollectionMessage,
  deleteCollectionMessage,
  reportCollectionConversation,
  getCollectionSparks,
} from "../../services/api";
import CrisisInterstitial from "../echo/CrisisInterstitial";
import "./CollectionChat.css";

const PAGE = 50;
// Fast enough that a reply feels live, slow enough that a room left open all
// afternoon is not a hammering. Only ever runs while the tab is visible.
const POLL_MS = 5000;
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
  const [sparks, setSparks] = useState([]);

  const bottomRef = useRef(null);
  const scrollerRef = useRef(null);
  // Newest timestamp we hold, so the poll can ask "anything after this?" without
  // a stale-closure race inside the interval.
  const latestRef = useRef(null);
  const pinnedRef = useRef(true);

  const remember = (list) => {
    const last = list[list.length - 1];
    if (last) latestRef.current = last.created_at;
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const page = await getCollectionMessages(id, {
        limit: PAGE, bookId: filter || null,
      });
      setMessages(page.messages);
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

  // ── Live: poll only while the tab is visible ──
  useEffect(() => {
    const tick = async () => {
      if (document.visibilityState !== "visible" || !latestRef.current) return;
      try {
        const page = await getCollectionMessages(id, {
          after: latestRef.current, bookId: filter || null, limit: PAGE,
        });
        if (!page.messages.length) return;
        setMessages((prev) => {
          // Our own send appends locally and the poll will see it again, so a
          // dedupe by id is required, not defensive.
          const have = new Set(prev.map((m) => m.id));
          const fresh = page.messages.filter((m) => !have.has(m.id));
          return fresh.length ? [...prev, ...fresh] : prev;
        });
        remember(page.messages);
      } catch { /* a failed poll is not worth surfacing; the next one retries */ }
    };
    const timer = setInterval(tick, POLL_MS);
    // Catch up the moment the tab comes back rather than waiting a full tick.
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [id, filter]);

  // Follow new messages only if the reader is already at the bottom. Yanking
  // someone away from history they are reading is worse than a missed scroll.
  useEffect(() => {
    if (pinnedRef.current) bottomRef.current?.scrollIntoView?.({ block: "end" });
  }, [messages.length]);

  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const older = async () => {
    if (!cursor) return;
    const page = await getCollectionMessages(id, {
      ...cursor, bookId: filter || null, limit: PAGE,
    });
    pinnedRef.current = false;
    setMessages((prev) => [...page.messages, ...prev]);
    setCursor(page.next_before
      ? { before: page.next_before, beforeId: page.next_before_id } : null);
  };

  const send = async (e) => {
    e?.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setRefusal(null);
    try {
      const saved = await sendCollectionMessage(id, body, attach || null);
      pinnedRef.current = true;
      setMessages((prev) => [...prev, saved]);
      remember([saved]);
      setDraft("");
      setAttach("");
      if (saved.crisis) setCrisis(saved.crisis);
    } catch (err) {
      // A refusal is not a network hiccup. Keep the draft — it is still unsaid.
      setRefusal(err.message);
    } finally {
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
      setMessages((prev) => prev.filter((m) => m.id !== mid));
    } catch (err) { setRefusal(err.message); }
  };

  const report = async () => {
    try { await reportCollectionConversation(id); setReported(true); }
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
                  <div className="cc-msg-line">
                    <p className="cc-msg-body">{m.body}</p>
                    <button
                      className="cc-msg-del"
                      onClick={() => remove(m.id)}
                      aria-label={`Delete message from ${m.is_mine ? "you" : m.handle}`}
                    >
                      ×
                    </button>
                  </div>
                </li>
              );
            })}
            <div ref={bottomRef} />
          </ul>
        )}
      </div>

      {crisis && <CrisisInterstitial crisis={crisis} onClose={() => setCrisis(null)} />}

      {/* Textarea first, controls beneath. A select + textarea + button on one
          row has no good phone layout — it either squeezes the box you type in
          or wraps into something ragged. */}
      <form className="cc-compose" onSubmit={send}>
        <textarea
          className="cc-compose-input"
          value={draft}
          onChange={(e) => { setDraft(e.target.value); setRefusal(null); }}
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
          <button className="btn brass cc-send" disabled={sending || !draft.trim()}>
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
        ) : (
          <button className="cc-plain" onClick={report}>report this conversation</button>
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
