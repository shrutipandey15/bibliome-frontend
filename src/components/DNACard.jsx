import { forwardRef, useState } from "react";
import { EMOTIONS, EMO_LIST } from "../services/emotions";
import { generateShareToken } from "../services/api";
import { romanYear } from "../utils/roman";
import ShareModal from "./ShareModal";
import "./DNACard.css";

/**
 * The fingerprint: one bar per register in the vocabulary, tallest first.
 *
 * The bars are REAL — `emotion_counts` is a per-reader tally of books per
 * register, counted server-side from their own shelf, so no two cards draw the
 * same shape. The registers that come back zero are drawn too, as stubs: the
 * gaps are the half of the fingerprint that says the most, and dropping them
 * would make every reader's card look equally full.
 *
 * `top_emotions` is the fallback for surfaces that predate the tally (a shared
 * link minted last month, a legacy DNA cache) — fewer bars, still that reader's
 * own numbers, never invented ones.
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
    .map((t) => ({ slug: t.emotion_id, emo: EMOTIONS[t.emotion_id], count: t.count }))
    .filter((r) => r.emo)
    .sort((a, b) => b.count - a.count);
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

  if (!profile?.personality) return null;

  const handleShareClick = async () => {
    try {
      const data = await generateShareToken();
      setShareToken(data.share_token);
      setShowShare(true);
    } catch (err) {
      console.error("Token error", err);
    }
  };

  const p = profile.personality;
  const rows = fingerprintRows(profile);
  const top = rows.filter((r) => r.count > 0).slice(0, 5);
  const peak = rows.length ? Math.max(...rows.map((r) => r.count)) : 0;
  const share = profile.archetype_share;
  const [first, ...rest] = (p.name || "").split(" ");
  const second = rest.join(" ");

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

        <h2 className="dna-name">
          {first}{second && <><br /><em>{second}</em></>}
        </h2>
        {p.tagline && <div className="dna-tagline">“{p.tagline}”</div>}
        {showDescription && p.description && <p className="dna-blurb">{p.description}</p>}

        {/* Renamed from `.dna-divider`, which collided with the DNA page's
            ◆ ◆ ◆ section break of the same name — two stylesheets, one class,
            and whichever loaded last won. */}
        <div className="dna-card-rule" />

        <div className="dna-fp-head">
          <span className="label dna-fp-label">emotional fingerprint</span>
          <span className="dna-fp-note">no two alike</span>
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
                  <span className="dna-fp-count">{r.count}</span>
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
