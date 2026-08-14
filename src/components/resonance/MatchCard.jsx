import { useState } from "react";
import { EMOTIONS } from "../../services/emotions";
import NoteComposer from "./NoteComposer";

/**
 * One surfaced match. [F: anonymous by design]
 *
 * The card shows a BOOK and a FEELING. That is the entire vocabulary available
 * to it — there is no name, no handle, no avatar, no "reader since", no link to
 * anything belonging to the other person, because the server sends none of those
 * fields before `connected` (app/schemas/resonance.py: MatchResponse has no
 * user_id and never will).
 *
 * If you are tempted to add "3 readers felt this too" here: the backend has no
 * query for it, on purpose.
 */

/**
 * The plate. A cover if we have one; otherwise a real drawn object — boards,
 * a rule inset from the edge, the title set on it — rather than a grey square
 * with an ornament, which read as a failed image rather than as a book. The
 * title appearing twice is fine here in a way it wasn't before: on a plate it
 * reads as the cover of the book named beside it, which is what covers do.
 */
function Cover({ url, title, author }) {
  const [failed, setFailed] = useState(false);
  if (url && !failed) {
    return <img className="rm-cover-img" src={url} alt="" onError={() => setFailed(true)} />;
  }
  return (
    <div className="rm-plate" style={{ "--plate-c": plateColor(title) }} aria-hidden="true">
      <div className="rm-plate-title">{title}</div>
      {author && <div className="rm-plate-author">{author}</div>}
    </div>
  );
}

// A stable colour per title, so the same book is the same object every time it
// surfaces. Drawn from the palette the app already uses for materials.
const PLATE_COLORS = ["var(--oxblood)", "var(--plum)", "var(--moss)", "var(--ink-blue)", "var(--brass)"];
function plateColor(title) {
  let h = 0;
  for (const ch of title || "") h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PLATE_COLORS[h % PLATE_COLORS.length];
}

/**
 * A shared emotion, with both intensities as a pair of labelled bars. `close`
 * means the two readers felt it at a similar pitch — the thing that makes a
 * match "strong" rather than merely overlapping.
 *
 * The bars are labelled "you" and "them" now. Two unlabelled rules were a shape
 * you had to be told the meaning of. Intensity still never appears as a number:
 * "7/10" invites comparison, a pair of lines invites recognition.
 */
function SharedEmotion({ emotion }) {
  const meta = EMOTIONS[emotion.emotion_id];
  const color = meta?.color || "var(--res-accent)";
  return (
    <li className="rm-emo" style={{ "--emo-c": color }}>
      <div className="rm-emo-head">
        <span className="rm-emo-swatch" aria-hidden="true" />
        <span className="rm-emo-label">{emotion.label}</span>
        {emotion.close && <span className="rm-emo-close">at the same pitch</span>}
      </div>
      <div
        className="rm-emo-pitch"
        aria-label={`you ${emotion.your_strength} of 10, them ${emotion.their_strength} of 10`}
      >
        <span className="rm-emo-who" aria-hidden="true">you</span>
        <span className="rm-emo-track" aria-hidden="true">
          <span className="rm-emo-bar" style={{ "--w": `${emotion.your_strength * 10}%` }} />
        </span>
        <span className="rm-emo-who" aria-hidden="true">them</span>
        <span className="rm-emo-track" aria-hidden="true">
          <span className="rm-emo-bar theirs" style={{ "--w": `${emotion.their_strength * 10}%` }} />
        </span>
      </div>
    </li>
  );
}

const STRENGTH_LINE = {
  strong: "You felt this book the same way, at about the same depth.",
  light: "You felt some of the same things about this book.",
};

export default function MatchCard({ match, onReach, onAccept, onDecline, onOpenThread, busy, foldable = false }) {
  const [composing, setComposing] = useState(false);
  const [error, setError] = useState("");
  const { status, direction } = match;
  const title = match.book_title || "An untitled volume";

  const submitNote = async (note) => {
    setError("");
    try {
      // `suggested` → reach out. `pending`+they_reached → answering, which is a
      // respond(accept) with a note of your own, not a second reach.
      if (status === "pending" && direction === "they_reached") await onAccept(note);
      else await onReach(note);
      setComposing(false);
    } catch (err) {
      setError(err?.message || "Couldn't send that. Try again in a moment.");
    }
  };

  // Folded when there is genuinely nothing to do.
  //
  // NOT simply "Waiting": that section is `status === "pending"`, which holds
  // BOTH directions. `they_reached` means another reader wrote to you and you
  // can answer — the most actionable card on the page — so collapsing the whole
  // section would bury it. (The section's own note, "Sent, or arrived. Nothing
  // to do either way", is only true of the half below.)
  const nothingToDo = status === "pending" && direction === "you_reached";
  // `foldable` is the caller's choice (Surfaced folds them all); `nothingToDo`
  // folds itself regardless of who rendered it.
  const folded = foldable || nothingToDo;
  const shared = (match.shared_emotions || []).length;
  // The folded row has to carry enough to decide whether to open it. For a
  // waiting match that's its state; for a surfaced one it's the only thing the
  // card is arguing — how much you two overlapped.
  const summaryNote = nothingToDo
    ? "your note is with them"
    : `${shared} feeling${shared === 1 ? "" : "s"} in common`;

  const body = (
    <div className="rm-body">
        <div className="rm-kicker">· someone else read this ·</div>
        <h3 className="rm-title">{title}</h3>
        {match.book_author && <div className="rm-author">{match.book_author}</div>}

        <p className="rm-strength">{STRENGTH_LINE[match.strength] || STRENGTH_LINE.light}</p>

        <ul className="rm-emos">
          {(match.shared_emotions || []).map((e) => (
            <SharedEmotion key={e.emotion_id} emotion={e} />
          ))}
        </ul>

        {/* Their note, when they wrote first. Set on its own sheet because it is
            the only thing on this card another person actually wrote. */}
        {status === "pending" && direction === "they_reached" && match.their_note && (
          <div className="rm-their-note">
            <div className="rm-their-note-kicker">they wrote first</div>
            <p>{match.their_note}</p>
          </div>
        )}

        {composing ? (
          <NoteComposer
            onSubmit={submitNote}
            onCancel={() => { setComposing(false); setError(""); }}
            busy={busy}
            error={error}
            {...(status === "pending" && direction === "they_reached"
              ? {
                  placeholder: "Say something back.",
                  submitLabel: "Write back",
                  hint: "Writing back opens the letters — you'll both see each other's note and handle, and nothing before that.",
                }
              : {})}
          />
        ) : (
          <MatchAction
            match={match}
            busy={busy}
            onCompose={() => setComposing(true)}
            onDecline={onDecline}
            onOpenThread={onOpenThread}
          />
        )}
    </div>
  );

  if (folded) {
    return (
      <details className={`rm rm-${status} rm-fold`}>
        <summary className="rm-summary">
          {match.cover_url
            ? <img className="rm-summary-cover" src={match.cover_url} alt="" />
            : <span className="rm-summary-cover rm-summary-cover--blank" aria-hidden="true" />}
          <span className="rm-summary-body">
            <span className="rm-summary-title">{title}</span>
            <span className="rm-summary-note">{summaryNote}</span>
          </span>
          <span className="rm-summary-chev" aria-hidden="true">⌄</span>
        </summary>
        {/* No cover in here. The summary above already shows one, and repeating
            it put two images of the same book about ten pixels apart, which
            reads as a duplicate row rather than as one card opening. */}
        <div className="rm-fold-body">{body}</div>
      </details>
    );
  }

  return (
    <article className={`rm rm-${status}`}>
      <div className="rm-cover">
        <Cover url={match.cover_url} title={title} author={match.book_author} />
      </div>
      {body}
    </article>
  );
}

/** The single affordance for the card's current state. */
function MatchAction({ match, busy, onCompose, onDecline, onOpenThread }) {
  const { status, direction } = match;

  if (status === "connected") {
    return (
      <div className="rm-foot">
        <button className="btn brass" onClick={onOpenThread}>Open the letters</button>
        {/* The handle appears here and nowhere earlier — it is the reward for
            both people having said yes, not a preview. It is plain text: there
            is no profile to link to. */}
        {match.handle && <span className="rm-handle">with @{match.handle}</span>}
      </div>
    );
  }

  if (status === "pending" && direction === "you_reached") {
    return (
      <div className="rm-waiting" role="status">
        <span className="rm-waiting-glyph" aria-hidden="true">◷</span>
        <div>
          {/* This used to read "Your note is with them." — the exact sentence
              the fold's own summary carries. A <details> renders its body while
              closed and shows both once opened, so the card said the same thing
              twice about 40px apart, which reads as a rendering fault rather
              than as emphasis. The summary states WHERE the note is; this states
              what happens next, which is the half you can only see by opening. */}
          <div className="rm-waiting-line">They'll read it if they answer.</div>
          {/* No deadline, no "they've seen it", no nudge button. If nothing comes
              back the card simply stops being here one day. */}
          <div className="rm-waiting-sub">Nothing else to do.</div>
        </div>
      </div>
    );
  }

  if (status === "pending" && direction === "they_reached") {
    return (
      <div className="rm-foot">
        <div className="rm-reached">Someone who felt the same way left you a note.</div>
        <button className="btn brass" onClick={onCompose} disabled={busy}>Write back</button>
        {/* Silent on the server too — they are never told they were passed
            over, and neither side sees this card again. */}
        <button className="rm-quiet" onClick={onDecline} disabled={busy}>let it pass</button>
      </div>
    );
  }

  // suggested
  return (
    <div className="rm-foot">
      <button className="btn brass" onClick={onCompose} disabled={busy}>Leave a note</button>
      <button className="rm-quiet" onClick={onDecline} disabled={busy}>not this one</button>
    </div>
  );
}

/**
 * A connected match, as an inbox row rather than a card.
 *
 * "Open letters" is a list of conversations you are already in. The full card
 * spends ~450px re-arguing the shared feelings that made the match — evidence
 * for a decision both of you already said yes to. On Surfaced that evidence IS
 * the decision; here it is a receipt. So the row carries only what you need to
 * pick the right conversation: who, and which book.
 *
 * No date: `created_at` on a match is when it was MADE, not when the last letter
 * arrived, and a timestamp in an inbox reads as recency. The API serves no
 * last-message field, so rather than print a misleading one this prints none.
 */
export function ThreadRow({ match, onOpen }) {
  const cover = match.cover_url;
  return (
    // Without a label the accessible name is a run-on of everything inside —
    // "@quiet_reader The Remains of the Day · Kazuo Ishiguro" — which names the
    // row's contents but never says what pressing it does. The action is the
    // name; the contents stay as visible text for everyone else.
    <button className="rt-row" onClick={onOpen} aria-label={`Open the letters with @${match.handle || "your reader"}`}>
      {cover
        ? <img className="rt-row-cover" src={cover} alt="" />
        : <span className="rt-row-cover rt-row-cover--blank" aria-hidden="true" />}
      <span className="rt-row-body">
        <span className="rt-row-who">@{match.handle || "your reader"}</span>
        <span className="rt-row-book">
          {match.book_title}
          {match.book_author && <span className="rt-row-author"> · {match.book_author}</span>}
        </span>
      </span>
      <span className="rt-row-chev" aria-hidden="true">→</span>
    </button>
  );
}
