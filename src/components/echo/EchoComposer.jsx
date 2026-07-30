import { useState } from "react";
import { EMO_LIST } from "../../services/emotions";
import { postEcho } from "../../services/api";
import CrisisInterstitial from "./CrisisInterstitial";
import "./EchoComposer.css";

/**
 * Echo composer. [F3.2 / B3.2]
 *
 * Deliberately minimal: a book/emotion anchor + the reflection, with a friction
 * line ("say the true thing, not the clever thing"). No formatting, no emotion-
 * picker sprawl (one primary feeling, optional second). If the post trips the
 * self-harm classifier, we swap to the supportive crisis path instead of closing.
 */
const MAX_BODY = 500;
// How many emotion chips show before the list is expanded.
const EMO_PREVIEW = 4;

export default function EchoComposer({ onPosted, onClose }) {
  const [body, setBody] = useState("");
  const [bookTitle, setBookTitle] = useState("");
  const [bookAuthor, setBookAuthor] = useState("");
  const [primary, setPrimary] = useState(null);
  const [secondary, setSecondary] = useState(null);
  const [visibility, setVisibility] = useState("community");
  const [showAllEmotions, setShowAllEmotions] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [crisis, setCrisis] = useState(null);
  const [held, setHeld] = useState(false);

  const toggleEmotion = (id) => {
    if (primary === id) { setPrimary(secondary); setSecondary(null); return; }
    if (secondary === id) { setSecondary(null); return; }
    if (!primary) { setPrimary(id); return; }
    if (!secondary) { setSecondary(id); return; }
    // Both taken — replace the primary, keep it to two max (no sprawl).
    setPrimary(id);
  };

  const submit = async () => {
    if (!body.trim() || busy) return;
    setError("");
    setBusy(true);
    try {
      const res = await postEcho({
        body: body.trim(),
        book_title: bookTitle.trim() || null,
        book_author: bookAuthor.trim() || null,
        primary_emotion: primary,
        secondary_emotion: secondary,
        visibility,
      });
      if (res.crisis) { setCrisis(res.crisis); return; }
      if (res.held_for_review) { setHeld(true); return; }
      onPosted?.(res.echo);
      onClose?.();
    } catch (err) {
      setError(err.message || "Couldn't post your echo.");
    } finally {
      setBusy(false);
    }
  };

  if (crisis) return <CrisisInterstitial crisis={crisis} onClose={onClose} />;

  if (held) {
    return (
      <div className="ec ec-held" role="status" aria-live="polite">
        <div className="ec-held-glyph" aria-hidden="true">◷</div>
        <h2 className="ec-title">Held for a quick look.</h2>
        <p className="ec-held-text">
          Your echo is in the queue for a brief review before it goes public. Nothing you
          did was wrong — this just keeps the space kind. You'll see it in your feed once it clears.
        </p>
        <div className="ec-footer"><button className="btn brass" onClick={onClose}>okay</button></div>
      </div>
    );
  }

  // Chips past the preview that aren't currently chosen, i.e. what "more" reveals.
  const hiddenEmotions = showAllEmotions
    ? 0
    : EMO_LIST.filter(([id], i) => i >= EMO_PREVIEW && primary !== id && secondary !== id).length;

  return (
    <div className="ec">
      <div className="ec-head">
        <div className="label">write an echo</div>
        <p className="ec-friction">Say the true thing, not the clever thing.</p>
      </div>

      <textarea
        className="ec-body"
        placeholder="What did this book actually do to you?"
        value={body}
        maxLength={MAX_BODY}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        aria-label="Your reflection"
      />
      <div className="ec-count">{body.length} / {MAX_BODY}</div>

      <div className="ec-field">
        <div className="label-sm ec-label">anchor to a book <span className="ec-opt">optional</span></div>
        <input className="ec-input" placeholder="Title" value={bookTitle} onChange={(e) => setBookTitle(e.target.value)} />
        <input className="ec-input" placeholder="Author" value={bookAuthor} onChange={(e) => setBookAuthor(e.target.value)} />
      </div>

      <div className="ec-field">
        <div className="label-sm ec-label">the feeling <span className="ec-opt">up to two</span></div>
        {/* Eighteen chips is a wall inside a modal, so the list starts short. A
            chosen emotion is ALWAYS rendered even when collapsed — the control can
            never hide the state it owns — and expanding is one click, never a
            scroll-and-hunt. */}
        <div className="ec-emo" role="group" aria-label="Anchor emotions">
          {EMO_LIST.map(([id, e], i) => {
            const on = primary === id || secondary === id;
            if (!showAllEmotions && i >= EMO_PREVIEW && !on) return null;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={on}
                className={`ec-emo-chip ${on ? "active" : ""} ${primary === id ? "primary" : ""}`}
                style={{ "--emo-c": e.color }}
                onClick={() => toggleEmotion(id)}
              >
                <span className="ec-emo-swatch" />
                {e.label.toLowerCase()}
              </button>
            );
          })}
          {hiddenEmotions > 0 && (
            <button
              type="button"
              className="ec-emo-chip ec-emo-more"
              aria-expanded={showAllEmotions}
              onClick={() => setShowAllEmotions(true)}
            >
              + {hiddenEmotions} more…
            </button>
          )}
        </div>
      </div>

      <div className="ec-field ec-visrow">
        <div className="label-sm ec-label">who sees this</div>
        <div className="ec-vis" role="radiogroup" aria-label="Echo visibility">
          {[
            { v: "community", l: "community" },
            { v: "public", l: "public" },
          ].map((o) => (
            <button
              key={o.v}
              type="button"
              role="radio"
              aria-checked={visibility === o.v}
              className={`ec-vis-opt ${visibility === o.v ? "active" : ""}`}
              onClick={() => setVisibility(o.v)}
            >
              {o.l}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="ec-error" role="alert" aria-live="assertive">{error}</div>}

      <div className="ec-footer">
        <button className="btn ghost" onClick={onClose} disabled={busy}>cancel</button>
        <button className="btn brass" onClick={submit} disabled={!body.trim() || busy}>
          {busy ? "posting…" : "post echo"}
        </button>
      </div>
    </div>
  );
}
