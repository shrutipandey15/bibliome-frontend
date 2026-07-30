/**
 * "Not yet" — the honest curiosity gap. [F7.4]
 *
 * Some insights genuinely cannot be computed yet (seasonality needs 12 months of
 * reading). We show them locked, WITH the real reason the backend gives. The
 * honesty is the hook — we never obscure the requirement to manufacture mystery,
 * and there are no countdowns or progress bars implying urgency.
 *
 * Backend shape per row: { category, unlocks_at, reason }.
 */
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const nameFor = (l) => cap(String(l.category || "").replace(/_/g, " "));

export default function LockedInsights({ locked = [] }) {
  if (!locked.length) return null;
  return (
    <section className="dna-locked" aria-labelledby="dna-locked-title">
      <h2 id="dna-locked-title" className="dna-section-label">Not yet</h2>
      {/* Set as a run of quiet italic lines rather than a list of chips — this is
          a footnote about what the page cannot say, not a menu of things to earn.
          The requirement text is the backend's own `reason`; we add no countdown
          and no "you are N short", because the payload carries no such figure. */}
      <ul className="dna-locked-list">
        {locked.map((l) => (
          <li key={l.category} className="dna-locked-row">
            <span className="dna-locked-name">{nameFor(l)}</span>
            {" waits on "}
            {l.reason
              ? l.reason.replace(/^needs\s+/i, "")
              : (l.unlocks_at || "more reading")}
            .
          </li>
        ))}
      </ul>
    </section>
  );
}
