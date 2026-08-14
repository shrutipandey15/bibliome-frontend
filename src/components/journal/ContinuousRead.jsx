import { useEffect, useMemo, useRef, useState } from "react";
import { usePrivateJournal } from "../../contexts/PrivateJournalContext";
import { EMOTIONS } from "../../services/emotions";
import { countWords, formatLongDate } from "./BlankPage";
import Modal from "../Modal";

// The ribbon is one date: which day you last read down to. It lives in
// localStorage so it survives the tab — and it is the only journal-related thing
// this app ever writes to disk. Worth naming what that leaks: someone with
// access to this browser profile learns that a journal exists and roughly when
// it was last opened. No prose, no tags, no key. The alternative is a ribbon
// that resets every session, which is not a ribbon.
const RIBBON_KEY = "bd-journal-ribbon";

/**
 * Screen 2 — the continuous read-back.
 *
 * One scroll, grouped by date, oldest at the top so reading forward is reading
 * forward. Not a card grid, not a list of previews with "read more": the
 * decision from VISION §6 is that a journal is one continuous book you page
 * through, and a card list is a database with a nice font.
 *
 * What's new is the index down the left. A book you have written a hundred days
 * into needs a way to reach the middle of it, and the honest alternative to an
 * index is scrolling — which is what this screen used to be. The index lists
 * days, never contents: it is a set of dates, so it gives nothing away at a
 * glance that the screen wasn't already showing.
 *
 * All of it is decrypted before any of it renders — there is no lazy per-entry
 * decrypt, because the entries are already in memory by the time you get here.
 */
export default function ContinuousRead({ onTagDay }) {
  const { byDate, loading, unreadable } = usePrivateJournal();
  const [ribbon, setRibbon] = useState(() => {
    try { return localStorage.getItem(RIBBON_KEY); } catch { return null; }
  });
  const scrollerRef = useRef(null);
  const ribbonRef = useRef(null);
  const jumped = useRef(false);

  // Oldest first for reading; byDate is newest-first for everything else.
  const chronological = useMemo(() => [...byDate].reverse(), [byDate]);
  const [indexSheet, setIndexSheet] = useState(false);

  // Land on the ribbon once, on first paint after the pages arrive.
  useEffect(() => {
    if (jumped.current || !ribbon || !chronological.length) return;
    jumped.current = true;
    ribbonRef.current?.scrollIntoView({ block: "center" });
  }, [ribbon, chronological.length]);

  // Move the ribbon to whichever day is currently in view. Cheap, passive, and
  // it never fights a deliberate scroll.
  useEffect(() => {
    const root = scrollerRef.current;
    if (!root) return;
    const obs = new IntersectionObserver(
      (items) => {
        const visible = items.filter((i) => i.isIntersecting);
        if (!visible.length) return;
        const date = visible[visible.length - 1].target.dataset.date;
        if (!date) return;
        setRibbon(date);
        try { localStorage.setItem(RIBBON_KEY, date); } catch { /* private mode */ }
      },
      { threshold: 0.4 }
    );
    root.querySelectorAll("[data-date]").forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [chronological]);

  const goToDay = (date) => {
    scrollerRef.current
      ?.querySelector(`[data-date="${date}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (loading) return <div className="jr-quiet">Opening your pages…</div>;
  if (!chronological.length) {
    return <div className="jr-quiet">Nothing written yet.</div>;
  }

  return (
    <div className="jr-read">
      {/* Phones only (CSS-hidden above 640, where the rail below carries this).
          The rail becomes a horizontal scroll strip under 1080, which is fine
          for a handful of days and unusable for a journal kept for a year —
          the same unbounded-horizontal-axis problem as the heatmap. A sheet
          wraps and grows downward instead. */}
      <button
        className="jr-index-trigger"
        onClick={() => setIndexSheet(true)}
        aria-haspopup="dialog"
      >
        <span className="jr-index-trigger-label">the index</span>
        <span className="jr-index-trigger-value">
          {ribbon ? shortDate(ribbon) : `${chronological.length} days`} ⌄
        </span>
      </button>

      {indexSheet && (
        <Modal
          onClose={() => setIndexSheet(false)}
          ariaLabel="Jump to a day"
          className="rr-modal-card"
          backdropClassName="rr-modal-backdrop"
        >
          <div className="jr-index-sheet">
            <div className="label rr-sheet-head">the index</div>
            <div className="jr-index-sheet-list">
              {chronological.map(({ date }) => (
                <button
                  key={date}
                  type="button"
                  className={`jr-index-item${date === ribbon ? " is-here" : ""}`}
                  onClick={() => { goToDay(date); setIndexSheet(false); }}
                >
                  <span className="jr-index-mark" aria-hidden="true" />
                  <span className="jr-index-label">{shortDate(date)}</span>
                </button>
              ))}
            </div>
          </div>
        </Modal>
      )}

      <aside className="jr-index" aria-label="The index">
        <div className="jr-aside-label">the index</div>
        {chronological.map(({ date }) => (
          <button
            key={date}
            type="button"
            className={`jr-index-item${date === ribbon ? " is-here" : ""}`}
            onClick={() => goToDay(date)}
          >
            <span className="jr-index-mark" aria-hidden="true" />
            <span className="jr-index-label">{shortDate(date)}</span>
          </button>
        ))}
      </aside>

      <div className="jr-pages" ref={scrollerRef}>
        {chronological.map(({ date, items }) => (
          <section
            key={date}
            data-date={date}
            className="jr-day"
            ref={date === ribbon ? ribbonRef : null}
          >
            <header className="jr-day-head">
              <h3>{formatLongDate(date)}</h3>
              <span className="jr-day-rule" aria-hidden="true" />
              {date === ribbon && <span className="jr-ribbon" aria-label="Last read">◂ last read</span>}
            </header>
            {items.map((page) => (
              <article key={page.id} className="jr-day-body">
                {page.text.split(/\n{2,}/).map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
                <footer className="jr-day-tags">
                  {page.emotions?.length ? (
                    page.emotions.map((e) => {
                      const meta = EMOTIONS[e.emotion_id] || {};
                      return (
                        <span
                          key={e.emotion_id}
                          className="jr-tag"
                          style={{ "--tag": meta.color || "var(--ink-faint)" }}
                        >
                          <span className="jr-tag-dot" aria-hidden="true" />
                          {meta.label || e.emotion_id}
                        </span>
                      );
                    })
                  ) : (
                    <button type="button" className="jr-link" onClick={() => onTagDay?.(page)}>
                      name this day
                    </button>
                  )}
                  <span className="jr-day-words">{countWords(page.text)} words</span>
                </footer>
              </article>
            ))}
          </section>
        ))}

        <div className="jr-read-end">That's all of it.</div>

        {unreadable.length > 0 && (
          // Silence here would be a lie by omission — these days exist, they're
          // just not openable with the key in this tab.
          <div className="jr-unreadable">
            {unreadable.length} {unreadable.length === 1 ? "page" : "pages"} couldn't be
            opened with this key. They're still on the server, sealed.
          </div>
        )}
      </div>
    </div>
  );
}

function shortDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
