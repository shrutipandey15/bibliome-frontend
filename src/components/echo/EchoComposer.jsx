import { useState } from "react";
import { getEmotionFamilies } from "../../services/emotions";
import { postEcho } from "../../services/api";
import CrisisInterstitial from "./CrisisInterstitial";
import "./EchoComposer.css";

/**
 * Echo composer. [F3.2 / B3.2]
 *
 * Two panes. The left is a sheet with nothing on it but the sentence and the
 * friction line; the right holds everything that is *about* the sentence — the
 * book, the feeling, who sees it — and ends in the post button. The old single
 * column made you scroll past the anchor fields to reach the button, which put
 * the fiddly decisions between the reader and the thing they came to say.
 *
 * The emotion picker shows all eighteen, grouped by family. The old "+14 more…"
 * reveal existed because a flat wall of eighteen chips is unreadable — grouping
 * fixes the same problem without hiding two thirds of the vocabulary behind a
 * click. Still one primary and an optional second: no sprawl.
 */
const MAX_BODY = 500;

export default function EchoComposer({ onPosted, onClose }) {
  const [body, setBody] = useState("");
  const [bookTitle, setBookTitle] = useState("");
  const [bookAuthor, setBookAuthor] = useState("");
  const [primary, setPrimary] = useState(null);
  const [secondary, setSecondary] = useState(null);
  // Not a choice any more — see the note by "who sees this". The field stays in
  // the payload because the API still requires one of community|public.
  const visibility = "community";
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
        <h2 className="ec-title">Held for review.</h2>
        <p className="ec-held-text">
          Something in this tripped the filter. A human will look at it, and it lands in
          your feed once it clears.
        </p>
        <div className="ec-footer"><button className="btn brass" onClick={onClose}>okay</button></div>
      </div>
    );
  }

  const families = getEmotionFamilies();
  const picked = [primary, secondary].filter(Boolean).length;
  const pickHint = picked === 0 ? "up to two" : picked === 1 ? "one more, if you want" : "that's both";

  return (
    <div className="ec">
      {/* ── the sheet ── */}
      <div className="ec-write">
        <div className="ec-write-head">
          <span className="ec-kicker">write an echo</span>
          <span className={`ec-count ${body.length > MAX_BODY - 60 ? "near" : ""}`}>
            {body.length} / {MAX_BODY}
          </span>
        </div>
        <p className="ec-friction">Say the true thing, not the clever thing.</p>
        <div className="ec-write-rule" />
        <textarea
          className="ec-body"
          placeholder="What did this book actually do to you?"
          value={body}
          maxLength={MAX_BODY}
          onChange={(e) => setBody(e.target.value)}
          aria-label="Your reflection"
        />
        {/* The rules of the room, stated where you're breaking or keeping them. */}
        <div className="ec-write-foot">no formatting · no edits after posting · no counts, ever</div>
      </div>

      {/* ── what the sheet is about ── */}
      <div className="ec-anchor">
        <div className="ec-label">anchor to a book <span className="ec-opt">optional</span></div>
        <input className="ec-input" placeholder="Title" value={bookTitle} onChange={(e) => setBookTitle(e.target.value)} />
        <input className="ec-input" placeholder="Author" value={bookAuthor} onChange={(e) => setBookAuthor(e.target.value)} />

        <div className="ec-feel-head">
          <span className="ec-label">the feeling</span>
          <span className={`ec-pick-hint ${picked === 2 ? "full" : ""}`}>{pickHint}</span>
        </div>

        <div className="ec-fams" role="group" aria-label="Anchor emotions">
          {families.map(({ family, emotions }) => (
            <div key={family}>
              <div className="ec-fam-name">{family}</div>
              <div className="ec-emo">
                {emotions.map(([id, e]) => {
                  const on = primary === id || secondary === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={on}
                      title={e.label}
                      className={`ec-emo-chip ${on ? "active" : ""} ${primary === id ? "primary" : ""}`}
                      style={{ "--emo-c": e.color }}
                      onClick={() => toggleEmotion(id)}
                    >
                      <span className="ec-emo-swatch" />
                      {(e.name || id).toLowerCase()}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* This was a choice between "community" and "public — anyone with the
            link". There is no such link: every echo route requires a signed-in
            user, and `/echoes` renders the landing page to anyone who isn't, so
            a logged-out visitor has no URL that could show them an echo. The two
            options selected the same audience. A statement of who actually sees
            it beats a question with one real answer. */}
        <div className="ec-vis-block">
          <div className="ec-label">who sees this</div>
          <p className="ec-vis-note">
            Every signed-in reader, in one shared room. Nobody outside Bibliome can reach it.
          </p>
        </div>

        {error && <div className="ec-error" role="alert" aria-live="assertive">{error}</div>}

        <div className="ec-footer">
          <button className="ec-cancel" onClick={onClose} disabled={busy}>cancel</button>
          <button className="btn brass" onClick={submit} disabled={!body.trim() || busy}>
            {busy ? "posting…" : "post echo"}
          </button>
        </div>
      </div>
    </div>
  );
}
