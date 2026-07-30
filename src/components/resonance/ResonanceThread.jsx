import { useState, useEffect, useCallback } from "react";
import {
  getThreadMessages, sendThreadMessage, blockThread, reportThread,
} from "../../services/api";

/**
 * The conversation, once both readers have said yes. [F: letters, not chat]
 *
 * Everything a live chat app uses to manufacture urgency is deliberately absent,
 * and the backend serves none of it either:
 *   - no read receipts, no "seen at", no delivery ticks
 *   - no typing indicator, no presence dot, no "last active"
 *   - no polling loop — the transcript loads when you open it and after you send
 *
 * The effect is a letter you wrote and a letter that arrived, which is the pace
 * this whole feature is built for. Adding a 5-second poll here would quietly
 * make it a chat app.
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getThreadMessages(threadId);
      setMessages(data.messages || []);
      setBefore(data.next_before || null);
    } catch {
      setError("Couldn't open this conversation.");
    }
    setLoading(false);
  }, [threadId]);

  useEffect(() => { load(); }, [load]);

  const loadEarlier = async () => {
    if (!before) return;
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
    if (!text || sending) return;
    setError("");
    setSending(true);
    try {
      const saved = await sendThreadMessage(threadId, text);
      setMessages((prev) => [...prev, saved]);
      setBody("");
    } catch (err) {
      setError(err?.message || "Couldn't send that.");
    }
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
    <div className="rt">
      <header className="rt-head">
        <div>
          <div className="label rt-kicker">· the letters ·</div>
          <div className="rt-with">
            {handle ? <>with <strong>@{handle}</strong></> : "with your reader"}
            {bookTitle && <span className="rt-book">, about <em>{bookTitle}</em></span>}
          </div>
        </div>
        <div className="rt-head-actions">
          <button className="rt-quiet" onClick={() => setSafety((s) => !s)}>
            {safety ? "back" : "…"}
          </button>
          <button className="btn ghost" onClick={onClose}>close</button>
        </div>
      </header>

      {safety && (
        <div className="rt-safety">
          <p className="rt-safety-line">
            Ending this is silent — they aren't told, the conversation just stops.
          </p>
          <div className="rt-safety-actions">
            <button className="btn ghost" onClick={() => endIt(() => blockThread(threadId))}>
              stop this conversation
            </button>
            {REPORT_CATEGORIES.map((c) => (
              <button
                key={c.id}
                className="rt-report-btn"
                onClick={() => endIt(() => reportThread(threadId, c.id, true))}
              >
                report: {c.label}
              </button>
            ))}
          </div>
        </div>
      )}

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
                <div className="rt-msg-body">{m.body}</div>
                <div className="rt-msg-meta">
                  {m.is_mine ? "you" : `@${m.handle}`} · {letterDate(m.created_at)}
                </div>
              </article>
            ))}
          </>
        )}
      </div>

      {error && <div className="rt-error" role="alert">{error}</div>}

      <div className="rt-compose">
        <textarea
          className="rt-compose-field"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write back, whenever you like."
          rows={3}
          maxLength={MAX_MESSAGE}
          aria-label="Your message"
        />
        <div className="rt-compose-foot">
          {/* No "they're typing", no "delivered". Just the act of sending. */}
          <span className="rt-compose-note">No rush — they'll read it when they read it.</span>
          <button className="btn brass" onClick={send} disabled={!body.trim() || sending}>
            {sending ? "sending…" : "send"}
          </button>
        </div>
      </div>
    </div>
  );
}
