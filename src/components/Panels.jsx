import { Fragment } from "react";
import { EMOTIONS, EMO_LIST } from "../services/emotions";
import "./Panels.css";

export function Heatmap({ data }) {
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
  const topEmoId = emos[0];
  const topEmo = EMOTIONS[topEmoId];
  const topPct = topEmo ? Math.round(((emoTotals[topEmoId] || 0) / books.length) * 100) : 0;

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
          <p className="hm-dek">
            Every book × every emotion you assigned to it. Darker means felt harder.
            The clusters tell you who you are when no one is watching.
          </p>
        </div>
        <div className="label hm-corner">
          {books.length} books × {emos.length} emotions<br />
          read top → down · left → right
        </div>
      </div>

      <div className="rule-dbl" style={{ marginBottom: 26 }} />

      <div className="hm-grid-wrap">
        <div className="hm-matrix-wrap">
          <div
            className="hm-matrix"
            style={{ gridTemplateColumns: `160px repeat(${books.length}, minmax(28px, 1fr))` }}
          >
            <div />
            {books.map((b) => (
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
                  {books.map((b) => {
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
          {topEmo && (
            <div className="card editorial">
              <div className="label" style={{ marginBottom: 10 }}>most felt</div>
              <div className="hm-rail-name" style={{ color: topEmo.color }}>
                {topEmo.glyph} {topEmo.name}
              </div>
              <div className="hm-rail-sub">
                in {emoTotals[topEmoId]} / {books.length} books · {topPct}%
              </div>
              <div className="hm-rail-aside">The recurring weather of your shelf.</div>
            </div>
          )}

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

  const cards = [
    { l: "Books logged", v: String(totalBooks), sub: "· this volume" },
    { l: "Avg intensity", v: stats.avg_intensity, suf: "/10", sub: "· hits hard" },
    { l: "Books / month", v: String(stats.books_per_month ?? "—"), sub: "· steady" },
    { l: "Emotion diversity", v: String(stats.emotion_diversity ?? 0), suf: "%", sub: "· growing" },
  ];

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

      <div className="st-big-grid">
        {cards.map((x, i) => (
          <div className="st-big-cell" key={i}>
            <div className="label" style={{ marginBottom: 16 }}>{x.l}</div>
            <div className="big-num">
              {x.v}{x.suf && <span className="frac">{x.suf}</span>}
            </div>
            <div className="st-big-sub">{x.sub}</div>
          </div>
        ))}
      </div>

      {/* The heatmap sits between the figures and the ledger. */}
      {heatmap && (
        <div style={{ margin: "32px 0" }}>
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
            <div className="card editorial">
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
            <div className="card editorial">
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
