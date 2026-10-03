import { useState } from "react";
import { EMO_LIST } from "../../services/emotions";
import { MAX_READ_FOR } from "./constants";

/**
 * "What do you read for?" — asked once at onboarding, editable later in settings. [F7.7]
 *
 * This single question unlocks the best insight class: STATED vs. REVEALED
 * ("you said comfort; your shelf says heartbreak"). The stated preference is
 * 1–2 canonical emotions (B7.1), so we pick from the shared vocabulary — recognition,
 * not free text. Light and skippable, but we say WHY we ask, because people answer
 * honestly when they know the purpose.
 */
export default function ReadForQuestion({ value = [], onSave, onSkip, saving = false, embedded = false }) {
  const [picked, setPicked] = useState(() => value.slice(0, MAX_READ_FOR));
  const [error, setError] = useState("");

  const toggle = (slug) => {
    setError("");
    setPicked((cur) => {
      if (cur.includes(slug)) return cur.filter((x) => x !== slug);
      if (cur.length >= MAX_READ_FOR) return cur; // cap at two
      return [...cur, slug];
    });
  };

  const save = async () => {
    try { await onSave?.(picked); }
    catch (err) { setError(err.message || "Couldn't save that"); }
  };

  return (
    <section className={`readfor ${embedded ? "readfor--embedded" : ""}`} aria-labelledby="readfor-title">
      <h2 id="readfor-title" className="readfor-title">What do you read for?</h2>
      <p className="readfor-why">
        Pick one or two feelings. Later, this lets the app tell you something only it
        can: whether the feelings you reach for match the ones your shelf actually holds.
      </p>

      <div className="readfor-options" role="group" aria-label="What do you read for">
        {EMO_LIST.map(([slug, e]) => {
          const on = picked.includes(slug);
          const full = !on && picked.length >= MAX_READ_FOR;
          return (
            <button
              key={slug}
              type="button"
              className={`readfor-chip ${on ? "on" : ""}`}
              aria-pressed={on}
              disabled={full}
              style={{ "--chip-c": e.color }}
              onClick={() => toggle(slug)}
            >
              {e.name}
            </button>
          );
        })}
      </div>

      {error && <div className="readfor-error" role="alert">{error}</div>}

      <div className="readfor-actions">
        {onSkip && (
          <button type="button" className="readfor-skip" onClick={onSkip}>skip for now</button>
        )}
        <button type="button" className="btn brass" onClick={save} disabled={saving || picked.length === 0}>
          {saving ? "saving…" : "save"}
        </button>
      </div>
    </section>
  );
}
