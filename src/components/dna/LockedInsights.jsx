/**
 * "Not yet" — the honest curiosity gap. [F7.4]
 *
 * Some insights genuinely cannot be computed yet. We show them locked, WITH the
 * real reason the backend gives, and — crucially — against the reader's own count
 * toward that specific requirement. None of these gates count titles on the shelf:
 * they count tagged books, or books finished through the arc flow, or books put
 * down with a reason. So a reader with 6 books shelved can still see "waits on 10
 * books with a feeling tagged (you have 2)", and the "why is this still locked?"
 * question answers itself instead of reading like a bug.
 *
 * Backend shape per row: { category, unlocks_at, reason, have, need }.
 * `have` is null for the one time-gated insight (seasonality), where a count would
 * wrongly imply "log this many more and it opens".
 */
const NAME_OVERRIDE = { dnf_reason: "DNF reason" };
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const nameFor = (l) =>
  NAME_OVERRIDE[l.category] || cap(String(l.category || "").replace(/_/g, " "));

export default function LockedInsights({ locked = [] }) {
  if (!locked.length) return null;
  return (
    <section className="dna-locked" aria-labelledby="dna-locked-title">
      <h2 id="dna-locked-title" className="dna-section-label">Not yet</h2>
      {/* A run of quiet italic lines, not a menu of things to earn. The
          requirement text is the backend's own `reason`; the only thing we add is
          the reader's current count against it, which the backend supplies as
          `have` — no "you are N short", no progress bar, no urgency. */}
      <ul className="dna-locked-list">
        {locked.map((l) => (
          <li key={l.category} className="dna-locked-row">
            <span className="dna-locked-name">{nameFor(l)}</span>
            {" waits on "}
            {/* Strip a leading "needs " — new payloads don't have it, but one
                cached before this copy changed still does. */}
            {(l.reason || l.unlocks_at || "more reading").replace(/^needs\s+/i, "")}
            {Number.isFinite(l.have) && (
              <span className="dna-locked-have"> (you have {l.have})</span>
            )}
            .
          </li>
        ))}
      </ul>
    </section>
  );
}
