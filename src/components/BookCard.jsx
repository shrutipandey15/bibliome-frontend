import { useState } from "react";
import { EMOTIONS, getPrimaryEmotion } from "../services/emotions";
import "./BookCard.css";
import { titleCase } from "../utils/titleCase";

/* `width` is a CAP, not a fixed size. It used to be applied literally, so a
   150px card sat inside whatever track the grid gave it — fine at desktop
   widths, but at 320px the 2-column track is ~134px and the card overflowed its
   own cell, scrolling the whole page sideways. Fluid with a max-width renders
   identically wherever the track is wider than the cap (every desktop
   breakpoint) and simply shrinks below it. */
/* A loaded image that isn't a cover: Open Library's 1×1 "no cover" pixel, or
   Google Books' "image not available" PNG, which is always 128×170 (zoom=1) or
   575×750 (zoom=2). Real Google covers are JPEGs at other sizes. */
export function isPlaceholderCover(img) {
  const w = img.naturalWidth, h = img.naturalHeight;
  return w < 10 || h < 10 || (w === 128 && h === 170) || (w === 575 && h === 750);
}

export default function BookCard({ entry, index = 0, onClick, width = 144, showCaption = true }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgFailed, setImgFailed] = useState(!entry.cover_url);

  const primary = getPrimaryEmotion(entry);
  const emos = (entry.emotions || []).slice(0, 3);

  const handleImgLoad = (e) => {
    const img = e.target;
    if (isPlaceholderCover(img)) { setImgFailed(true); return; }
    setImgLoaded(true);
  };

  const coverColor = primary.color || "var(--oxblood)";

  return (
    <div
      className="book-cover-wrap anim-fadeup"
      style={{ width: "100%", maxWidth: width, "--cover-w": "100%", animationDelay: `${Math.min(index, 8) * 0.05}s` }}
    >
      <div
        className="book-cover"
        onClick={onClick}
        style={{ "--cover-w": "100%", "--cv-color": coverColor }}
        role="button"
        tabIndex={0}
      >
        <div className="emo-tabs">
          {emos.map((e, i) => {
            const em = EMOTIONS[e.emotion_id];
            if (!em) return null;
            return (
              <div
                key={e.emotion_id}
                className="emo-tab"
                style={{ height: 14 - i * 3, background: em.color }}
              />
            );
          })}
        </div>

        {!imgFailed && entry.cover_url && (
          <img
            src={entry.cover_url}
            alt=""
            loading="lazy"
            onLoad={handleImgLoad}
            onError={() => setImgFailed(true)}
            className="cover-img"
            style={{ opacity: imgLoaded ? 1 : 0 }}
          />
        )}

        {(imgFailed || !imgLoaded || !entry.cover_url) && (
          <div className="cover-fallback">
            <div className="cf-glyph">{primary.glyph || "§"}</div>
            <div className="cf-author">{entry.author}</div>
            <div className="cf-title">{titleCase(entry.title)}</div>
          </div>
        )}

        <div className="int-strip">
          <div className="int-fill" style={{ width: `${(entry.intensity || 5) * 10}%` }} />
        </div>
      </div>

      {showCaption && (
        <div className="book-caption">
          <div className="bc-title">{titleCase(entry.title)}</div>
          <div className="bc-author">{entry.author}</div>
          <div className="bc-emos">
            {emos.map((e) => {
              const em = EMOTIONS[e.emotion_id];
              if (!em) return null;
              return <span key={e.emotion_id} className="bc-dot" style={{ background: em.color }} />;
            })}
            <span className="bc-int">{entry.intensity ?? "—"}/10</span>
          </div>
        </div>
      )}
    </div>
  );
}
