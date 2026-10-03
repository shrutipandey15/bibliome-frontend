import { momentLine, monthLabel } from "./aliveCopy";

const dayLabel = (iso) => `${Number(iso.slice(8, 10))} ${monthLabel(iso, { year: true }).replace(/^(\w{3})\w*/, "$1")}`;

/**
 * Moments: dated firsts from the reader's own shelf. [DNA Aliveness · F4]
 *
 * A feeling tagged for the first time after many books, one coming back after a
 * long absence, the book that completed every feeling. Rare by threshold (about
 * one save in eight), never pushed, never counted toward anything.
 */
export default function Moments({ moments }) {
  if (!moments?.length) return null;
  return (
    <section className="dna-moments" aria-labelledby="dna-moments-title">
      <h2 id="dna-moments-title" className="dna-section-label">Moments</h2>
      <ul className="dna-moments-list">
        {moments.map((m) => (
          <li key={`${m.kind}-${m.emotion}-${m.entry_id}`} className="dna-moment">
            <span className="dna-moment-date">{dayLabel(m.date)}</span>
            <span className="dna-moment-what">{momentLine(m)}</span>
            {m.title && <span className="dna-moment-book">{m.title}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
