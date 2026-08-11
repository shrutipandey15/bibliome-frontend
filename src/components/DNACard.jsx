import { forwardRef, useState } from "react";
import { EMOTIONS, EMO_LIST } from "../services/emotions";
import { generateShareToken } from "../services/api";
import { cardArchetype } from "../services/dnaCard";
import { romanYear } from "../utils/roman";
import ShareModal from "./ShareModal";
import "./DNACard.css";

/**
 * The fingerprint: one bar per register in the vocabulary, tallest first.
 *
 * The bars are REAL — `emotion_counts` is a per-reader tally of books per
 * register, counted server-side from their own shelf. The registers that come
 * back zero are drawn too, as stubs: the gaps are the half of the fingerprint
 * that says the most, and dropping them would make every reader's card look
 * equally full.
 *
 * `top_emotions` is the fallback for surfaces with no book tally to hand (the
 * share card, a legacy DNA cache). Those carry `weight` — a SHARE of recent
 * reading, 0..1 — not a book count, so the figures are rendered as percentages
 * and labelled as such. Printing a share as a bare number would read as "37
 * books" on a shelf of nine.
 */
function fingerprintRows(profile) {
  const counts = profile.emotion_counts;
  if (counts && Object.keys(counts).length > 0) {
    return EMO_LIST
      .map(([slug, emo]) => ({ slug, emo, count: counts[slug] || 0 }))
      .filter((r) => r.emo)
      .sort((a, b) => b.count - a.count);
  }
  return (profile.top_emotions || [])
    .map((t) => ({
      slug: t.emotion_id,
      emo: EMOTIONS[t.emotion_id],
      // `count` on legacy payloads, `weight` (a 0..1 share) on the card payload.
      count: t.count ?? Math.round((t.weight || 0) * 100),
      isShare: t.count == null,
    }))
    .filter((r) => r.emo)
    .sort((a, b) => b.count - a.count);
}

/**
 * The evidence under the label: "grief in 14 of your 31 books · your 3
 * highest-rated were all devastation". Counts only, no adjectives — every clause
 * is something the reader can go and count for themselves.
 */
function BasisLine({ basis }) {
  const counts = (basis.counts || []).slice(0, 2);
  const topRated = basis.top_rated_emotions || [];
  const clauses = counts.map((c) => {
    const emo = EMOTIONS[c.emotion];
    return `${(emo?.name || c.emotion).toLowerCase()} in ${c.books} of your ${c.of} books`;
  });
  // Only when the reader's highest-rated books agree on ONE register. Listing
  // three is a list, not a finding, and "all" would then be a lie.
  if (topRated.length === 1) {
    const emo = EMOTIONS[topRated[0]];
    const n = basis.top_rated_n || 3;
    clauses.push(`your ${n} highest-rated were all ${(emo?.name || topRated[0]).toLowerCase()}`);
  }
  if (clauses.length === 0) return null;
  return <p className="dna-basis">{clauses.join(" · ")}</p>;
}

/**
 * The shorthand card — the one shareable artifact. Rendered on the DNA page's
 * shelf-side rail, on your profile, and on a shared link, so it is deliberately
 * self-contained: a dark plate that carries its own surface rather than
 * inheriting Vellum or Lamplight from whatever page it lands on.
 *
 * `footer` slots content between the plate and its actions (the DNA page puts
 * the archetype's description there). `showDescription` keeps the blurb ON the
 * plate for the standalone uses, where there is no page around it to hold it.
 */
const DNACard = forwardRef(function DNACard(
  { profile, username, allowShare = false, onSave, size = "large", showDescription = true, footer = null },
  ref
) {
  const [showShare, setShowShare] = useState(false);
  const [shareToken, setShareToken] = useState(null);

  const p = cardArchetype(profile);
  if (!p) return null;

  const handleShareClick = async () => {
    try {
      const data = await generateShareToken();
      setShareToken(data.share_token);
      setShowShare(true);
    } catch (err) {
      console.error("Token error", err);
    }
  };

  const rows = fingerprintRows(profile);
  const top = rows.filter((r) => r.count > 0).slice(0, 5);
  const peak = rows.length ? Math.max(...rows.map((r) => r.count)) : 0;
  const isShare = rows.some((r) => r.isShare);
  const share = profile.archetype_share;
  const [first, ...rest] = (p.name || "").split(" ");
  const second = rest.join(" ");

  // How far the leading archetype cleared the runner-up, as a fraction of its own
  // score. Under 10% the label is close to a coin flip, and the card says so
  // instead of asserting it — a hedge the reader can check against the runner-up
  // named underneath.
  const margin = profile.margin;
  const close = margin != null && margin < 0.10;
  const runnerUp = profile.runner_up;
  // Counts only, straight off the reader's own shelf. Null until the backend
  // computes it; nothing is invented to fill the line.
  const basis = profile.basis;

  return (
    <div className="dna-wrapper">
      <div className={`dna-card anim-flip dna-card--${size}`} ref={ref} style={{ "--dc": p.color || "var(--oxblood)" }}>
        {/* The plate's grain. The four corner glyphs are gone — the double
            ruled inset (see `.dna-card::before/::after`) does that job without
            four more marks competing with the archetype's own. */}
        <span className="dna-frame" aria-hidden="true" />

        <div className="dna-header">
          <div>
            <div className="dna-label">BIBLIOME · ONE OF EIGHT</div>
            {/* The year was hardcoded MMXXVI, so every card minted from 2027 on
                would have carried the wrong date. It's the year of issue — the
                day the plate was drawn — so it comes off the clock. */}
            <div className="dna-vol">{profile.book_count || 0} VOLUMES · {romanYear()}</div>
          </div>
          <div className="dna-glyph">{p.glyph || "◈"}</div>
        </div>

        {close && <div className="dna-hedge">closest to</div>}
        <h2 className="dna-name">
          {first}{second && <><br /><em>{second}</em></>}
        </h2>
        {close && runnerUp && (
          <div className="dna-hedge dna-hedge--after">shading toward {runnerUp}</div>
        )}
        {/* The receipt. The name is a headline for a number the reader can go and
            check against their own shelf — without it, the label is just a bucket
            they were sorted into. */}
        {basis && <BasisLine basis={basis} />}
        {p.tagline && <div className="dna-tagline">“{p.tagline}”</div>}
        {showDescription && p.description && <p className="dna-blurb">{p.description}</p>}

        {/* Renamed from `.dna-divider`, which collided with the DNA page's
            ◆ ◆ ◆ section break of the same name — two stylesheets, one class,
            and whichever loaded last won. */}
        <div className="dna-card-rule" />

        {/* "no two alike" is gone. Those bars are a tally over an 18-register
            vocabulary: two eight-book readers who both tag grief and comfort draw
            the same silhouette. It was the one line on the card making a claim the
            rest of the project refuses to make. What replaces it says what the
            figures ARE, which is the thing a reader actually needs to know. */}
        <div className="dna-fp-head">
          <span className="label dna-fp-label">emotional fingerprint</span>
          <span className="dna-fp-note">{isShare ? "share of recent reading" : "books per register"}</span>
        </div>

        {peak > 0 && (
          <>
            {/* Decorative: every bar's figure is spelled out in the row of top
                registers underneath, and the whole tally is on the DNA page. */}
            <div className="dna-fp-bars" aria-hidden="true">
              {rows.map((r) => (
                <span
                  key={r.slug}
                  className={`dna-fp-bar${r.count === 0 ? " dna-fp-bar--none" : ""}`}
                  style={{ height: `${Math.max(4, Math.round((r.count / peak) * 100))}%`, background: r.emo.color }}
                />
              ))}
            </div>

            <ul className="dna-fp-top">
              {top.map((r) => (
                <li key={r.slug} className="dna-fp-cell">
                  <span className="dna-fp-count">{r.count}{r.isShare ? "%" : ""}</span>
                  <span className="dna-fp-name">{(r.emo.name || r.emo.label).toLowerCase()}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        {p.blind_spots?.length > 0 && (
          <div className="dna-blinds">
            <div className="label-sm">what you avoid</div>
            <div className="dna-blind">{p.blind_spots.join(" · ")}</div>
          </div>
        )}

        <div className="dna-footer">
          {/* Only when the population is large enough for a share to mean
              something — the backend sends null until then. */}
          {share != null && <span>shared by {share}% of readers</span>}
          <span>BIBLIOME.APP</span>
          <span>@{(username || "you").toUpperCase()}</span>
        </div>
      </div>

      {footer}

      {allowShare && (
        <div className="dna-actions">
          <button className="btn brass" onClick={onSave}>
            <span style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 16 }}>Save</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.18em" }}>AS IMAGE</span>
          </button>
          <button className="btn ghost" onClick={handleShareClick}>share link →</button>
        </div>
      )}

      <ShareModal
        isOpen={showShare}
        onClose={() => setShowShare(false)}
        shareToken={shareToken}
      />
    </div>
  );
});

export default DNACard;
