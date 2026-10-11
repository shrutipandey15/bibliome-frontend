import { Fragment } from "react";
import { getPrimaryEmotion } from "../services/emotions";
import { titleCase } from "../utils/titleCase";

export function SpineBook({ entry, onClick, lean = null, hideTitle = false, index = 0 }) {
  const intensity = entry.intensity || 5;
  const titleLen = (entry.title || "").length;
  const h = Math.min(215, 160 + intensity * 5);
  const w = Math.min(44, Math.max(16, 14 + Math.floor(titleLen / 4)));
  const primary = getPrimaryEmotion(entry);
  const spineColor = primary.color || "#6b3a5d";
  const bands = w > 30 ? "double" : w > 20 ? "single" : "none";

  // Keyboard parity + a real label: narrow spines show no inline text, so the
  // only sighted affordance was the hover `title` tooltip (dead on touch, invisible
  // to keyboard/SR users). role=button needs focus + Enter/Space to be operable. [F2.9 / P5-9]
  const label = entry.author ? `${titleCase(entry.title)} · ${entry.author}` : titleCase(entry.title);
  const activate = () => onClick && onClick();

  return (
    <div
      className="book-spine"
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(); }
      }}
      data-lean={lean}
      title={label}
      style={{
        height: `${h}px`,
        width: `${w}px`,
        "--spine-color": spineColor,
        "--spine-h": `${h}px`,
        animationDelay: `${index * 0.04}s`,
      }}
    >
      <div className="spine-mark" />
      {bands !== "none" && (
        <>
          <div className="spine-band" style={{ top: "14%", height: "4%" }} />
          {bands === "double" && <div className="spine-band lower" style={{ bottom: "12%", height: "4%" }} />}
        </>
      )}
      {!hideTitle && w >= 14 && (
        <div className="spine-title" style={{ fontSize: w < 22 ? 9 : w < 30 ? 10 : 11.5 }}>
          {titleCase(entry.title)}
        </div>
      )}
      {!hideTitle && w >= 26 && entry.author && (
        <div className="spine-author">{entry.author.split(" ").pop()}</div>
      )}
      <div className="spine-mark bottom" style={{ width: 6, height: 6 }} />
    </div>
  );
}

export function Bookend({ height = 60 }) {
  return <div className="bookend" style={{ height }} />;
}

export function ShelfDecoration({ kind = "bust" }) {
  if (kind === "vase") {
    return (
      <div style={{
        width: 30, height: 56, alignSelf: "flex-end",
        background: "linear-gradient(180deg, #c89a4a 0%, #8a6a2e 60%, #5a4520 100%)",
        clipPath: "polygon(20% 0, 80% 0, 88% 30%, 100% 90%, 50% 100%, 0 90%, 12% 30%)",
        opacity: 0.85, marginLeft: 8,
      }} />
    );
  }
  if (kind === "stack") {
    return (
      <div style={{ alignSelf: "flex-end", marginLeft: 8 }}>
        <div style={{ width: 40, height: 8, background: "#5a4022", marginBottom: 1, borderRadius: 1, boxShadow: "inset 0 1px 0 rgba(255,220,170,0.2)" }} />
        <div style={{ width: 44, height: 8, background: "#2a4a5e", marginBottom: 1, borderRadius: 1, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.15)" }} />
        <div style={{ width: 38, height: 8, background: "#7a2a2a", marginBottom: 1, borderRadius: 1 }} />
        <div style={{ width: 42, height: 8, background: "#3a2230", borderRadius: 1 }} />
      </div>
    );
  }
  return (
    <div style={{
      width: 36, height: 56, alignSelf: "flex-end",
      background: "linear-gradient(180deg, #c89a4a 0%, #8a6a2e 100%)",
      clipPath: "polygon(35% 0, 65% 0, 70% 18%, 80% 26%, 80% 42%, 100% 60%, 100% 100%, 0 100%, 0 60%, 20% 42%, 20% 26%, 30% 18%)",
      opacity: 0.78, marginLeft: 6,
    }} />
  );
}

export default function Shelf({
  entries = [],
  onBookClick,
  gap = [],
  leans = {},
  bookend = false,
  label = null,
  decoration = null,
}) {
  return (
    <div className="shelf">
      <div className="shelf-row">
        {bookend && <Bookend height={60} />}
        {entries.map((b, i) => (
          <Fragment key={b.id ?? i}>
            <SpineBook
              entry={b}
              index={i}
              lean={leans[i] || (i === entries.length - 1 ? "left" : null)}
              onClick={() => onBookClick && onBookClick(b)}
            />
            {gap.includes(i) && <div style={{ width: 18 }} />}
          </Fragment>
        ))}
        {decoration}
        {bookend && <Bookend height={60} />}
      </div>
      <div className="shelf-plank" />
      {label && (
        <div className="label" style={{ paddingLeft: 22, marginTop: 6, fontStyle: "italic", textTransform: "none", letterSpacing: "0.08em" }}>
          {label}
        </div>
      )}
    </div>
  );
}
