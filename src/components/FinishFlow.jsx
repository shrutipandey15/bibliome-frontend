import { useState } from "react";
import { EMO_LIST } from "../services/emotions";
import "./FinishFlow.css";

/**
 * The Finish Flow — the product's signature interaction. [F2.2 / B2.2]
 *
 * A book doesn't land as one feeling; it moves. This captures the three-beat
 * emotional arc — how it felt at the START, the MIDDLE, and the END — plus a
 * short closing thought and a final intensity. Posts to /entries/{id}/finish.
 *
 * Rendered inside the accessible <Modal>, so focus-trap / Esc / restore are
 * handled by the wrapper.
 */

const BEATS = [
  { key: "start",  eyebrow: "the beginning", prompt: "How did it feel when you started?" },
  { key: "middle", eyebrow: "the middle",    prompt: "And in the thick of it?" },
  { key: "end",    eyebrow: "the last page",  prompt: "How did it leave you?" },
];

const MAX_THOUGHT = 120;

export default function FinishFlow({ entry, onFinish, onClose }) {
  const [step, setStep] = useState(0);
  const [arc, setArc] = useState({ start: null, middle: null, end: null });
  const [thought, setThought] = useState(entry?.finish_thought || "");
  const [intensity, setIntensity] = useState(entry?.intensity || 5);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const onArcStep = step < BEATS.length;
  const beat = BEATS[step];
  const chosen = onArcStep ? arc[beat.key] : null;

  const pick = (slug) => {
    setArc((prev) => ({ ...prev, [beat.key]: slug }));
  };

  const next = () => {
    if (onArcStep && !arc[beat.key]) return;
    setStep((s) => s + 1);
  };
  const back = () => setStep((s) => Math.max(0, s - 1));

  const submit = async () => {
    setError("");
    setSaving(true);
    try {
      await onFinish(entry.id, {
        start_emotion_slug: arc.start,
        middle_emotion_slug: arc.middle,
        end_emotion_slug: arc.end,
        thought: thought.trim() || null,
        intensity,
      });
      onClose();
    } catch (err) {
      setError(err.message || "Couldn't finish the book. Try again.");
      setSaving(false);
    }
  };

  return (
    <div className="ff">
      <div className="ff-head">
        <div className="label">finishing</div>
        <h2 className="ff-title">{entry?.title || "This book"}</h2>
        {/* Progress dots — one per beat plus the closing step */}
        <div className="ff-dots" aria-hidden="true">
          {[...BEATS, { key: "close" }].map((b, i) => (
            <span key={b.key} className={`ff-dot ${i === step ? "active" : ""} ${i < step ? "done" : ""}`} />
          ))}
        </div>
      </div>

      {onArcStep ? (
        <div className="ff-body" key={beat.key}>
          <div className="label-sm ff-eyebrow">{beat.eyebrow}</div>
          <p className="ff-prompt">{beat.prompt}</p>
          <div className="ff-emo-grid" role="radiogroup" aria-label={beat.prompt}>
            {EMO_LIST.map(([id, e]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={chosen === id}
                className={`ff-emo ${chosen === id ? "active" : ""}`}
                style={{ "--emo-c": e.color }}
                onClick={() => pick(id)}
              >
                <span className="ff-emo-swatch" />
                {e.label.toLowerCase()}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="ff-body">
          <div className="label-sm ff-eyebrow">the last word</div>
          <p className="ff-prompt">Anything you want to remember?</p>
          <textarea
            className="ff-thought"
            placeholder="One line — the true thing, not the clever thing…"
            value={thought}
            maxLength={MAX_THOUGHT}
            onChange={(e) => setThought(e.target.value)}
            rows={2}
          />
          <div className="ff-count">{thought.length}/{MAX_THOUGHT}</div>

          <div className="ff-int">
            <div className="label-sm">final intensity · {intensity}/10</div>
            <input
              type="range"
              min="1"
              max="10"
              value={intensity}
              onChange={(e) => setIntensity(+e.target.value)}
              aria-label="Final intensity"
            />
          </div>

          {error && <div className="ff-error" role="alert" aria-live="assertive">{error}</div>}
        </div>
      )}

      <div className="ff-footer">
        <button className="btn ghost" onClick={step === 0 ? onClose : back} disabled={saving}>
          {step === 0 ? "cancel" : "← back"}
        </button>
        {onArcStep ? (
          <button className="btn brass" onClick={next} disabled={!arc[beat.key]}>
            continue
          </button>
        ) : (
          <button className="btn brass" onClick={submit} disabled={saving}>
            {saving ? "shelving…" : "finish the book"}
          </button>
        )}
      </div>
    </div>
  );
}
