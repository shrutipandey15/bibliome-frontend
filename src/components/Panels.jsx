import { Fragment, useState, useEffect } from "react";
import { EMOTIONS, EMO_LIST } from "../services/emotions";
import useIsNarrow from "../hooks/useIsNarrow";
import "./Panels.css";

/**
 * How many books the matrix draws before it offers the rest.
 *
 * Books are the only unbounded axis here — emotions are fixed at 18 and
 * intensity at 1–10 — so bounding books is the only thing that stops this
 * growing forever. It was unbounded on BOTH platforms: the desktop grid is
 * `160px + books × 28px`, which passed a 1440px screen at 45 books and is
 * already ~2100px at 69. Mobile only made it obvious sooner.
 *
 * 24 fills roughly one desktop screen and a comfortable phone scroll, and the
 * window is recent-first so it stays current as you read.
 */
const HEATMAP_WINDOW = 24;

/**
 * The same matrix with its axes swapped, for phones.
 *
 * The desktop grid is `160px + books × 28px`. At 69 books that is 2092px — 6.2
 * screens of sideways scrolling on a 375px phone, and it gets worse with every
 * book logged, because BOOKS is the unbounded axis and it was the horizontal
 * one. Emotions are fixed at 18 forever.
 *
 * So transpose: books run down (vertical scroll is free on a phone), emotions
 * run across (18 columns fit one screen, permanently). Book titles stop being
 * rotated 90° and become ordinary left-aligned labels you can read.
 *
 * Cells carry no numeral — at ~13px wide there is no room, and the intensity is
 * already in the opacity. The colour IS the emotion, same as everywhere else in
 * the app, and the key underneath names each column in order.
 */
function CompactMatrix({ books, emos, cellMap }) {
  return (
    <>
      <div
        className="hmc"
        style={{ gridTemplateColumns: `88px repeat(${emos.length}, minmax(0, 1fr))` }}
      >
        <div />
        {emos.map((eid) => (
          <div
            key={eid}
            className="hmc-head"
            style={{ background: EMOTIONS[eid]?.color }}
            title={EMOTIONS[eid]?.name}
          />
        ))}
        {books.map((b) => (
          <Fragment key={b.entry_id}>
            <div className="hmc-title" title={b.title}>{b.title}</div>
            {emos.map((eid) => {
              const v = cellMap[`${b.entry_id}-${eid}`];
              const e = EMOTIONS[eid];
              return (
                <div
                  key={eid}
                  className="hmc-cell"
                  title={v ? `${b.title} · ${e?.name} ${v}/10` : undefined}
                  style={{
                    background: v ? e?.color : "transparent",
                    opacity: v ? 0.18 + (v / 10) * 0.82 : 0.07,
                  }}
                />
              );
            })}
          </Fragment>
        ))}
      </div>
      {/* Without this the columns are unlabelled colour — the swatch row up top
          says which is which only if you already know the palette. */}
      <div className="hmc-key">
        {emos.map((eid) => (
          <span key={eid} className="hmc-key-item">
            <span className="hmc-key-dot" style={{ background: EMOTIONS[eid]?.color }} />
            {EMOTIONS[eid]?.name}
          </span>
        ))}
      </div>
    </>
  );
}

export function Heatmap({ data }) {
  const narrow = useIsNarrow();
  // Above the early return: hooks cannot run conditionally.
  const [shown, setShown] = useState(HEATMAP_WINDOW);
  useEffect(() => { setShown(HEATMAP_WINDOW); }, [data]);

  if (!data || data.total_books < 2) {
    return (
      <div className="empty-state">
        <div className="empty-glyph">◐</div>
        <div className="empty-title">Add at least 2 books to see your heatmap</div>
        <div className="empty-sub">The matrix needs a little gravity.</div>
      </div>
    );
  }
  const { books, active_emotions, cells } = data;
  const cellMap = {};
  const emoTotals = {};
  cells.forEach((c) => {
    cellMap[`${c.entry_id}-${c.emotion_id}`] = c.intensity;
    emoTotals[c.emotion_id] = (emoTotals[c.emotion_id] || 0) + 1;
  });
  const emos = [...active_emotions].sort((a, b) => (emoTotals[b] || 0) - (emoTotals[a] || 0));

  // The backend returns entries `created_at ASC` (dna.py `_get_user_entries`),
  // so the most recent books are at the END of this array. Reversed, the window
  // is "your most recent N" and — the reason it's reversed rather than sliced
  // from the tail — "show older" appends BELOW the fold instead of prepending
  // above it, so expanding never yanks the scroll position.
  const ordered = [...books].reverse();
  const visibleBooks = ordered.slice(0, shown);
  const remaining = ordered.length - visibleBooks.length;

  // NOTE: emoTotals, bestPair and blindSpots below stay computed over ALL books
  // on purpose. They are aggregate facts about the shelf, not about the window —
  // windowing them would make the row counts and "strongest pairing" silently
  // change every time someone pressed "show older".

  let bestPair = null, bestCount = 0;
  for (let i = 0; i < emos.length; i++) {
    for (let j = i + 1; j < emos.length; j++) {
      const a = emos[i], b = emos[j];
      const n = books.filter((bk) => cellMap[`${bk.entry_id}-${a}`] && cellMap[`${bk.entry_id}-${b}`]).length;
      if (n > bestCount) { bestCount = n; bestPair = [a, b]; }
    }
  }

  const presentSet = new Set(emos);
  const blindSpots = EMO_LIST.filter(([id]) => !presentSet.has(id)).slice(0, 3);

  return (
    <div className="hm-page paper">
      <div className="hm-masthead">
        <div>
          <div className="label" style={{ marginBottom: 14 }}>fig. 02 · cross-reference</div>
          <h1 className="hm-h1">The <em>Heatmap</em>.</h1>
          {/* Was "Every book × every emotion you assigned to it" — no longer
              true once the matrix draws a window, and the corner caption saying
              "your last 24 of 69" directly under a promise of "every book" is
              worse than either statement alone. */}
          <p className="hm-dek">
            Your books × the emotions you assigned them. Darker means felt harder.
            The clusters tell you who you are when no one is watching.
          </p>
        </div>
        <div className="label hm-corner">
          {remaining > 0
            ? <>your last {visibleBooks.length} of {books.length} books × {emos.length} emotions</>
            : <>{books.length} books × {emos.length} emotions</>}
          <br />newest first
        </div>
      </div>

      <div className="rule-dbl" style={{ marginBottom: 26 }} />

      <div className="hm-grid-wrap">
        <div className="hm-matrix-wrap">
          {narrow ? <CompactMatrix books={visibleBooks} emos={emos} cellMap={cellMap} /> : (
          <div
            className="hm-matrix"
            style={{ gridTemplateColumns: `160px repeat(${visibleBooks.length}, minmax(28px, 1fr))` }}
          >
            <div />
            {visibleBooks.map((b) => (
              <div key={b.entry_id} className="hm-col-head">{b.title}</div>
            ))}
            {emos.map((eid) => {
              const e = EMOTIONS[eid];
              if (!e) return null;
              return (
                <Fragment key={eid}>
                  <div className="hm-row-label">
                    <span className="hm-row-dot" style={{ background: e.color }} />
                    <span className="hm-row-name">{e.name}</span>
                    <span className="hm-row-count">{String(emoTotals[eid] || 0).padStart(2, "0")}</span>
                  </div>
                  {visibleBooks.map((b) => {
                    const v = cellMap[`${b.entry_id}-${eid}`];
                    return (
                      <div
                        key={`${b.entry_id}-${eid}`}
                        className="hm-cell"
                        style={{
                          background: v ? e.color : "transparent",
                          opacity: v ? 0.18 + (v / 10) * 0.82 : 0.06,
                          borderColor: v ? `color-mix(in srgb, ${e.color} 30%, transparent)` : "var(--rule-soft)",
                          color: v >= 6 ? "rgba(255,255,255,0.85)" : "var(--ink-faint)",
                        }}
                      >
                        {v || ""}
                      </div>
                    );
                  })}
                </Fragment>
              );
            })}
          </div>
          )}

          {remaining > 0 && (
            <div className="hm-more">
              <button className="hm-more-btn" onClick={() => setShown((n) => n + HEATMAP_WINDOW)}>
                show {Math.min(remaining, HEATMAP_WINDOW)} older
              </button>
              <span className="label-sm">{visibleBooks.length} of {books.length} books</span>
            </div>
          )}

          <div className="hm-legend">
            <div className="label-sm">intensity scale</div>
            <div className="hm-legend-row">
              {[2, 4, 6, 8, 10].map((n) => (
                <div className="hm-legend-item" key={n}>
                  <div className="hm-legend-swatch" style={{ opacity: 0.18 + (n / 10) * 0.82 }} />
                  <span>{n}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="hm-rail">
          {/* "Most felt" used to be rendered here as well as in the Patterns
              rail below — the same emotion, the same count, the same percentage,
              derived from two different sources about 600px apart. The Patterns
              copy is the one that survives, because that is where the other
              headline figures live. */}
          {bestPair && (
            <div className="card editorial">
              <div className="label" style={{ marginBottom: 10 }}>strongest pairing</div>
              <div className="hm-rail-pair">
                <em style={{ color: EMOTIONS[bestPair[0]]?.color }}>{EMOTIONS[bestPair[0]]?.name}</em>
                {" + "}
                <em style={{ color: EMOTIONS[bestPair[1]]?.color }}>{EMOTIONS[bestPair[1]]?.name}</em>
              </div>
              <div className="hm-rail-sub">
                co-occur in {bestCount} book{bestCount === 1 ? "" : "s"} · ρ {((bestCount / books.length) * 0.9 + 0.1).toFixed(2)}
              </div>
              <div className="hm-rail-aside">You almost never want one without the other.</div>
            </div>
          )}

          {blindSpots.length > 0 && (
            <div className="card editorial" style={{ borderTop: "3px solid var(--ink-faint)" }}>
              <div className="label" style={{ marginBottom: 10 }}>blind spots</div>
              <div className="hm-blind-list">
                {blindSpots.map(([id, e]) => (
                  <div className="hm-blind-row" key={id}>
                    <span className="hm-blind-dot" style={{ background: e.color }} />
                    <span className="hm-blind-name">{e.name}</span>
                    <span className="hm-blind-count">0 / {books.length}</span>
                  </div>
                ))}
              </div>
              <div className="hm-rail-aside">The emotions you never reach for.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Patterns — the merged "what does my reading look like in aggregate?" view.
// One scroll: headline figures → heatmap → emotion ledger → rail. [F5.2]
//
// `embedded` renders it as the closing section of the DNA tab rather than a page
// of its own: the heading drops to an h2 (the DNA view owns the h1) and the empty
// state stays silent, since the DNA gate above it already says "not enough yet".
export function Patterns({ stats, heatmap, embedded = false }) {
  if (!stats || stats.total_books === 0) {
    if (embedded) return null;
    return (
      <div className="empty-state">
        <div className="empty-glyph">№</div>
        <div className="empty-title">Not enough yet</div>
        <div className="empty-sub">Shelve a few books and your patterns will appear here.</div>
      </div>
    );
  }

  const top = EMOTIONS[stats.most_common_emotion];
  const hardest = stats.highest_intensity_book;
  const counts = stats.emotion_counts || {};
  const ranked = EMO_LIST
    .map(([id, e]) => [id, e, counts[id] || 0])
    .filter(([, , n]) => n > 0)
    .sort((a, b) => b[2] - a[2])
    .slice(0, 10);
  const totalBooks = stats.total_books;

  return (
    <div className="st-page">
      <div className="st-masthead">
        <div>
          <div className="label" style={{ marginBottom: 14 }}>fig. 03 · the patterns</div>
          {embedded
            ? <h2 className="st-h1">Your <em>Patterns</em>.</h2>
            : <h1 className="st-h1">Your <em>Patterns</em>.</h1>}
        </div>
        <div className="label">your shelf · in aggregate</div>
      </div>
      <div className="rule-dbl" style={{ marginBottom: 32 }} />

      {/* No dashboard stat cards here [F-DNA-9]. The counts they showed (books
          logged, avg intensity, books/month, diversity) are figures, not
          insight — the page leads with the heatmap and the ledger instead. */}
      {heatmap && (
        <div className="st-heatmap-slot">
          <Heatmap data={heatmap} />
        </div>
      )}

      <div className="st-bottom">
        <div className="card editorial st-ledger">
          <div className="label" style={{ marginBottom: 18 }}>emotion rankings · the full ledger</div>
          {ranked.length === 0 && (
            <div className="st-ledger-empty">
              No emotions tagged yet — tag a few books and the ledger fills in.
            </div>
          )}
          {ranked.map(([id, e, n], i) => {
            const pct = (n / totalBooks) * 100;
            return (
              <div key={id} className="st-ledger-row" style={{ borderBottom: i < ranked.length - 1 ? "1px solid var(--rule-soft)" : "none" }}>
                <span className="st-ledger-no">№{String(i + 1).padStart(2, "0")}</span>
                <span className="st-ledger-dot" style={{ background: e.color }} />
                <span className="st-ledger-name">{e.name}</span>
                <span className="st-ledger-bar">
                  <span style={{ width: `${pct}%`, background: e.color }} />
                </span>
                <span className="st-ledger-count">{n}/{totalBooks}</span>
              </div>
            );
          })}
        </div>

        <div className="st-rail">
          {top && (
            <div className="card editorial st-card-mostfelt">
              <div className="label" style={{ marginBottom: 12 }}>most felt emotion</div>
              <div className="st-most">
                <div className="st-most-circle" style={{ background: top.color }}>{top.glyph}</div>
                <div>
                  <div className="st-most-name">{top.name}</div>
                  <div className="label-sm">
                    in {stats.most_common_emotion_count} book{stats.most_common_emotion_count === 1 ? "" : "s"}
                    {totalBooks ? ` · ${Math.round((stats.most_common_emotion_count / totalBooks) * 100)}%` : ""}
                  </div>
                </div>
              </div>
            </div>
          )}
          {hardest && (
            <div className="card editorial st-card-hardest">
              <div className="label" style={{ marginBottom: 12 }}>most intense read</div>
              <div className="st-hardest-title">{hardest.title}</div>
              <div className="label-sm">{hardest.author} · intensity {hardest.intensity}/10</div>
              {hardest.quote && (
                <div className="st-hardest-echo">“{hardest.quote}”</div>
              )}
            </div>
          )}
          {top && (
            <div className="card editorial st-vibe" style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${top.color} 10%, var(--bg-card)), var(--bg-card))` }}>
              <div className="label" style={{ marginBottom: 10, color: top.color }}>shelf vibe</div>
              <div className="st-vibe-text">
                “A quiet shelf of patient, attentive readers — the kind who underline in pencil.”
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
