import { useState, useEffect, useRef } from "react";
import { searchBooks } from "../services/api";
import { useJournal } from "../contexts/JournalContext";
import "./TbrQuickAdd.css";

const DEBOUNCE_MS = 400;
const MAX_RESULTS = 6;

/**
 * TBR fast-add [B2.2] — search, one tap, done.
 *
 * The whole point is what it does NOT do. No modal, no emotion picker, no
 * intensity slider, no save button: the reader hasn't read this book, so there
 * is nothing to describe yet. Adding is a single tap on the result row, and the
 * row confirms in place rather than closing the surface — the common case is
 * shelving three books in a row, and a surface that dismisses itself after each
 * one turns that into three searches.
 */
export default function TbrQuickAdd({ onClose }) {
  const { entries, shelveBook } = useJournal();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  // Keyed by result key: "adding" | "added" | "already" | "error".
  const [rowState, setRowState] = useState({});
  const timer = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); setSearching(false); return; }
    setSearching(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const found = await searchBooks(query.trim());
        setResults(found.slice(0, MAX_RESULTS));
      } catch { setResults([]); }
      setSearching(false);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer.current);
  }, [query]);

  const add = async (book, key) => {
    if (rowState[key] === "adding" || rowState[key] === "added") return;
    setRowState((s) => ({ ...s, [key]: "adding" }));
    try {
      const created = await shelveBook(book);
      // The server is the authority on whether this was new. Saying "added" for
      // a book already on the shelf would be a small lie the reader can catch.
      setRowState((s) => ({ ...s, [key]: created ? "added" : "already" }));
    } catch {
      setRowState((s) => ({ ...s, [key]: "error" }));
    }
  };

  // Books already shelved before this session, so the row opens in the right
  // state instead of confirming an add that never happened.
  const shelved = new Set(
    (entries || []).map((e) => normKey(e.title, e.author))
  );

  return (
    <div className="tbr-quick" role="dialog" aria-label="Add to reading list">
      <div className="tbr-quick-bar">
        <input
          ref={inputRef}
          className="tbr-quick-input"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && onClose?.()}
          placeholder="Search a book to shelve…"
          aria-label="Search books"
        />
        {onClose && (
          <button className="tbr-quick-close" onClick={onClose} aria-label="Close">×</button>
        )}
      </div>

      {searching && <p className="tbr-quick-hint">Searching…</p>}

      {!searching && query.trim().length >= 2 && results.length === 0 && (
        <p className="tbr-quick-hint">
          Nothing found. You can still add it in full from “Add book”.
        </p>
      )}

      <ul className="tbr-quick-results">
        {results.map((book, i) => {
          const key = `${normKey(book.title, book.author)}-${i}`;
          const state = rowState[key]
            || (shelved.has(normKey(book.title, book.author)) ? "already" : "idle");
          return (
            <li key={key}>
              <button
                className={`tbr-quick-row is-${state}`}
                onClick={() => add(book, key)}
                disabled={state === "adding" || state === "added" || state === "already"}
              >
                {book.cover_url
                  ? <img className="tbr-quick-cover" src={book.cover_url} alt="" />
                  : <span className="tbr-quick-cover tbr-quick-cover-blank" aria-hidden="true" />}
                <span className="tbr-quick-meta">
                  <span className="tbr-quick-title">{book.title}</span>
                  {book.author && <span className="tbr-quick-author">{book.author}</span>}
                </span>
                <span className="tbr-quick-state">{LABEL[state]}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const LABEL = {
  idle: "+ Shelve",
  adding: "…",
  added: "On your list",
  already: "Already there",
  error: "Try again",
};

// Mirrors the server's dedupe rule closely enough to pre-mark rows. It is only
// ever used for display — the server, not this, decides what actually dedupes.
function normKey(title, author) {
  const n = (s) => (s || "").toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
  return `${n(title)}|${n(author)}`;
}
