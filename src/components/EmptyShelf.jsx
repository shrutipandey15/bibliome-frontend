import "./EmptyShelf.css";

const SEED_SHELVES = [
  "Sad girl autumn",
  "The classics no one reads",
  "Hot-button essays",
  "Slow novels for slow weather",
  "Books that ruined me in college",
];

const AFTER_STEPS = [
  { n: "01", t: "You log it",         d: "Title + author. We find the cover." },
  { n: "02", t: "You tag what it did", d: "Emotions, intensity, the line that hit." },
  { n: "03", t: "You shelve it",       d: "Five books = DNA. Ten = the portrait sharpens." },
];

export default function EmptyShelf({ onAddClick, onImport }) {
  return (
    <div className="es-page">
      <div className="es-grid">
        <div className="es-primary">
          <div className="es-glyph" aria-hidden="true"><span /><span /><span /></div>

          <div className="label es-eyebrow">· your shelf is empty ·</div>
          <h1 className="es-h1">Nothing on the shelf yet.</h1>
          <p className="es-dek">
            Start with the last book you finished.<br />
            Not the best one-  <em>the last one</em>.
          </p>
          <div className="es-actions">
            <button className="es-search" onClick={onAddClick}>
              <span className="es-search-glyph">⌕</span>
              <span className="es-search-text">Shelve a book</span>
              <span className="es-kbd">⌘ K</span>
            </button>
            <div className="es-search-note">
              we'll search Google Books, Open Library, and the catalog at once.
            </div>

            {onImport && (
              <div className="es-import-note">
                <span className="es-import-lead">already have a library elsewhere? </span>
                <button type="button" className="es-import-link" onClick={onImport}>
                  Import from Goodreads or StoryGraph
                </button>
              </div>
            )}
            <div className="es-privacy">Private by default</div>
          </div>

          <div className="es-seeds">
            <div className="label" style={{ marginBottom: 10 }}>or — pick a suggested shelf to seed yours</div>
            <div className="es-seed-row">
              {SEED_SHELVES.map((p) => (
                <button key={p} className="es-seed-chip" onClick={onAddClick}>{p}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="es-right">
          <div className="label es-shelf-label">↓ your shelf · awaiting</div>
          <div className="shelf" style={{ opacity: 0.85 }}>
            <div className="shelf-row" style={{ minHeight: 180, alignItems: "flex-end", justifyContent: "center" }}>
              <button className="es-ghost-book" onClick={onAddClick} aria-label="Add your first book">+</button>
            </div>
            <div className="shelf-plank" />
          </div>
          <div className="es-hand">even one volume is enough to begin.</div>

          <div className="es-after">
            <div className="label" style={{ marginBottom: 12 }}>what happens after</div>
            {AFTER_STEPS.map((s, i) => (
              <div key={s.n} className="es-after-row" style={{ borderBottom: i < AFTER_STEPS.length - 1 ? "1px solid var(--rule-soft)" : "none" }}>
                <div className="es-after-num">{s.n}</div>
                <div>
                  <div className="es-after-t">{s.t}</div>
                  <div className="es-after-d">{s.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
