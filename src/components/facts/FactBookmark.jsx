import { useEffect, useState } from "react";
import { getTodayFact } from "../../services/api";
import "./FactBookmark.css";

// What the bookmark says beside the date or year, by where the fact came from.
const KIND = { birth: "born on this day", death: "died on this day", event: "on this day", holiday: "today is" };
// The small line above already says this much, so the text doesn't repeat it.
const LEAD = /^(?:(?:Born on|Died on|On) this day in \d{3,4}: |Today is )/;
const TONE = { fun: "true story", weird: "weird but true", unhinged: "unhinged but true" };

// Wikipedia's dated facts run 25–270 characters, the bank's 55–200. Type steps
// down as the text grows, so a short fact isn't a stub and a long one isn't a tower.
export const lengthClass = (text = "") => (text.length <= 80 ? "is-short" : text.length <= 160 ? "is-medium" : "is-long");

// "On this day in 1813: …" / "Born on this day in 1775: …" → "1813"
const yearOf = (text) => (/\bin (\d{3,4}):/.exec(text || "") || [])[1] || null;

/** Today's book fact, or null when none arrived in the last day. */
export function useTodayFact() {
  const [fact, setFact] = useState(null);
  useEffect(() => {
    let live = true;
    getTodayFact().then((f) => { if (live) setFact(f); });
    return () => { live = false; };
  }, []);
  return fact;
}

export function parts(fact) {
  const year = yearOf(fact.text);
  const date = new Date(`${fact.day}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const kicker = KIND[fact.kind] || TONE[fact.tone] || "true story";
  const text = KIND[fact.kind] ? fact.text.replace(LEAD, "") : fact.text;
  return { big: year || date, kicker, text: text.charAt(0).toUpperCase() + text.slice(1) };
}

function Source({ href }) {
  return (
    <a className="fbm-source" href={href} target="_blank" rel="noopener noreferrer" aria-label="Source (opens Wikipedia)">
      source ↗
    </a>
  );
}

/**
 * The fact as a paper bookmark standing on the "in rotation" shelf, leaning on
 * the books, tassel through the hole. Part of the shelf, not a notice on top of
 * the page: nothing pushed down, nothing to dismiss, a new one tomorrow.
 */
export function FactBookmark({ fact }) {
  if (!fact) return null;
  const { big, kicker, text } = parts(fact);
  return (
    <aside className={`fbm ${lengthClass(text)}`} aria-label="Today in books" title={fact.text}>
      <span className="fbm-tassel" aria-hidden="true" />
      <span className="fbm-hole" aria-hidden="true" />
      <div className="fbm-label">today in books</div>
      <div className="fbm-big">{big}</div>
      <div className="fbm-kicker">{kicker}</div>
      <p className="fbm-text">{text}</p>
      {fact.shelf_note && <p className="fbm-note">{fact.shelf_note}</p>}
      <Source href={fact.source} />
    </aside>
  );
}

/** The same paper, as a slip under the hero, where the shelf isn't shown (phones). */
export function FactSlip({ fact }) {
  if (!fact) return null;
  const { big, kicker, text } = parts(fact);
  return (
    <aside className={`fslip ${lengthClass(text)}`} aria-label="Today in books">
      <span className="fslip-tassel" aria-hidden="true" />
      <div className="fslip-head">
        <span className="fbm-label">today in books</span>
        <span className="fslip-big">{big}</span>
        <span className="fbm-kicker">{kicker}</span>
      </div>
      <p className="fslip-text">{text}</p>
      <div className="fslip-foot">
        {fact.shelf_note && <span className="fbm-note">{fact.shelf_note}</span>}
        <Source href={fact.source} />
      </div>
    </aside>
  );
}
