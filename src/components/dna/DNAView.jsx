import { useState, useEffect } from "react";
import { EMOTIONS, EMO_LIST } from "../../services/emotions";
import DNACard from "../DNACard";
import DNAGate from "./DNAGate";
import Insight from "./Insight";
import EvolutionView from "./EvolutionView";
import { MIN_BOOKS } from "./constants";
import useIsNarrow from "../../hooks/useIsNarrow";
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

  // Collapsible on phone, where 18 rows is real scroll — but OPEN on every
  // mount. The blanks are the whole argument of this section ("the blank IS
  // the blind spot, made visible" — see the block comment above), so nothing
  // here may load pre-hidden; a reader can only ever close what they've
  // already been shown. No separate toggle: the heading itself is the
  // <summary>, so there's one clickable thing, not a heading plus a button
  // beside it. Desktop renders the plain heading it always has — the section
  // already fits without help there, so it gains no click target it didn't
  // have before.
  const narrow = useIsNarrow();
  const [open, setOpen] = useState(true);
  useEffect(() => { if (!narrow) setOpen(true); }, [narrow]);

  const heading = (
    <h2 id="dna-portrait-title" className="dna-section-label">
      <span className="dna-numeral">III</span> The shape of you
    </h2>
  );

  const list = (
    <>
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
        {hasCounts ? " · figures are book counts" : " · figures are shares of your recent reading"}.
        The blanks are the feelings you've never once recorded.
      </p>
    </>
  );

  return (
    <section className="dna-portrait" aria-labelledby="dna-portrait-title">
      {narrow ? (
        <details
          className="dna-portrait-fold"
          open={open}
          onToggle={(e) => setOpen(e.currentTarget.open)}
        >
          {/* A heading as a <summary>'s sole child keeps its accessible name —
              screen readers announce it as both the disclosure control and the
              section heading, rather than losing the numeral/label to a plain
              clickable div. */}
          <summary className="dna-portrait-fold-summary">
            {heading}
            <span className="dna-portrait-fold-chev" aria-hidden="true">⌄</span>
          </summary>
          {list}
        </details>
      ) : (
        <>
          {heading}
          {list}
        </>
      )}
    </section>
  );
}

// The section rule between movements. Decorative only — the headings carry the
// structure for anything that isn't looking at the page.
const Divider = () => <div className="dna-divider" aria-hidden="true">◆ ◆ ◆</div>;

export default function DNAView({ profile, username, onSave, onEditReadFor, cardRef, bookCount = 0, stats = null }) {
  const count = profile?.book_count ?? bookCount;
  const needed = profile?.needed ?? MIN_BOOKS;
  // The mirror auto-computes on read; `enough` is the honest gate. Present
  // insights still count as enough, so a stale cache never hides real data — but
  // `archetype` no longer does: it can legitimately be null on an `enough: true`
  // payload now (the engine is allowed to abstain), and treating it as the signal
  // would have flipped the gate the wrong way for a reader with nothing to name.
  const enough = profile?.enough === true || !!(profile?.insights?.length);

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
  //
  // The fingerprint is drawn from `stats.emotion_counts` — REAL books per
  // register off this reader's shelf. `profiles.current` is a weighted recency
  // vector: right for "who you've been lately", wrong for a bar chart, because
  // its numbers are shares scaled to 100 and would draw the same silhouette for
  // a reader with six books as for one with six hundred. It stays only as the
  // fallback for the moment before the stats ledger lands.
  const cardProfile = arch && {
    archetype: arch,
    book_count: count,
    emotion_counts: stats?.emotion_counts || null,
    archetype_share: profile.archetype_share,
    // What the label was nearly instead, and the counts that earn it. `margin` is
    // not passed: the card reads the hedge off `runner_up`'s presence rather than
    // re-deriving it from the number, so handing it over would be a dead prop.
    runner_up: profile.runner_up,
    basis: profile.basis,
    top_emotions: vectorRows(profile.profiles?.current, 5)
      .map((r) => ({ emotion_id: r.slug, count: Math.round(r.weight * 100) })),
  };

  const narrow = useIsNarrow();
  const archetypeBody = !arch ? (
    <p className="dna-arch-none">
      Not enough tagged books to name a shorthand yet. The findings above
      are still yours — the label is the one thing that needs a clear
      favourite, and yours is still a tie.
    </p>
  ) : (
    <DNACard
      ref={cardRef}
      profile={cardProfile}
      username={username}
      size="small"
      allowShare
      onSave={onSave}
      showDescription={false}
      footer={arch.description && <p className="dna-arch-desc">{arch.description}</p>}
    />
  );
  const archetypeHeading = (
    <h2 id="dna-arch-title" className="dna-section-label">
      <span className="dna-numeral">V</span> The shorthand
    </h2>
  );

  const evolution = (
    <EvolutionView profiles={profile.profiles} drift={profile.drift} snapshotCount={snapshotCount} />
  );
  const portrait = (
    <Portrait
      counts={stats?.emotion_counts}
      current={profile.profiles?.current}
      blindSpots={arch?.blind_spots}
    />
  );

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
          {narrow ? (
            <>
              {portrait}
              <Divider />
              {evolution}
            </>
          ) : (
            <>
              {evolution}
              <Divider />
              {portrait}
            </>
          )}

          <Divider />

          {/* V, IN FLOW — phone only. See `archetypeBody` above for why. */}
          {narrow && (
            <>
              <Divider />
              <section aria-labelledby="dna-arch-title">
                {archetypeHeading}
                {archetypeBody}
              </section>
            </>
          )}

          {/* IV — OTHER FINDINGS, ranked by surprise. Basis on every one. [F7.2]
              Its own Divider, rather than a border baked into `.dna-more` —
              every section boundary on this page is one or the other, never
              both, so nothing downstream can end up sitting between two
              separators a `gap` apart. */}
          {rest.length > 0 && (
            <>
              <Divider />
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
            </>
          )}

          {/* What's still locked lives in the Register fold directly below this
              view (App's DNA tab) — one ledger, earned and not-yet together,
              instead of a "NOT YET" list here and a milestones list on the
              profile. This view keeps only what it can say today. */}
        </div>

        {!narrow && (
          <aside className="dna-aside" aria-labelledby="dna-arch-title">
            {archetypeHeading}
            {/* No archetype is a real answer, not a loading state: past the gate,
                the reader's tally can still name nobody. Saying so is the whole
                point — the alternative is the label the engine used to hand out
                by list order to anyone who had tagged nothing. */}
            {archetypeBody}
          </aside>
        )}
      </div>
    </div>
  );
}
