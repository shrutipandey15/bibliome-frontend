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

function Cover({ url }) {
  const [failed, setFailed] = useState(false);
  if (url && !failed) {
    return <img className="rm-cover-img" src={url} alt="" onError={() => setFailed(true)} />;
  }
  // A drawn plate rather than a broken frame. Deliberately an ornament and not
  // the title: the title is already sitting an inch to the right, and printing
  // it twice reads as a rendering bug, not as a book.
  return (
    <div className="rm-cover-blank" aria-hidden="true">
      <span className="rm-cover-blank-mark">❋</span>
    </div>
  );
}

/**
 * A shared emotion, with both intensities as a pair of marks. `close` means the
 * two readers felt it at a similar pitch — the thing that makes a match "strong"
 * rather than merely overlapping.
 */
function SharedEmotion({ emotion }) {
  const meta = EMOTIONS[emotion.emotion_id];
  const color = meta?.color || "var(--brass)";
  return (
    <li className="rm-emo" style={{ "--emo-c": color }}>
      <span className="rm-emo-swatch" aria-hidden="true" />
      <span className="rm-emo-label">{emotion.label}</span>
      <span className="rm-emo-pitch" aria-label={`you ${emotion.your_strength} of 10, them ${emotion.their_strength} of 10`}>
        <span className="rm-emo-bar" style={{ "--w": `${emotion.your_strength * 10}%` }} />
        <span className="rm-emo-bar" style={{ "--w": `${emotion.their_strength * 10}%` }} />
      </span>
      {emotion.close && <span className="rm-emo-close">at the same pitch</span>}
    </li>
  );
}

const STRENGTH_LINE = {
  strong: "You felt this book the same way, at about the same depth.",
  light: "You felt some of the same things about this book.",
};

export default function MatchCard({ match, onReach, onAccept, onDecline, onOpenThread, busy }) {
  const [composing, setComposing] = useState(false);
  const [error, setError] = useState("");
  const { status, direction } = match;

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

  return (
    <article className={`rm rm-${status}`}>
      <div className="rm-cover">
        <Cover url={match.cover_url} />
      </div>

      <div className="rm-body">
        <div className="label rm-kicker">· someone else read this ·</div>
        <h3 className="rm-title">{match.book_title || "An untitled volume"}</h3>
        {match.book_author && <div className="rm-author">{match.book_author}</div>}

        <p className="rm-strength">{STRENGTH_LINE[match.strength] || STRENGTH_LINE.light}</p>

        <ul className="rm-emos">
          {(match.shared_emotions || []).map((e) => (
            <SharedEmotion key={e.emotion_id} emotion={e} />
          ))}
        </ul>

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
          <div className="rm-waiting-line">Your note is with them.</div>
          {/* No deadline, no "they've seen it", no nudge button. If nothing comes
              back the card simply stops being here one day. */}
          <div className="rm-waiting-sub">They'll read it if they answer. There's nothing else to do.</div>
        </div>
      </div>
    );
  }

  if (status === "pending" && direction === "they_reached") {
    return (
      <div className="rm-foot">
        <div className="rm-reached">Someone who felt the same way left you a note.</div>
        <div className="rm-foot-actions">
          <button className="btn brass" onClick={onCompose} disabled={busy}>Write back</button>
          {/* Silent on the server too — they are never told they were passed
              over, and neither side sees this card again. */}
          <button className="btn ghost rm-quiet" onClick={onDecline} disabled={busy}>let it pass</button>
        </div>
      </div>
    );
  }

  // suggested
  return (
    <div className="rm-foot">
      <div className="rm-foot-actions">
        <button className="btn brass" onClick={onCompose} disabled={busy}>Leave a note</button>
        <button className="btn ghost rm-quiet" onClick={onDecline} disabled={busy}>not this one</button>
      </div>
    </div>
  );
}
