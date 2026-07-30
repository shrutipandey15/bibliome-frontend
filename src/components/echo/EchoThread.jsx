import { useState, useEffect } from "react";
import { EMOTIONS } from "../../services/emotions";
import { getEchoThread, postReply, reactToEcho } from "../../services/api";
import "./EchoThread.css";

/**
 * Echo thread: the echo + its replies + a reply box. [F3.4 / B3.4]
 *
 * Replies are shown BEFORE any reaction affordance — conversation is the point.
 * Reactions are private (the viewer never sees a count; only the author can, via
 * a separate endpoint), so here they are just silent personal toggles. [B3.5]
 */
const REACTIONS = [
  { kind: "felt_this",        label: "underlined",         mark: "⌇" },
  { kind: "adding_to_list",   label: "to my shelf",        mark: "+", requiresBook: true },
  { kind: "changed_my_mind",  label: "made me reconsider", mark: "↻" },
];

const MAX_REPLY = 500;

function fmtDate(iso) {
  try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
  catch { return ""; }
}

export default function EchoThread({ echoId, onReport }) {
  const [thread, setThread] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");
  const [myReactions, setMyReactions] = useState({});

  useEffect(() => {
    let alive = true;
    getEchoThread(echoId)
      .then((t) => {
        if (!alive) return;
        setThread(t);
        // Seed from the viewer's own toggles. Without this the thread always opened
        // with every reaction unset, so a reaction set on the card looked undone —
        // and pressing it again would toggle it OFF.
        const mine = t?.echo?.my_reactions;
        if (Array.isArray(mine)) setMyReactions(Object.fromEntries(mine.map((k) => [k, true])));
        else if (mine) setMyReactions({ ...mine });
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [echoId]);

  const submitReply = async () => {
    if (!reply.trim() || posting) return;
    setError("");
    setPosting(true);
    try {
      const saved = await postReply(echoId, reply.trim());
      setThread((t) => ({ ...t, replies: [...(t?.replies || []), saved] }));
      setReply("");
    } catch (err) {
      setError(err.message || "Couldn't post your reply.");
    }
    setPosting(false);
  };

  const toggleReaction = async (kind) => {
    const on = !myReactions[kind];
    setMyReactions((r) => ({ ...r, [kind]: on })); // optimistic, silent
    try { await reactToEcho(echoId, kind, on); }
    catch { setMyReactions((r) => ({ ...r, [kind]: !on })); }
  };

  if (loading) return <div className="et et-loading">loading…</div>;
  if (!thread?.echo) return <div className="et et-loading">This echo is no longer available.</div>;

  const echo = thread.echo;
  const emo = echo.primary_emotion ? EMOTIONS[echo.primary_emotion] : null;
  const sec = echo.secondary_emotion ? EMOTIONS[echo.secondary_emotion] : null;
  const color = emo?.color || "var(--ink)";
  // Stated by the backend; the thread route now answers it too (it previously
  // passed no viewer, so ownership was unanswerable here). You cannot react to
  // yourself, but you can still reply in your own thread.
  const isMine = echo.is_mine ?? (echo.reaction_counts != null);
  const hasBook = !!echo.book_title;

  return (
    <div className="et" style={{ "--eco-c": color }}>
      {/* THE ECHO — with its actions attached, the way the card has them. The
          reaction row used to sit at the very bottom, below the reply box, which
          put it after the conversation it belongs to. */}
      <article className="et-echo">
        <div className="et-emos">
          {emo && <span className="et-emo" style={{ color }}>◉ {emo.label.toLowerCase()}</span>}
          {sec && <span className="et-emo et-emo-sec">{sec.label.toLowerCase()}</span>}
        </div>
        <p className="et-body">{echo.body}</p>
        <div className="et-foot">
          {hasBook && <span className="et-book">{echo.book_title}</span>}
          <span className="et-handle">@{echo.handle}</span>
          <span className="et-date">{fmtDate(echo.created_at)}</span>
        </div>
        {!isMine && (
          <div className="et-reactions" role="group" aria-label="Private reactions">
            {REACTIONS.map((r) => {
              if (r.requiresBook && !hasBook) return null;
              const on = !!myReactions[r.kind];
              return (
                <button
                  key={r.kind}
                  type="button"
                  aria-pressed={on}
                  className={`et-react ${on ? "active" : ""}`}
                  onClick={() => toggleReaction(r.kind)}
                >
                  <span className="et-react-mark" aria-hidden="true">{r.mark}</span>
                  {r.label}
                </button>
              );
            })}
          </div>
        )}
      </article>

      {/* REPLIES — one thread beneath the echo, chronological, on its own ground. */}
      <div className="et-replies">
        <div className="et-replies-label">Replies</div>
        {thread.replies.length === 0 ? (
          <div className="et-empty">No replies yet. Be the first to say something true.</div>
        ) : (
          <ul className="et-reply-list">
            {thread.replies.map((r) => (
              <li key={r.id} className="et-reply">
                <div className="et-reply-head">
                  <span className="et-handle">@{r.handle}</span>
                  <span className="et-date">{fmtDate(r.created_at)}</span>
                  {onReport && (
                    <button className="et-reply-report" onClick={() => onReport(r)}>report</button>
                  )}
                </div>
                <p className="et-reply-body">{r.body}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* The reply box closes the thread — the last thing under the conversation. */}
      <div className="et-replybox">
        <textarea
          className="et-reply-input"
          placeholder="Say something true…"
          value={reply}
          maxLength={MAX_REPLY}
          onChange={(e) => setReply(e.target.value)}
          rows={2}
          aria-label="Your reply"
        />
        {error && <div className="et-error" role="alert" aria-live="assertive">{error}</div>}
        <div className="et-replybox-foot">
          <span className="et-count">{reply.length} / {MAX_REPLY}</span>
          <button className="btn brass" onClick={submitReply} disabled={!reply.trim() || posting}>
            {posting ? "posting…" : "reply"}
          </button>
        </div>
      </div>
    </div>
  );
}
