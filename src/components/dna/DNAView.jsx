import { EMOTIONS, EMO_LIST } from "../../services/emotions";
import DNACard from "../DNACard";
import DNAGate from "./DNAGate";
import Insight from "./Insight";
import EvolutionView from "./EvolutionView";
import LockedInsights from "./LockedInsights";
import { MIN_BOOKS } from "./constants";
import "./DNAView.css";

/**
 * The DNA / Insight view. [Phase 7]
 *
 * Renders the backend's private "v2" mirror (app/services/dna_insights.build_dna):
 * gate on `enough`, then most-specific-first — insights, evolution, the shape of
 * you, and the archetype DEMOTED to a shorthand at the bottom. NO mystical framing;
 * facts with their receipts. All prose is server-templated — we render, never author.
 */

// Analytics/prose surfaces use the plain word ("devastation"), which reads
// grammatically inline ("you read toward devastation"); the first-person phrase
// is for the tagging surfaces. [VISION §4 — `name` is the single-word form.]
const emoLabel = (slug) => EMOTIONS[slug]?.name?.toLowerCase() || slug;
const emoColor = (slug) => EMOTIONS[slug]?.color || "var(--ink)";

// Turn a { slug: weight } frequency vector into a sorted, capped list.
function vectorRows(vec, cap = 6) {
  return Object.entries(vec || {})
    .filter(([, w]) => w > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, cap)
    .map(([slug, weight]) => ({ slug, weight }));
}

// THE SHAPE OF YOU — the composition portrait (recency-weighted), not the label.
//
// EVERY canonical emotion is listed, in the vocabulary's own declaration order —
// including the ones this reader has never reached for, which render as a blank
// (—). The blank IS the blind spot, made visible; omitting the untagged rows
// would hide the most interesting thing on the page. [F-DNA-3]
//
// Leader dots, not bars: an index page, not a dashboard. The figure is printed on
// every row, so meaning never rides on colour or length alone. The vocabulary comes
// from EMO_LIST (seeded, then hydrated from GET /emotions) — never a hardcoded list
// here. [F-DNA-9 / F7.8]
//
// The figure is a BOOK COUNT (`stats.emotion_counts`), not a share of the recency-
// weighted vector: "16" is a fact the reader can go and verify on their own shelf,
// where "23%" of a half-life-decayed float is not. Rows sort by that count, with
// the never-reached falling to the bottom in vocabulary order.
//
// `blindSpots` are the archetype's named gaps; a blank that is also one of those is
// marked, because it is the one the rest of the page is arguing about.
function Portrait({ counts, current, blindSpots = [] }) {
  const tally = counts || {};
  const vec = current || {};
  const hasCounts = Object.keys(tally).length > 0;
  // Fall back to the weighted vector only if the counts ledger hasn't loaded, so
  // the section still renders (with shares) rather than vanishing.
  const value = (slug) => (hasCounts ? tally[slug] || 0 : Math.round((vec[slug] || 0) * 100));

  const rows = EMO_LIST
    .map(([slug]) => ({ slug, n: value(slug) }))
    .sort((a, b) => b.n - a.n);
  const reached = rows.filter((r) => r.n > 0).length;
  if (!reached) return null;
  const flagged = new Set(blindSpots);

  return (
    <section className="dna-portrait" aria-labelledby="dna-portrait-title">
      <h2 id="dna-portrait-title" className="dna-section-label">
        <span className="dna-numeral">III</span> The shape of you
      </h2>
      <ul className="dna-portrait-list">
        {rows.map((r) => {
          const untouched = r.n <= 0;
          const marked = untouched && flagged.has(r.slug);
          return (
            <li
              key={r.slug}
              className={[
                "dna-portrait-row",
                untouched ? "dna-portrait-row--blank" : "",
                marked ? "dna-portrait-row--flagged" : "",
              ].filter(Boolean).join(" ")}
            >
              {/* Filled lozenge for reached, hollow for never — redundant with the
                  figure and the italics, never the sole carrier of meaning. */}
              <span
                className="dna-portrait-mark"
                aria-hidden="true"
                style={untouched ? undefined : { color: emoColor(r.slug) }}
              >
                {untouched ? "◇" : "◆"}
              </span>
              <span className="dna-portrait-name">{emoLabel(r.slug)}</span>
              <span className="dna-portrait-leader" aria-hidden="true" />
              <span className="dna-portrait-count">{untouched ? "—" : r.n}</span>
            </li>
          );
        })}
      </ul>
      <p className="dna-portrait-note">
        {reached} of {rows.length} reached for
        {hasCounts ? " · figures are books" : " · figures are shares of your recent reading"}.
        The blanks are the ones you never have.
      </p>
    </section>
  );
}

// The section rule between movements. Decorative only — the headings carry the
// structure for anything that isn't looking at the page.
const Divider = () => <div className="dna-divider" aria-hidden="true">◆ ◆ ◆</div>;

export default function DNAView({ profile, username, onSave, onEditReadFor, cardRef, bookCount = 0, stats = null }) {
  const count = profile?.book_count ?? bookCount;
  const needed = profile?.needed ?? MIN_BOOKS;
  // The mirror auto-computes on read; `enough` is the honest gate. Treat present
  // content as enough too, so a stale cache never hides real data.
  const enough = profile?.enough === true || !!(profile?.insights?.length) || !!profile?.archetype;

  // Snapshot history for "what's changed" now rides along on the profile payload
  // (B: `snapshot_count`/`has_two_snapshots`, present on BOTH branches), so this
  // no longer costs a second request. Undefined on a payload cached before the
  // field existed — left as null in that case so the section says nothing rather
  // than wrongly claiming "no history". [F-DNA-4]
  const snapshotCount = profile?.snapshot_count ?? null;

  // Below the gate — the honest empty state. NEVER a fabricated insight. [F7.1]
  if (!enough) {
    return <DNAGate bookCount={count} minBooks={needed} message={profile?.message} />;
  }

  const insights = profile.insights || [];        // already ranked by surprise (backend)
  const [headline, ...rest] = insights;
  const readFor = profile.reads_for || [];
  const arch = profile.archetype;
  // From the stats ledger, which the DNA tab already loads for the patterns
  // section. Absent until it lands — the running head just omits it.
  const avgIntensity = stats?.avg_intensity ?? null;

  // The shareable card uses the legacy signature shape; adapt the v2 payload for it.
  const cardProfile = arch && {
    personality: arch,
    book_count: count,
    top_emotions: vectorRows(profile.profiles?.current, 5)
      .map((r) => ({ emotion_id: r.slug, count: Math.round(r.weight * 100) })),
  };

  return (
    <div className="dna-view">
      {/* Running head — the volume line, set like a page header rather than a
          stat card. Intensity only appears once the ledger has loaded. */}
      <header className="dna-runhead">
        <span>Your DNA</span>
        <span>
          {count} {count === 1 ? "volume" : "volumes"}
          {avgIntensity != null && ` · avg intensity ${avgIntensity}`}
        </span>
      </header>

      {readFor.length > 0 ? (
        <p className="dna-readfor-line">
          you read for {readFor.map(emoLabel).join(" and ")}
          {onEditReadFor && <button className="dna-readfor-edit" onClick={onEditReadFor}>edit</button>}
        </p>
      ) : onEditReadFor && (
        <p className="dna-readfor-line">
          <button className="dna-readfor-edit" onClick={onEditReadFor}>tell us what you read for →</button>
        </p>
      )}

      {/* The page is two columns: the argument, and the thing it argues toward.
          Sections I–IV are read top to bottom; the shorthand is a plate that
          stays beside them, because it is the summary of everything in the left
          column and reading the evidence with the conclusion in view is the
          whole point of the layout. */}
      <div className="dna-body">
        <div className="dna-col">

          {/* I — THE HEADLINE INSIGHT. Lead with the strongest, most specific thing.
              aria-live announces it without stealing focus. [F7.2 / F7.8] */}
          {headline && (
            <section className="dna-headline" aria-labelledby="dna-reading-title" aria-live="polite">
              <h2 id="dna-reading-title" className="dna-section-label">
                <span className="dna-numeral">I</span> What your reading says
              </h2>
              <Insight insight={headline} headline statedFor={readFor.map(emoLabel)} />
            </section>
          )}

          <Divider />

          {/* II — WHAT'S CHANGED. The return mechanic. [F7.3] */}
          <EvolutionView profiles={profile.profiles} drift={profile.drift} snapshotCount={snapshotCount} />

          <Divider />

          {/* III — THE SHAPE OF YOU. The fingerprint, not the label. */}
          <Portrait
            counts={stats?.emotion_counts}
            current={profile.profiles?.current}
            blindSpots={arch?.blind_spots}
          />

          <Divider />

          {/* IV — OTHER FINDINGS, ranked by surprise. Basis on every one. [F7.2] */}
          {rest.length > 0 && (
            <section className="dna-more" aria-labelledby="dna-more-title">
              <h2 id="dna-more-title" className="dna-section-label">
                <span className="dna-numeral">IV</span> Other findings
              </h2>
              <ul className="dna-more-list">
                {rest.map((i) => (
                  <li key={`${i.category}-${i.variant}`}><Insight insight={i} /></li>
                ))}
              </ul>
            </section>
          )}

          {/* NOT YET — locked, WITH the real reason. [F7.4] */}
          <LockedInsights locked={profile.locked} />
        </div>

        {/* V — THE SHORTHAND. Still demoted in the argument (it is the label,
            not the finding) but no longer hidden behind a toggle: it is the one
            thing here anybody wants to keep, and it was being rendered
            off-screen purely so `onSave` could rasterise it. */}
        {arch && (
          <aside className="dna-aside" aria-labelledby="dna-arch-title">
            <h2 id="dna-arch-title" className="dna-section-label">
              <span className="dna-numeral">V</span> The shorthand
            </h2>
            <DNACard
              ref={cardRef}
              profile={cardProfile}
              username={username}
              size="small"
              allowShare
              onSave={onSave}
              /* The plate is already dense; on this page the description has a
                 column to live in underneath it. */
              showDescription={false}
              footer={arch.description && <p className="dna-arch-desc">{arch.description}</p>}
            />
          </aside>
        )}
      </div>
    </div>
  );
}
