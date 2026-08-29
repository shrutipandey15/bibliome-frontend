import { MIN_BOOKS } from "./constants";

/**
 * The honest empty state, shown below the data gate. [F7.1]
 *
 * This is NOT a failure screen — it is anticipation, and the most trustworthy
 * thing the product ever says. We show the real count and the real requirement,
 * and NEVER fabricate an insight at low n. When the backend supplies its own
 * server-authored `message`, we lead with that; otherwise we render an honest
 * fallback from the count.
 */
const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven"];
const spell = (n) => (n >= 0 && n < WORDS.length ? WORDS[n] : String(n));
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export default function DNAGate({ bookCount = 0, minBooks = MIN_BOOKS, message }) {
  const remaining = Math.max(1, minBooks - bookCount);
  const bookWord = bookCount === 1 ? "book" : "books";

  return (
    <section className="dna-gate" aria-labelledby="dna-gate-title">
      <div className="dna-gate-glyph" aria-hidden="true">◈</div>
      <h1 id="dna-gate-title" className="dna-gate-head">
        {cap(spell(bookCount))} {bookWord} in.
      </h1>
      <p className="dna-gate-promise">
        {message || `The mirror needs ${spell(minBooks)} before it can say anything true about you. (Your raw counts are below — those work from book one.)`}
      </p>
      {!message && (
        <p className="dna-gate-sub">Log {spell(remaining)} more and it begins.</p>
      )}
      {/* A quiet promise, not a lockout — no countdown, no progress-urgency. */}
      <div className="dna-gate-note">
        Nothing here is invented. When there's enough to say something only true of
        <em> you</em>, it will appear — and not a book sooner.
      </div>
    </section>
  );
}
