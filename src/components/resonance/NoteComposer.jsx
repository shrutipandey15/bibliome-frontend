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
  placeholder = "One thing about this book you can't say to anyone who hasn't read it.",
  submitLabel = "Leave the note",
  hint = "They see this only if they answer. Nobody else ever does.",
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
      {error && <p className="res-composer-error" role="alert">{error}</p>}
      {/* The hint moved down here, into the foot rule: it is a condition on the
          send, so it belongs beside the button rather than between the reader
          and the field they are still typing in. */}
      <div className="res-composer-foot">
        <span className="res-composer-hint">{hint}</span>
        <div className="res-composer-actions">
          {/* Only shown as it gets close — a counter ticking from 0 turns a note
              into a form field. */}
          <span className={`res-composer-count ${over ? "over" : ""}`}>
            {note.length > MAX_NOTE - 100 ? `${MAX_NOTE - note.length}` : ""}
          </span>
          <button className="rm-quiet" onClick={onCancel} disabled={busy}>never mind</button>
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
