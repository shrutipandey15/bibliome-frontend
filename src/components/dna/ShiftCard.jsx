import { useState } from "react";
import { markShiftSeen } from "../../services/api";
import { shiftCopy } from "./aliveCopy";

/**
 * "You've become a World-Diver." [DNA Aliveness · F5]
 *
 * The one change that gets a moment of its own. It shows on the DNA page once
 * per shift — the server flags it (`shift_unseen`) and forgets it once the
 * reader dismisses the card — so it is rare by construction: the archetype only
 * moves on a clear, repeated lead.
 */
export default function ShiftCard({ eras, onSeen }) {
  const [gone, setGone] = useState(false);
  const copy = shiftCopy(eras);
  if (!copy || gone) return null;
  const now = eras[0];
  const books = now.books_that_moved || [];

  const dismiss = async () => {
    setGone(true);
    try { await markShiftSeen(); } catch { /* shown again next visit; harmless */ }
    onSeen?.();
  };

  return (
    <section className="dna-shift" aria-labelledby="dna-shift-title" style={{ "--shift-c": now.color }}>
      <div className="dna-shift-glyph" aria-hidden="true">{now.glyph}</div>
      <h2 id="dna-shift-title" className="dna-shift-title">{copy.title}</h2>
      <p className="dna-shift-body">{copy.body}</p>
      {books.length > 0 && (
        <ul className="dna-shift-books">
          {books.map((b) => <li key={b.entry_id}>{b.title}</li>)}
        </ul>
      )}
      <p className="dna-shift-footer">{copy.footer}</p>
      <button type="button" className="btn dna-shift-ok" onClick={dismiss}>Got it</button>
    </section>
  );
}
