/**
 * A single insight. [F7.2 / F7.5]
 *
 * Voice: the prose comes verbatim from hand-written backend templates filled with
 * hard data — we render `text`, we never generate or decorate it. Every insight
 * shows its BASIS ("from N books", where N is `insight.n`); the receipts are what
 * make the verdict believable. The headline insight (highest surprise) is rendered
 * larger, but it is the same shape — no special copy.
 */
export default function Insight({ insight, headline = false, statedFor = [] }) {
  if (!insight) return null;
  const n = insight.n;
  // The headline also names what the reader SAID they read for, because the
  // strongest insight class is the contradiction between that and the shelf —
  // showing both halves is what makes the claim checkable rather than clever.
  const stated = headline && statedFor.length > 0 ? statedFor.join(", ") : null;
  return (
    <div className={`insight ${headline ? "insight--headline" : ""}`}>
      <p className="insight-text">{insight.text}</p>
      {n != null && (
        <div className="insight-foot">
          <span className="insight-basis">
            from {n} {n === 1 ? "book" : "books"}
            {stated && ` · you told me: ${stated}`}
          </span>
        </div>
      )}
    </div>
  );
}
