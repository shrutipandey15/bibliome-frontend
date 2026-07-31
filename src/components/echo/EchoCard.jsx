import { useState, useRef, useEffect, useMemo } from "react";
import { EMOTIONS } from "../../services/emotions";
import { reactToEcho, postReply } from "../../services/api";
import "./EchoCard.css";

/**
 * A single echo. [F3.3 → rebuilt F6.1 / F6.2]
 *
 * DESIGN RULES enforced here:
 *  - NO public counts of any kind. A viewer sees only their OWN reaction toggle
 *    state. The private tally ("4 underlined") is shown ONLY when the payload
 *    carries `reaction_counts` — i.e. the viewer is the author. [F6.1]
 *  - Reply is a PRIMARY, always-visible action in the action row — never in the
 *    ⋯ menu. The ⋯ menu carries SAFETY actions only: mute / block / report. [F6.1]
 *  - Replies are shown, not counted: the first replies render inline; more echoes
 *    are reached via a neutral "read the rest →" with no number. [F6.2]
 *  - The handle is plain text, NOT a link — no people-browsing. [F3.7]
 *
 * Widened EchoResponse contract this renders against (B6.1–B6.4):
 *   my_reactions:    array of kinds OR { kind: bool } — the VIEWER'S own toggles
 *   reaction_counts: { kind: n }  — present ONLY when the viewer is the author
 *   replies_preview: [{ id, handle, body, created_at }]  — first ~2 replies
 *   has_more_replies: bool
 */

// Reactions are marginalia, not likes — what a reader does with a book. [F6.1]
const REACTIONS = [
  { kind: "felt_this",       label: "underlined",         tally: "underlined",                  mark: "⌇" },
  { kind: "adding_to_list",  label: "to my shelf",        tally: "added it to their shelf",     mark: "+", requiresBook: true, shelves: true },
  { kind: "changed_my_mind", label: "made me reconsider", tally: "reconsidered",                mark: "↻" },
];

const MAX_REPLY = 500;

function fmtDate(iso) {
  try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
  catch { return ""; }
}

// Normalise my_reactions (array of kinds OR a { kind: bool } map) to a plain map.
function toReactionMap(my) {
  if (!my) return {};
  if (Array.isArray(my)) return Object.fromEntries(my.map((k) => [k, true]));
  return { ...my };
}

export default function EchoCard({ echo, onReadMore, onReport, onMute, onBlock, onToast, hiddenHandles }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const [reactions, setReactions] = useState(() => toReactionMap(echo.my_reactions));

  // Inline replies: seed from the preview, append optimistically on post. [F6.2]
  const [replies, setReplies] = useState(() => echo.replies_preview || []);
  const [hasMore, setHasMore] = useState(!!echo.has_more_replies);

  const [composerOpen, setComposerOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [posting, setPosting] = useState(false);
  const [replyError, setReplyError] = useState("");

  const replyBtnRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  useEffect(() => {
    if (composerOpen) textareaRef.current?.focus();
  }, [composerOpen]);

  const emo = echo.primary_emotion ? EMOTIONS[echo.primary_emotion] : null;
  const color = emo?.color || "var(--ink)";
  const hasBook = !!echo.book_title;

  const act = (fn) => () => { setMenuOpen(false); fn?.(echo); };

  // Stated outright by the backend rather than inferred from `reaction_counts`
  // being non-null. Falls back to that inference only for a payload predating the
  // field. Drives the "yours" mark and the suppression of self-reactions.
  const isMine = echo.is_mine ?? (echo.reaction_counts != null);

  // Author-only private tally. `reply_count` is counted server-side and
  // block-filtered to match the preview, so it never exceeds what the author can
  // actually open; a zero arrives as an explicit 0 and simply contributes no part,
  // leaving the quiet line below to speak for the silence.
  const tally = useMemo(() => {
    const counts = echo.reaction_counts;
    if (!counts) return null;
    const parts = REACTIONS
      .map((r) => (counts[r.kind] > 0 ? `${counts[r.kind]} ${r.tally}` : null))
      .filter(Boolean);
    const n = echo.reply_count;
    if (n > 0) parts.push(`${n} ${n === 1 ? "reply" : "replies"}`);
    return parts.length ? parts.join(" · ") : null;
  }, [echo.reaction_counts, echo.reply_count]);

  const toggleReaction = async (r) => {
    const on = !reactions[r.kind];
    setReactions((s) => ({ ...s, [r.kind]: on })); // optimistic
    try {
      await reactToEcho(echo.id, r.kind, on);
      if (on && r.shelves) onToast?.("Added to your shelf");
    } catch {
      setReactions((s) => ({ ...s, [r.kind]: !on })); // roll back
      onToast?.("Couldn't save that", "error");
    }
  };

  const openComposer = () => { setReplyError(""); setComposerOpen(true); };
  const closeComposer = ({ restoreFocus = true } = {}) => {
    setComposerOpen(false);
    setReplyText("");
    setReplyError("");
    if (restoreFocus) replyBtnRef.current?.focus();
  };

  const submitReply = async () => {
    const body = replyText.trim();
    if (!body || posting) return;
    setPosting(true);
    setReplyError("");
    // Optimistic: show the reply inline immediately with a temporary id. [F6.2]
    const tempId = `tmp-${Date.now()}`;
    const optimistic = { id: tempId, handle: "you", body, created_at: new Date().toISOString(), _pending: true };
    setReplies((rs) => [...rs, optimistic]);
    setReplyText("");
    try {
      const saved = await postReply(echo.id, body);
      setReplies((rs) => rs.map((r) => (r.id === tempId ? saved : r)));
      closeComposer();
    } catch (err) {
      setReplies((rs) => rs.filter((r) => r.id !== tempId)); // roll back
      setReplyText(body);
      setReplyError(err.message || "Couldn't post your reply.");
    }
    setPosting(false);
  };

  const onComposerKeyDown = (e) => {
    if (e.key === "Escape") { e.stopPropagation(); closeComposer(); }
  };

  const hidden = hiddenHandles instanceof Set ? hiddenHandles : new Set(hiddenHandles || []);
  const visibleReplies = replies.filter((r) => !hidden.has(r.handle));

  return (
    <article className="eco-row" style={{ "--eco-c": color }}>
      {/* THE MARGIN. Date and feeling are metadata about the paragraph, not part
          of it — so they sit beside the prose in a ruled column rather than in a
          header bar the prose has to start underneath. */}
      <div className="eco-margin">
        <span className="eco-date">{fmtDate(echo.created_at)}</span>
        {emo && (
          <span className="eco-emo" style={{ color }}>
            <span className="eco-emo-swatch" aria-hidden="true" />
            {(emo.name || emo.label).toLowerCase()}
          </span>
        )}
        {/* Secondary emotion recedes — it is a qualifier, not a second headline. */}
        {echo.secondary_emotion && EMOTIONS[echo.secondary_emotion] && (
          <span className="eco-emo-sec">
            {(EMOTIONS[echo.secondary_emotion].name || EMOTIONS[echo.secondary_emotion].label).toLowerCase()}
          </span>
        )}
        {isMine && <span className="eco-mine">yours</span>}
      </div>

      <div className="eco-col">
        {/* The body is the star. */}
        <p className="eco-body">{echo.body}</p>

        <div className="eco-foot">
          {/* Title only — the author is on the shelf entry, and the footer is a
              caption line, not a citation. */}
          {echo.book_title && <span className="eco-book">{echo.book_title}</span>}
          {/* Handle: plain text, NOT a link — no people-browsing. [F3.7] */}
          <span className="eco-handle">@{echo.handle}</span>
        </div>

        {/* Author-only private tally — the witness payoff. Quiet, never a badge. [F6.1]
            Silence gets its own line rather than an absence, so an unanswered echo
            reads as fine rather than as a number you failed to reach. */}
        {isMine && (
          tally
            ? <div className="eco-tally">{tally}</div>
            : <div className="eco-tally eco-tally--quiet">No replies. You didn't write it for them.</div>
        )}

        {/* ACTION ROW. On your own echo the REACTIONS drop away — you cannot underline
            or shelve yourself, and the tally above is what your card has to say — but
            REPLY stays: an author answering their own thread is the whole point of
            having one. [F6.1] */}
        <div className="eco-actions" role="group" aria-label="Echo actions">
          {!isMine && REACTIONS.map((r) => {
            if (r.requiresBook && !hasBook) return null; // hide "to my shelf" with no anchor
            const on = !!reactions[r.kind];
            return (
              <button
                key={r.kind}
                type="button"
                className={`eco-act eco-react ${on ? "on" : ""}`}
                aria-pressed={on}
                onClick={() => toggleReaction(r)}
              >
                <span className="eco-act-mark" aria-hidden="true">{r.mark}</span>
                {r.label}
              </button>
            );
          })}
          <button
            type="button"
            ref={replyBtnRef}
            className="eco-act eco-reply-btn"
            aria-expanded={composerOpen}
            onClick={() => (composerOpen ? closeComposer() : openComposer())}
          >
            <span className="eco-act-mark" aria-hidden="true">↩</span>
            reply
          </button>

          <div className="eco-menu-wrap" ref={menuRef}>
            <button
              className="eco-menu-btn"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Safety actions"
              title="mute · block · report"
              onClick={() => setMenuOpen((o) => !o)}
            >
              ⋯
            </button>
            {/* Safety actions ONLY. Reply lives in the action row, not here. [F6.1]
                They open in line rather than in a floating card: three words don't
                need a surface, and a popover over an editorial row reads as a menu
                belonging to the page, not to this echo. */}
            {menuOpen && (
              <div className="eco-menu" role="menu">
                <button role="menuitem" onClick={act(onMute)}>mute @{echo.handle}</button>
                <button role="menuitem" onClick={act(onBlock)}>block @{echo.handle}</button>
                <button role="menuitem" className="eco-menu-danger" onClick={act(onReport)}>report</button>
              </div>
            )}
          </div>
        </div>

        {/* Inline reply composer — on the row, not a modal. [F6.2] */}
        {composerOpen && (
          <div className="eco-composer">
            <label className="sr-only" htmlFor={`reply-${echo.id}`}>Your reply to @{echo.handle}</label>
            <textarea
              id={`reply-${echo.id}`}
              ref={textareaRef}
              className="eco-reply-input"
              placeholder="Say something true…"
              value={replyText}
              maxLength={MAX_REPLY}
              rows={2}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={onComposerKeyDown}
            />
            {replyError && <div className="eco-reply-error" role="alert">{replyError}</div>}
            <div className="eco-composer-foot">
              <button type="button" className="eco-composer-cancel" onClick={() => closeComposer()}>cancel</button>
              <button type="button" className="btn brass" onClick={submitReply} disabled={!replyText.trim() || posting}>
                {posting ? "posting…" : "reply"}
              </button>
            </div>
          </div>
        )}

        {/* Inline replies — shown, never counted. [F6.2] */}
        {visibleReplies.length > 0 && (
          <ul className="eco-replies" aria-live="polite">
            {visibleReplies.map((r) => (
              <li key={r.id} className={`eco-reply ${r._pending ? "pending" : ""}`}>
                <span className="eco-reply-handle">@{r.handle}</span>
                <span className="eco-reply-body">{r.body}</span>
              </li>
            ))}
          </ul>
        )}

        {/* "read the rest →" — only if more exist; NO number. [F6.2] */}
        {hasMore && (
          <button type="button" className="eco-readrest" onClick={() => onReadMore?.(echo)}>
            read the rest →
          </button>
        )}
      </div>
    </article>
  );
}
