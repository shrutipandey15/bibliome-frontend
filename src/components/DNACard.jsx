import { forwardRef, useState } from "react";
import { EMOTIONS } from "../services/emotions";
import { generateShareToken } from "../services/api";
import ShareModal from "./ShareModal";
import "./DNACard.css";

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
  const top = (profile.top_emotions || []).slice(0, 5);
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
            <div className="dna-label">BOOK DNA · ONE OF EIGHT</div>
            <div className="dna-vol">{profile.book_count || 0} VOLUMES · MMXXVI</div>
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

        <div className="label dna-fp-label">emotional fingerprint</div>
        {top.map((t) => {
          const em = EMOTIONS[t.emotion_id];
          if (!em) return null;
          return (
            <div key={t.emotion_id} className="dna-fp-row">
              <span className="dna-dot" style={{ background: em.color }} />
              <span className="dna-fp-name">{(em.name || em.label).toLowerCase()}</span>
              <span className="dna-fp-leader" aria-hidden="true" />
              <span className="dna-fp-count">{String(t.count).padStart(2, "0")}</span>
            </div>
          );
        })}

        {p.blind_spots?.length > 0 && (
          <div className="dna-blinds">
            <div className="label-sm">blind spots</div>
            <div className="dna-blind">{p.blind_spots.join(" · ")}</div>
          </div>
        )}

        <div className="dna-footer">
          <span>BOOKDNA.APP</span>
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
