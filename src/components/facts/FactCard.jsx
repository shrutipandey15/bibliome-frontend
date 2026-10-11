import { useEffect, useState } from "react";
import { BookOpen, ExternalLink, X } from "lucide-react";
import { getTodayFact } from "../../services/api";
import "./FactCard.css";

const DISMISSED = "bibliome_fact_dismissed";

/**
 * Today's book fact, at the top of the shelf. Shows only if one arrived in the
 * last day, and stays gone once put away (per day, on this device).
 */
export default function FactCard() {
  const [fact, setFact] = useState(null);

  useEffect(() => {
    let live = true;
    getTodayFact().then((f) => {
      let gone = null;
      try { gone = localStorage.getItem(DISMISSED); } catch { /* private mode */ }
      if (live && f && gone !== f.day) setFact(f);
    });
    return () => { live = false; };
  }, []);

  if (!fact) return null;
  const dismiss = () => {
    try { localStorage.setItem(DISMISSED, fact.day); } catch { /* ignore */ }
    setFact(null);
  };
  return (
    <aside className="fact-card" aria-label="Today in books">
      <BookOpen className="fact-icon" size={18} aria-hidden="true" />
      <div className="fact-body">
        <div className="label-sm fact-label">today in books</div>
        <p className="fact-text">{fact.text}</p>
        <div className="fact-meta">
          {fact.shelf_note && <span className="fact-shelf">{fact.shelf_note}</span>}
          <a className="fact-source" href={fact.source} target="_blank" rel="noopener noreferrer">
            Source <ExternalLink size={12} aria-hidden="true" />
          </a>
        </div>
      </div>
      <button className="fact-close" onClick={dismiss} aria-label="Put today's fact away">
        <X size={16} />
      </button>
    </aside>
  );
}
