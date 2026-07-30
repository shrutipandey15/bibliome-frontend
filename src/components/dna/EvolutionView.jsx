import { EMOTIONS } from "../../services/emotions";

/**
 * The evolution view — the return mechanic. [F7.3]
 *
 * The insight is THE GAP between who you've been (the enduring, unweighted profile)
 * and who you've been lately (the recency-weighted current profile). Drift must be
 * legible in one second. Charts always carry a TEXT EQUIVALENT — the shift is never
 * conveyed by shape or colour alone. [F7.8]
 *
 * Data is the backend's `profiles.{enduring,current}` frequency vectors plus a
 * scalar `drift` (0..1). We describe the shift factually; we do not author insight prose.
 */
// Word form for inline prose ("you read toward devastation"), not the phrase.
const emoLabel = (slug) => EMOTIONS[slug]?.name?.toLowerCase() || slug;
const emoColor = (slug) => EMOTIONS[slug]?.color || "var(--ink)";

const DRIFT_VISIBLE = 0.1; // below this the profiles are effectively steady

function topSlug(vec) {
  let best = null, bestW = 0;
  for (const [slug, w] of Object.entries(vec || {})) {
    if (w > bestW) { best = slug; bestW = w; }
  }
  return best;
}

function rows(vec, cap = 4) {
  const total = Object.values(vec || {}).reduce((s, w) => s + w, 0) || 1;
  return Object.entries(vec || {})
    .filter(([, w]) => w > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, cap)
    .map(([slug, w]) => ({ slug, pct: Math.round((w / total) * 100) }));
}

// A ranked composition, set as type rather than drawn as a bar: emotion + share,
// one per line. The number carries the meaning, so nothing depends on colour or
// on a length the eye has to estimate. [F-DNA-9]
function Composition({ vec }) {
  const parts = rows(vec);
  if (!parts.length) return <p className="evo-comp-empty">—</p>;
  return (
    <ul className="evo-comp-list">
      {parts.map((p) => (
        <li key={p.slug} className="evo-comp-row">
          <span className="evo-comp-name" style={{ color: emoColor(p.slug) }}>{emoLabel(p.slug)}</span>
          <span className="evo-comp-leader" aria-hidden="true" />
          <span className="evo-comp-pct">{p.pct}%</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * `snapshotCount` comes from GET /dna/evolution, not from the profile payload —
 * the engine keeps `has_two_snapshots` inside its own signal context. Fewer than
 * two snapshots means no recorded history to compare against, which is a
 * genuinely different statement from "compared, and you haven't moved". We say
 * which one it is rather than letting a steady reading stand in for both. [F-DNA-4]
 */
export default function EvolutionView({ profiles, drift = 0, snapshotCount = null }) {
  const enduring = profiles?.enduring;
  const current = profiles?.current;
  if (!enduring && !current) return null;

  const fromTop = topSlug(enduring);
  const toTop = topSlug(current);
  const moved = drift >= DRIFT_VISIBLE && fromTop && toTop && fromTop !== toTop;
  // null = we never looked; only a real count of <2 means "no history".
  const noHistory = snapshotCount != null && snapshotCount < 2;

  return (
    <section className="evo" aria-labelledby="evo-title">
      <h2 id="evo-title" className="dna-section-label">
        <span className="dna-numeral">II</span> What has changed
      </h2>

      {noHistory && !moved ? (
        <p className="evo-drift-summary evo-drift-summary--none">
          Not enough history yet — your reading has only been recorded once.
          Check back after more books, and this will show what moved.
        </p>
      ) : moved ? (
        <div className="evo-drift">
          <div className="evo-drift-arrow">
            <span className="evo-drift-from" style={{ color: emoColor(fromTop) }}>{emoLabel(fromTop)}</span>
            <span className="evo-drift-mark" aria-hidden="true">→</span>
            <span className="evo-drift-to" style={{ color: emoColor(toTop) }}>{emoLabel(toTop)}</span>
          </div>
          {/* The text equivalent — the shift stated plainly, from the data. [F7.8] */}
          <p className="evo-drift-summary">
            Enduringly, you read toward {emoLabel(fromTop)}. Lately, {emoLabel(toTop)}.
          </p>
        </div>
      ) : (
        <p className="evo-drift-summary">
          {toTop ? <>Steady — still {emoLabel(toTop)}.</> : "Not enough movement to read yet."}
        </p>
      )}

      {/* The gap IS the insight: enduring vs. lately, contrasted. Both columns are
          weightings of the shelf you have now, so they are real with or without
          snapshot history. */}
      <div className="evo-gap">
        <div className="evo-gap-col">
          <div className="evo-gap-when">then</div>
          <div className="evo-gap-name" style={fromTop ? { color: emoColor(fromTop) } : undefined}>
            {fromTop ? emoLabel(fromTop) : "—"}
          </div>
          <div className="label-sm">across everything you've logged</div>
          <Composition vec={enduring} />
        </div>
        <div className="evo-gap-col">
          <div className="evo-gap-when">now</div>
          <div className="evo-gap-name" style={toTop ? { color: emoColor(toTop) } : undefined}>
            {toTop ? emoLabel(toTop) : "—"}
          </div>
          <div className="label-sm">weighted toward what you've read lately</div>
          <Composition vec={current} />
        </div>
      </div>
    </section>
  );
}
