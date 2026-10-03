import { useState, useEffect } from "react";
import { EMOTIONS, EMO_LIST } from "../../services/emotions";
import DNACard from "../DNACard";
import BasisLine from "../card/BasisLine";
import ShareSheet from "../card/ShareSheet";
import { applyChoices, seasonJustTurned } from "../card/cardModel";
import DNAGate from "./DNAGate";
import Insight from "./Insight";
import EvolutionView from "./EvolutionView";
import Moments from "./Moments";
import ShiftCard from "./ShiftCard";
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

// Analytics/prose surfaces use the plain word ("heartbreak"), which reads
// grammatically inline ("you read toward heartbreak"); the first-person phrase
// is for the tagging surfaces. [VISION §4 — `name` is the single-word form.]
const emoLabel = (slug) => EMOTIONS[slug]?.name?.toLowerCase() || slug;
const emoColor = (slug) => EMOTIONS[slug]?.color || "var(--ink)";

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
    <h2 id="dna-portrait-title" className="dna-section-label">The shape of you</h2>
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

export default function DNAView({ profile, onEditReadFor, bookCount = 0, stats = null, onShiftSeen }) {
  // Which format the share sheet opened on, or null while it's closed.
  const [sharing, setSharing] = useState(null);
  // The switches as the reader last left them in the sheet, until the profile
  // is next fetched — the card here shows what strangers see.
  const [choices, setChoices] = useState(null);
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

  // The card is the backend's own card payload (dna_card), merged onto this
  // profile by the /dna/profile route: the same bloom, numbers and lines the
  // posted image, the profile page and the share link draw. The owner's copy
  // carries their two switches, and the card here shows what strangers see.
  const card = profile.card ? { ...profile.card, choices: choices || profile.card.choices } : null;
  const turned = seasonJustTurned(applyChoices(card), profile.seasons);

  const archetypeBody = !arch ? (
    <p className="dna-arch-none">
      Not enough tagged books to name a shorthand yet. The findings above
      are still yours — the label is the one thing that needs a clear
      favourite, and yours is still a tie.
    </p>
  ) : card && (
    <DNACard card={card}>
      <div className="dnacard-actions">
        <button type="button" className="dnacard-share" onClick={() => setSharing("story")}>
          Share my card
        </button>
      </div>
      {/* The season moment: one line, no push. Opens the sheet on the season
          story, the re-share. */}
      {turned && (
        <button type="button" className="dnacard-season-turned" onClick={() => setSharing("season")}>
          Your season turned — new card ready
        </button>
      )}
      {/* The receipt. The name is a headline for a number the reader can go and
          check against their own shelf. */}
      <BasisLine basis={profile.basis} />
      {arch.description && <p className="dna-arch-desc">{arch.description}</p>}
    </DNACard>
  );
  const evolution = (
    <EvolutionView
      profiles={profile.profiles} drift={profile.drift} snapshotCount={snapshotCount}
      seasons={profile.seasons} eras={profile.eras}
    />
  );
  const portrait = (
    <Portrait
      // Same tally the card's fingerprint draws, off THIS payload — not
      // `stats.emotion_counts`, which rides the separately-cached /dna/stats
      // call that is only fetched when the Patterns section is opened. A reader
      // who never left "the read" had no counts to show, so this section
      // silently fell back to percentage shares of the recency vector.
      counts={profile.emotion_counts}
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

      {/* Two columns: the argument on the left, the shorthand it argues toward
          on the right. The card follows the reader down the evidence (sticky)
          rather than sitting at the end of it. Headings carry the structure —
          each section is marked by a brass rule + label (no more Roman numerals,
          no ◆ ◆ ◆); the label carries the boundary, so there's no separate
          hairline fighting it. */}
      <div className="dna-body">
        <div className="dna-col">
          {/* A changed archetype gets its moment first, once. [Aliveness F5] */}
          {profile.shift_unseen && <ShiftCard eras={profile.eras} onSeen={onShiftSeen} />}
          {headline && (
            <section className="dna-headline" aria-labelledby="dna-reading-title" aria-live="polite">
              <h2 id="dna-reading-title" className="dna-section-label">What your reading says</h2>
              <Insight insight={headline} headline statedFor={readFor.map(emoLabel)} />
            </section>
          )}

          {evolution}
          {portrait}
          <Moments moments={profile.moments} />

          {rest.length > 0 && (
            <section className="dna-more" aria-labelledby="dna-more-title">
              <h2 id="dna-more-title" className="dna-section-label">Other findings</h2>
              <ul className="dna-more-list">
                {rest.map((i) => (
                  <li key={`${i.category}-${i.variant}`}><Insight insight={i} /></li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="dna-aside" aria-labelledby="dna-arch-title">
          <h2 id="dna-arch-title" className="dna-section-label">The shorthand</h2>
          {/* No archetype is a real answer, not a loading state — past the gate,
              a reader's tally can still name nobody, and saying so beats the
              label the engine used to hand out by list order. */}
          {archetypeBody}
        </aside>
      </div>
      {sharing && card && (
        <ShareSheet
          card={card}
          initialFormat={sharing}
          onClose={(c) => { if (c) setChoices(c); setSharing(null); }}
        />
      )}
    </div>
  );
}
