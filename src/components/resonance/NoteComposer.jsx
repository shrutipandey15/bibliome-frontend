import { useState } from "react";

/**
 * The opening note. One field, one button.
 *
 * Sealed by the server: the other reader is told only that someone who felt the
 * same way reached out, and can read this after they answer. That's what makes
 * it safe to write honestly, so the helper line says so plainly.
 */
const MAX_NOTE = 500; // matches resonance_service.MAX_NOTE_CHARS

export default function NoteComposer({
  onSubmit,
  onCancel,
  busy,
  error,
  placeholder = "What did this book do to you?",
  submitLabel = "Leave the note",
  hint = "Only they will read this, and only if they write back. Nobody else ever sees it.",
}) {
  const [note, setNote] = useState("");
  const trimmed = note.trim();
  const over = note.length > MAX_NOTE;

  return (
    <div className="res-composer">
      <textarea
        className="res-composer-field"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={placeholder}
        rows={4}
        maxLength={MAX_NOTE + 40} /* soft stop, so the counter can go red first */
        autoFocus
        aria-label="Your note"
      />
      <p className="res-composer-hint">{hint}</p>
      {error && <p className="res-composer-error" role="alert">{error}</p>}
      <div className="res-composer-foot">
        {/* Only shown as it gets close — a counter ticking from 0 turns a note
            into a form field. */}
        <span className={`res-composer-count ${over ? "over" : ""}`}>
          {note.length > MAX_NOTE - 100 ? `${MAX_NOTE - note.length}` : ""}
        </span>
        <div className="res-composer-actions">
          <button className="btn ghost" onClick={onCancel} disabled={busy}>never mind</button>
          <button
            className="btn brass"
            onClick={() => onSubmit(trimmed)}
            disabled={!trimmed || over || busy}
          >
            {busy ? "sending…" : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
