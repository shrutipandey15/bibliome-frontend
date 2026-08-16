import { useState, useEffect, useRef, useCallback } from "react";
import {
  getCollectionConversations,
  getCollectionMessages,
  sendCollectionMessage,
  deleteCollectionMessage,
  reportCollectionConversation,
} from "../../services/api";
import CrisisInterstitial from "../echo/CrisisInterstitial";
import "./CollectionChat.css";

const PAGE = 50;

/**
 * Collection chat [#6] — talk about ONE BOOK inside a collection.
 *
 * Two views, deliberately: a list of the collection's books (where a
 * conversation could start), and one book's room. There is no general channel —
 * a collection is a set of books, and a general room turns it into a group chat
 * that happens to have books in it.
 *
 * What the UI has to be honest about, because the backend is:
 * - a refused message (a threat) is a 422, and the sender MUST be told it did
 *   not send — anything softer implies it landed;
 * - a crisis flag comes back to the sender only, and is care, not enforcement;
 * - blocked members' messages are simply absent, with no gap marker, because a
 *   marker would tell you the person you blocked is here and talking.
 */
export default function CollectionChat({ collection }) {
  const [openBook, setOpenBook] = useState(null);

  if (openBook) {
    return (
      <ChatRoom
        collection={collection}
        book={openBook}
        onBack={() => setOpenBook(null)}
      />
    );
  }
  return <ConversationList collection={collection} onOpen={setOpenBook} />;
}

export function ConversationList({ collection, onOpen }) {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    let live = true;
    getCollectionConversations(collection.id)
      .then((r) => { if (live) setRows(r); })
      .catch(() => { if (live) setRows([]); });
    return () => { live = false; };
  }, [collection.id]);

  if (rows === null) return <p className="cc-quiet">Loading…</p>;
  if (rows.length === 0) {
    return (
      <p className="cc-quiet">
        Add a book to this collection and you can talk about it here.
      </p>
    );
  }

  return (
    <ul className="cc-list">
      {rows.map((r) => (
        <li key={r.book_id}>
          <button className="cc-list-row" onClick={() => onOpen(r)}>
            <span className="cc-list-title">{r.title}</span>
            {r.author && <span className="cc-list-author">{r.author}</span>}
            <span className="cc-list-state">
              {r.message_count === 0
                ? "start it"
                : `${r.message_count} ${r.message_count === 1 ? "message" : "messages"}`}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function ChatRoom({ collection, book, onBack }) {
  const [messages, setMessages] = useState([]);
  const [cursor, setCursor] = useState(null);   // { before, beforeId } | null
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [refusal, setRefusal] = useState(null);
  const [crisis, setCrisis] = useState(null);
  const [reported, setReported] = useState(false);
  const bottomRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const page = await getCollectionMessages(collection.id, book.book_id, { limit: PAGE });
      setMessages(page.messages);
      setCursor(page.next_before ? { before: page.next_before, beforeId: page.next_before_id } : null);
    } finally {
      setLoading(false);
    }
  }, [collection.id, book.book_id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    // Guarded rather than called bare: scrollIntoView is absent in jsdom and in
    // older embedded webviews, and a room that throws while scrolling is worse
    // than one that doesn't scroll.
    bottomRef.current?.scrollIntoView?.({ block: "end" });
  }, [messages.length]);

  const older = async () => {
    if (!cursor) return;
    const page = await getCollectionMessages(collection.id, book.book_id, {
      ...cursor, limit: PAGE,
    });
    // Prepend: the page came back oldest-first and sits before what we have.
    setMessages((prev) => [...page.messages, ...prev]);
    setCursor(page.next_before ? { before: page.next_before, beforeId: page.next_before_id } : null);
  };

  const send = async (e) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setRefusal(null);
    try {
      const saved = await sendCollectionMessage(collection.id, book.book_id, body);
      setMessages((prev) => [...prev, saved]);
      setDraft("");
      // Returned to the sender alone. Support, not a penalty — the message sent.
      if (saved.crisis) setCrisis(saved.crisis);
    } catch (err) {
      // A refusal is not a network hiccup. Say plainly that it did not send;
      // leaving the draft in place is part of that — it is still unsaid.
      setRefusal(err.message);
    } finally {
      setSending(false);
    }
  };

  const remove = async (id) => {
    try {
      await deleteCollectionMessage(collection.id, id);
      setMessages((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      setRefusal(err.message);
    }
  };

  const report = async () => {
    try {
      await reportCollectionConversation(collection.id, book.book_id);
      setReported(true);
    } catch (err) {
      setRefusal(err.message);
    }
  };

  return (
    <div className="cc-room">
      <div className="cc-room-head">
        <button className="cc-back" onClick={onBack}>← all books</button>
        <span className="cc-room-title">{book.title}</span>
      </div>

      {cursor && (
        <button className="cc-older" onClick={older}>load earlier messages</button>
      )}

      {loading ? (
        <p className="cc-quiet">Loading…</p>
      ) : messages.length === 0 ? (
        <p className="cc-quiet">Nothing said about this one yet. Say the first thing.</p>
      ) : (
        <ul className="cc-messages">
          {messages.map((m) => (
            <li key={m.id} className={`cc-msg ${m.is_mine ? "is-mine" : ""}`}>
              <div className="cc-msg-meta">
                <span className="cc-msg-who">{m.is_mine ? "you" : `@${m.handle || "a reader"}`}</span>
                <time className="cc-msg-when" dateTime={m.created_at}>
                  {new Date(m.created_at).toLocaleString(undefined, {
                    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                  })}
                </time>
                {/* Offered on every message: the server decides whether this
                    caller may actually delete it, and answers 403 if not. */}
                <button
                  className="cc-msg-del"
                  onClick={() => remove(m.id)}
                  aria-label={`Delete message from ${m.is_mine ? "you" : m.handle}`}
                >
                  ×
                </button>
              </div>
              <p className="cc-msg-body">{m.body}</p>
            </li>
          ))}
          <div ref={bottomRef} />
        </ul>
      )}

      {crisis && <CrisisInterstitial crisis={crisis} onClose={() => setCrisis(null)} />}

      <form className="cc-compose" onSubmit={send}>
        <textarea
          className="cc-compose-input"
          value={draft}
          onChange={(e) => { setDraft(e.target.value); setRefusal(null); }}
          placeholder={`Say something about ${book.title}…`}
          rows={2}
          maxLength={2000}
          aria-label="Your message"
        />
        <button className="btn brass" disabled={sending || !draft.trim()}>
          {sending ? "sending…" : "send"}
        </button>
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
