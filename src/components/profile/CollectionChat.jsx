import { useState, useEffect, useRef, useCallback, useLayoutEffect } from "react";
import {
  getCollectionConversations,
  getCollectionMessages,
  sendCollectionMessage,
  sendCollectionImageMessage,
  deleteCollectionMessage,
  reactToCollectionMessage,
  reportCollectionConversation,
  getCollectionSparks,
  getCollectionMembers,
  getCollectionPinned,
  setCollectionPinned,
} from "../../services/api";
import CrisisInterstitial from "../echo/CrisisInterstitial";
import useRealtimeEvent from "../../hooks/useRealtimeEvent";
import useRealtimeStatus from "../../hooks/useRealtimeStatus";
import useScopePresence from "../../hooks/useScopePresence";
import { REACTION_KINDS } from "../../lib/reactions";
import { avatarColor } from "../../lib/avatar";
import { splitMentions, activeMentionQuery, insertMention } from "../../lib/mentions";
import Modal from "../Modal";
import ChatImage from "../ChatImage";
import PendingImage from "../PendingImage";
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
  const [members, setMembers] = useState([]);
  const [mentionQuery, setMentionQuery] = useState(null);
  const [pinned, setPinned] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingImage, setPendingImage] = useState(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const toolsRef = useRef(null);
  const [imageError, setImageError] = useState("");

  const bottomRef = useRef(null);
  const scrollerRef = useRef(null);
  const composeRef = useRef(null);
  const fileInputRef = useRef(null);
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

  // One reaction per person per message, like a tapback — picking a new kind
  // replaces whatever this reader had here, it doesn't add a second one. The
  // server has no "replace" verb, so a switch is two calls: unset the old
  // kind, then set the new one.
  const toggleReaction = async (m, kind) => {
    const mine = m.my_reactions || [];
    const already = mine.includes(kind);
    const prior = mine[0];
    const before = m;

    updateMessage(m.id, (cur) => {
      const counts = { ...cur.reaction_counts };
      if (prior) {
        counts[prior] = (counts[prior] || 1) - 1;
        if (counts[prior] <= 0) delete counts[prior];
      }
      if (!already) counts[kind] = (counts[kind] || 0) + 1;
      return { ...cur, reaction_counts: counts, my_reactions: already ? [] : [kind] };
    });
    try {
      if (prior && prior !== kind) {
        await reactToCollectionMessage(id, m.id, prior, false);
      }
      const r = await reactToCollectionMessage(id, m.id, kind, !already);
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
    getCollectionMembers(id).then(setMembers).catch(() => setMembers([]));
    getCollectionPinned(id).then((r) => setPinned(r.pinned || null)).catch(() => setPinned(null));
  }, [id]);

  const memberHandles = members.map((m) => m.handle).filter(Boolean);
  const mentionMatches = mentionQuery === null
    ? []
    : memberHandles.filter((h) => h.toLowerCase().startsWith(mentionQuery.toLowerCase())).slice(0, 6);

  const pickMention = (handle) => {
    const el = composeRef.current;
    const caret = el ? el.selectionStart : draft.length;
    const { text, caret: nextCaret } = insertMention(draft, caret, handle);
    setDraft(text);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(nextCaret, nextCaret);
    });
  };

  const togglePin = async (messageId) => {
    const next = pinned?.id === messageId ? null : messageId;
    try {
      const r = await setCollectionPinned(id, next);
      setPinned(r.pinned || null);
    } catch (err) { setRefusal(err.message); }
  };

  const citePage = () => {
    const n = window.prompt("Which page (or chapter)?");
    if (!n || !n.trim()) return;
    const cite = `p. ${n.trim()} — `;
    setDraft((d) => (d && !d.endsWith("\n") && !d.endsWith(" ") ? `${d} ${cite}` : `${d}${cite}`));
    composeRef.current?.focus();
  };

  // The "+" tools menu closes on a click outside it or Escape — without this
  // it only ever closed by picking one of its own options, so a reader who
  // opened it just to look had no way back out except reloading the page.
  useEffect(() => {
    if (!toolsOpen) return;
    const onPointerDown = (e) => {
      if (!toolsRef.current?.contains(e.target)) setToolsOpen(false);
    };
    const onKeyDown = (e) => { if (e.key === "Escape") setToolsOpen(false); };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [toolsOpen]);

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
  useRealtimeEvent("notify", (ev) => {
    if (ev.kind === "collection_message") catchUp();
    // A quiet nudge (never a stored notification — see the backend's
    // publish_scope call) so a pin/unpin another member makes shows up here
    // live instead of waiting for the next poll or a reload.
    if (ev.kind === "collection_pinned") {
      getCollectionPinned(id).then((r) => setPinned(r.pinned || null)).catch(() => {});
    }
  });

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
    if ((!body && !pendingImage) || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setRefusal(null);
    try {
      const saved = pendingImage
        ? await sendCollectionImageMessage(id, body || "(a photo)", pendingImage, attach || null, replyTo?.id || null)
        : await sendCollectionMessage(id, body, attach || null, replyTo?.id || null);
      pinnedRef.current = true;
      messagesRef.current = [...messagesRef.current, saved];
      setMessages(messagesRef.current);
      remember([saved]);
      setDraft("");
      setAttach("");
      setReplyTo(null);
      setPendingImage(null);
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

  const pickImage = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      setImageError("Only PNG, JPEG or WEBP images are supported.");
      return;
    }
    setImageError("");
    setPendingImage(file);
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
    <>
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

      {messages.length > 0 && (
        <div className="cc-search">
          <input
            type="search"
            className="cc-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search this room…"
            aria-label="Search messages"
          />
        </div>
      )}

      {pinned && (
        <div className="cc-pinned">
          <div className="cc-pinned-text">
            <span className="cc-pinned-who">pinned · {pinned.handle ? `@${pinned.handle}` : "a reader"}</span>
            <p className="cc-pinned-body">{pinned.body}</p>
          </div>
          <button type="button" className="cc-pinned-clear" onClick={() => togglePin(pinned.id)}>
            unpin
          </button>
        </div>
      )}

      {cursor && !searchQuery && (
        <button className="cc-older" onClick={older}>load earlier messages</button>
      )}

      <div className="cc-messages" ref={scrollerRef} onScroll={onScroll}>
        {loading ? (
          <p className="cc-quiet">Loading…</p>
        ) : messages.length === 0 ? (
          <Empty sparks={sparks} onUse={setDraft} />
        ) : (() => {
          const q = searchQuery.trim().toLowerCase();
          const visible = q ? messages.filter((m) => m.body.toLowerCase().includes(q)) : messages;
          if (q && visible.length === 0) {
            return <p className="cc-quiet">No messages match “{searchQuery.trim()}”.</p>;
          }
          return (
          <ul className="cc-list-msgs">
            {visible.map((m, i) => {
              const prev = visible[i - 1];
              // A book label always starts a fresh block — it is a change of
              // subject, and hiding it under a grouped run would lose it. A
              // search result never groups: adjacent matches weren't
              // necessarily adjacent in the real conversation.
              const grouped =
                !q &&
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
                      <span
                        className="cc-avatar"
                        style={{ "--avatar-c": m.is_mine ? "var(--ink)" : avatarColor(m.handle || "reader") }}
                        aria-hidden="true"
                      >
                        {m.is_mine ? "Y" : (m.handle?.[0] || "?").toUpperCase()}
                      </span>
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
                    <p className={`cc-msg-body ${Object.keys(m.reaction_counts || {}).map((k) => `cc-msg-body--${k}`).join(" ")}`}>
                      {splitMentions(m.body, memberHandles).map((part, pi) =>
                        part.mention
                          ? <span key={pi} className="cc-mention">{part.text}</span>
                          : <span key={pi}>{part.text}</span>
                      )}
                    </p>
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
                  {m.attachment_url && (
                    <div className="cc-msg-image">
                      <ChatImage url={m.attachment_url} alt="Attached photo" />
                    </div>
                  )}
                  <div className="cc-msg-actions">
                    <input type="checkbox" id={`cc-react-open-${m.id}`} className="cc-react-toggle" />
                    <div className="cc-react-row">
                      {REACTION_KINDS.map((r) => {
                        const count = m.reaction_counts?.[r.kind] || 0;
                        const on = (m.my_reactions || []).includes(r.kind);
                        return (
                          <button
                            key={r.kind}
                            type="button"
                            aria-pressed={on}
                            className={`cc-react ${on ? "on" : ""} ${count > 0 ? "has-count" : ""}`}
                            onClick={() => toggleReaction(m, r.kind)}
                            aria-label={`${r.label}${count ? ` (${count})` : ""}`}
                          >
                            <span className="cc-react-mark" aria-hidden="true">{r.mark}</span>
                            {count > 0 && <span className="cc-react-count">{count}</span>}
                          </button>
                        );
                      })}
                    </div>
                    <label htmlFor={`cc-react-open-${m.id}`} className="cc-react-summary more">tap to react</label>
                    <label htmlFor={`cc-react-open-${m.id}`} className="cc-react-summary less">done</label>
                    <button
                      type="button"
                      className="cc-reply-btn"
                      onClick={() => setReplyTo({ id: m.id, handle: m.is_mine ? "yourself" : m.handle, body: m.body })}
                    >
                      reply
                    </button>
                    <button
                      type="button"
                      className={`cc-pin-btn ${pinned?.id === m.id ? "on" : ""}`}
                      onClick={() => togglePin(m.id)}
                    >
                      {pinned?.id === m.id ? "unpin" : "pin"}
                    </button>
                  </div>
                </li>
              );
            })}
            <div ref={bottomRef} />
          </ul>
          );
        })()}
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
        <div className="cc-compose-field-wrap">
          <textarea
            ref={composeRef}
            className="cc-compose-input"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setRefusal(null);
              notifyTyping();
              setMentionQuery(activeMentionQuery(e.target.value, e.target.selectionStart));
            }}
            onKeyDown={(e) => {
              if (mentionQuery !== null && mentionMatches.length && (e.key === "Enter" || e.key === "Tab")) {
                e.preventDefault();
                pickMention(mentionMatches[0]);
                return;
              }
              if (e.key === "Escape" && mentionQuery !== null) { setMentionQuery(null); return; }
              onKeyDown(e);
            }}
            placeholder="Say something… (@ to mention someone)"
            rows={1}
            maxLength={2000}
            aria-label="Your message"
          />
          {mentionQuery !== null && mentionMatches.length > 0 && (
            <ul className="cc-mention-menu" role="listbox">
              {mentionMatches.map((h) => (
                <li key={h}>
                  <button type="button" onMouseDown={(e) => { e.preventDefault(); pickMention(h); }}>
                    @{h}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {pendingImage && (
          <PendingImage file={pendingImage} sending={sending} onRemove={() => setPendingImage(null)} />
        )}
        {attach && (
          <div className="cc-pending-image">
            <span>about “{books.find((b) => b.book_id === attach)?.title}”</span>
            <button type="button" onClick={() => setAttach("")} aria-label="Remove book tag">×</button>
          </div>
        )}
        {imageError && <p className="cc-refusal" role="alert">{imageError}</p>}
        <div className="cc-compose-row">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={pickImage}
            hidden
          />
          <div className="cc-tools" ref={toolsRef}>
            <button
              type="button"
              className="cc-tool-toggle"
              onClick={() => setToolsOpen((v) => !v)}
              aria-expanded={toolsOpen}
              aria-label="More options"
            >
              +
            </button>
            {toolsOpen && (
              <ul className="cc-tools-menu" role="menu">
                <li>
                  <button type="button" onClick={() => { fileInputRef.current?.click(); setToolsOpen(false); }}>
                    attach a photo
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => { citePage(); setToolsOpen(false); }}>
                    cite a page
                  </button>
                </li>
                {books.length > 0 && (
                  <li className="cc-tools-books">
                    <span className="cc-tools-books-label">tag a book</span>
                    {books.map((b) => (
                      <button
                        key={b.book_id}
                        type="button"
                        className={attach === b.book_id ? "on" : ""}
                        onClick={() => { setAttach(attach === b.book_id ? "" : b.book_id); setToolsOpen(false); }}
                      >
                        {b.title}
                      </button>
                    ))}
                  </li>
                )}
              </ul>
            )}
          </div>
          <span className="cc-hint">Enter to send</span>
          <button className={`btn brass cc-send ${justSent ? "is-sent" : ""}`} disabled={sending || (!draft.trim() && !pendingImage)}>
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
          <button className="cc-plain" onClick={() => setReporting(true)}>report this conversation</button>
        )}
      </div>
    </div>

    {reporting && (
      // A modal, not an inline reveal at the bottom of a scrolled chat: the
      // trigger is easy to lose track of once the panel unfolds somewhere
      // else on a long room. Same fix, same reasoning, as ResonanceThread's
      // "end this conversation" dialog — rendered as a sibling of `.cc-room`,
      // not inside it, so no host page's own transform animation can turn an
      // ancestor into a containing block that traps this fixed overlay.
      <Modal
        onClose={() => setReporting(false)}
        title="Report this conversation?"
        className="cc-report-modal"
        backdropClassName="rr-modal-backdrop"
      >
        <p className="cc-report-line">
          A moderator will take a look. Nothing changes here for anyone else —
          block someone directly if you don't want to see them.
        </p>
        <div className="cc-report-actions">
          {REPORT_CATEGORIES.map((c) => (
            <button key={c.id} className="cc-report-btn" onClick={() => report(c.id)}>
              {c.label}
            </button>
          ))}
        </div>
      </Modal>
    )}
    </>
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
