import { useState, useEffect, useMemo, useRef } from "react";
import { Loader2, BookOpen, Pencil } from "lucide-react";
import { EMOTIONS, getEmotionFamilies } from "../services/emotions";
import { searchBooks } from "../services/api";
import useIsNarrow from "../hooks/useIsNarrow";
import "./EntryModal.css";

const INTENSITY_LABELS = [
  "", "barely", "barely", "lingered", "lingered",
  "felt it", "felt it", "obsessed", "obsessed", "wrecked", "wrecked",
];

// Strength an emotion gets the moment you tap it. Keep tagging fast: default,
// adjust only when it matters. [Part B]
const DEFAULT_STRENGTH = 6;

// Mirrors `EntryStatus` in the backend's app/schemas/entry.py. All six have been
// storable since migration 022, but this list offered three, so the reader had
// no way to say a book was abandoned — which also meant the DNF reason axis and
// the abandonment insights could never fire from the UI.
//
// Order is the reading arc: not started → in progress → the three ways it ends →
// read again. Exported so a test can pin it against the backend vocabulary.
export const STATUS_OPTIONS = [
  { value: "want_to_read", label: "want to read" },
  { value: "reading",      label: "reading" },
  { value: "paused",       label: "paused" },
  { value: "abandoned",    label: "gave up" },
  { value: "finished",     label: "finished" },
  { value: "reread",       label: "reread" },
];

// The two ways a reader stops. Both count as put-down in the backend's DNF
// tally, so both are asked why.
export const DNF_STATUSES = ["abandoned", "paused"];
// Only an open book has a "how far in"; the backend stores progress for these.
export const PROGRESS_STATUSES = ["reading", "paused"];

// "Would you read it again?" — a disambiguating axis, optional, never gates save.
const VERDICT_OPTIONS = [
  { value: "yes",      label: "yes" },
  { value: "no",       label: "no" },
  { value: "not_sure", label: "not sure" },
];

// Why a book was put down — shown for both DNF_STATUSES.
// Mirrors `DnfReason` in the backend's app/schemas/entry.py. The API validates
// against that Literal, so a value offered here but missing there is a 422 the
// reader can do nothing about. Exported so a test can pin the two lists together.
export const DNF_OPTIONS = [
  { value: "bored",         label: "bored" },
  { value: "too_much",      label: "too much" },
  { value: "badly_written", label: "badly written" },
  { value: "wrong_time",    label: "wrong time" },
  { value: "lost_me",       label: "lost me" },
  { value: "drifted",       label: "just drifted" },
];

// A single-select one-tap axis (verdict, DNF reason). Tapping the active option
// clears it — every axis here is optional. `wrap` lays the taps out as separate
// chips instead of a joined segmented control (for the longer DNF list).
function OneTap({ label, options, value, onChange, wrap }) {
  return (
    <div className="em-field">
      <div className="label-sm em-field-label">{label}</div>
      <div className={`em-oneshot ${wrap ? "em-oneshot-wrap" : ""}`} role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            className={`em-tap ${value === o.value ? "active" : ""}`}
            onClick={() => onChange(value === o.value ? null : o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// How an already-shelved copy describes itself in the notice. Only ever states
// what the entry actually holds — no date invented for a book that hasn't got one.
function describeShelved(e) {
  const parts = [];
  const when = (iso) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? null
      : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  };
  const finished = e.finished_at && when(e.finished_at);
  const started = e.started_at && when(e.started_at);
  if (e.status === "finished" && finished) parts.push(`finished ${finished}`);
  else if (e.status === "finished") parts.push("finished");
  else if (e.status === "reading") parts.push(started ? `reading since ${started}` : "currently reading");
  else if (e.status === "want_to_read") parts.push("on your want-to-read");
  else if (e.status === "abandoned") parts.push("put down");
  else if (e.status === "paused") parts.push(started ? `paused since ${started}` : "paused");
  else if (e.status === "reread") parts.push(finished ? `reread, first finished ${finished}` : "reread");
  const emo = e.emotions?.[0] && EMOTIONS[e.emotions[0].emotion_id];
  if (emo) parts.push(`tagged ${emo.name.toLowerCase()}`);
  return parts.join(" · ");
}

export default function EntryModal({
  entry, onSave, onDelete, onClose, onFinish, onCheckin,
  // Returns the already-shelved copy of what's being typed, or null. Defaulted
  // so every existing caller (and every test) behaves exactly as before.
  findDuplicate = () => null,
  onOpenExisting,
}) {
  const [title, setTitle] = useState(entry?.title || "");
  const [author, setAuthor] = useState(entry?.author || "");
  const [coverUrl, setCoverUrl] = useState(entry?.cover_url || "");
  const [isbn, setIsbn] = useState(entry?.isbn || "");
  // Per-emotion intensity [Part B]: each tagged emotion carries its own 1–10
  // strength. Round-trips from EmotionOut.strength on edit.
  const [emotions, setEmotions] = useState(
    entry?.emotions?.map((e) => ({ id: e.emotion_id, strength: e.strength ?? DEFAULT_STRENGTH })) || [],
  );
  const [openFamily, setOpenFamily] = useState(null);
  const [quote, setQuote] = useState(entry?.quote || "");
  // Full entry fields [F2.1 / B2.4]: reading status, dates, private notes.
  const [status, setStatus] = useState(entry?.status || "finished");
  // How far in, only asked while a book is open. "" means the reader hasn't
  // said, which is saved as null — not as 0%. [F2.8]
  const [progress, setProgress] = useState(
    entry?.progress == null ? "" : String(entry.progress)
  );
  const [startedAt, setStartedAt] = useState(entry?.started_at || "");
  const [finishedAt, setFinishedAt] = useState(entry?.finished_at || "");
  const [notes, setNotes] = useState(entry?.notes || "");
  // Disambiguating axes [Part C]: both optional, both skippable.
  const [verdict, setVerdict] = useState(entry?.verdict || null);
  const [dnfReason, setDnfReason] = useState(entry?.dnf_reason || null);

  // The optional tail — verdict, quote, notes — folds away on a phone so the
  // fast path is one screen. It does NOT fold when editing a book that already
  // has any of them: collapsing a reader's own notes out of sight is how they
  // get silently overwritten by someone who thought the field was empty. Read
  // from `entry` rather than live state, so the fold doesn't spring open again
  // while you're typing into it.
  const isNarrow = useIsNarrow();
  const [moreOpen, setMoreOpen] = useState(
    () => !isNarrow || Boolean(entry?.verdict || entry?.quote || entry?.notes),
  );
  // Above 640 the <summary> is hidden, so a resize must never leave it shut with
  // no way to reopen it. Only forces open — a phone user's own toggle stands.
  useEffect(() => { if (!isNarrow) setMoreOpen(true); }, [isNarrow]);

  const families = getEmotionFamilies();

  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [searching, setSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchTimeout = useRef(null);
  const resultsRef = useRef(null);
  const inputRef = useRef(null);
  const justSelected = useRef(false);
  const isEditing = useRef(!!entry?.id);

  useEffect(() => {
    if (isEditing.current) return;
    if (justSelected.current) { justSelected.current = false; return; }
    if (title.length < 3) { setSearchResults([]); setShowResults(false); return; }
    setSearching(true);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      try {
        const results = await searchBooks(title.trim());
        setSearchResults(results.slice(0, 5));
        setShowResults(results.length > 0);
        setSelectedIndex(-1);
      } catch { setSearchResults([]); }
      setSearching(false);
    }, 600);
    return () => clearTimeout(searchTimeout.current);
  }, [title]);

  useEffect(() => {
    const handleClick = (e) => {
      if (resultsRef.current && !resultsRef.current.contains(e.target) &&
          inputRef.current && !inputRef.current.contains(e.target)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selectBook = (book) => {
    justSelected.current = true;
    setTitle(book.title);
    setAuthor(book.author || "");
    setCoverUrl(book.cover_url || "");
    setIsbn(book.isbn || "");
    setShowResults(false);
    setSearchResults([]);
  };
  const useCustomTitle = () => {
    justSelected.current = true;
    setShowResults(false);
    setSearchResults([]);
  };
  const handleKeyDown = (e) => {
    if (!showResults || searchResults.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIndex((i) => Math.min(i + 1, searchResults.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIndex((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && selectedIndex >= 0) { e.preventDefault(); selectBook(searchResults[selectedIndex]); }
    else if (e.key === "Escape") { setShowResults(false); }
  };
  const isSelected = (id) => emotions.some((e) => e.id === id);
  const toggleEmo = (id) => setEmotions((prev) =>
    prev.some((e) => e.id === id)
      ? prev.filter((e) => e.id !== id)
      : [...prev, { id, strength: DEFAULT_STRENGTH }]);
  const setStrength = (id, strength) => setEmotions((prev) =>
    prev.map((e) => (e.id === id ? { ...e, strength } : e)));

  const strengths = emotions.map((e) => e.strength);
  const topStrength = strengths.length ? Math.max(...strengths) : null;

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      author: author.trim() || null,
      cover_url: coverUrl || null,
      isbn: isbn || null,
      // The shared slider is gone; keep the legacy scalar in sync as the strongest
      // felt emotion so downstream that still reads `intensity` doesn't break.
      intensity: topStrength ?? 5,
      emotions: emotions.map((e) => ({ emotion_id: e.id, strength: e.strength })),
      quote: quote.trim() || null,
      status,
      started_at: startedAt || null,
      finished_at: finishedAt || null,
      notes: notes.trim() || null,
      verdict: verdict || null,
      // A DNF reason means something on both ways of stopping. The backend's
      // own tally counts `paused` as put-down (dna_signals._DNF_STATUSES), so
      // asking only on `abandoned` left half the pile unexplained.
      dnf_reason: DNF_STATUSES.includes(status) ? (dnfReason || null) : null,
      // A closed book has no "how far in" — its status is the answer.
      progress: PROGRESS_STATUSES.includes(status) && progress !== ""
        ? Number(progress) : null,
    }, entry?.id || null);
  };
  const handleDelete = () => { if (entry?.id) onDelete(entry.id); };

  // Already on the shelf? Recomputed as they type — including for a title typed
  // straight in without ever touching the search, which is exactly the path that
  // produces accidental doubles. A memo, not state: `findDuplicate` returns a
  // fresh object each call, and storing that in state would re-render forever.
  //
  // This NEVER blocks the save. Rereading is real, and a shelf that argues with
  // you about your own second reading is worse than one with two rows in it. The
  // notice informs and offers the other entry; the primary button just stops
  // pretending it's the first copy.
  const duplicate = useMemo(
    () => (isEditing.current ? null : findDuplicate({ title, author, isbn })),
    [findDuplicate, title, author, isbn],
  );

  const isEdit = !!entry?.id;
  const primaryEmo = emotions[0] ? EMOTIONS[emotions[0].id] : null;
  const coverColor = primaryEmo?.color || "var(--oxblood)";
  const entryNo = entry?.id ? String(entry.id).slice(-3).padStart(3, "0") : "NEW";
  const firstWords = title ? title.split(" ").slice(0, 3).join(" ") : "";

  return (
    // Dialog semantics (role/aria-modal/focus trap) are owned by the wrapping
    // <Modal> now — don't duplicate them here. [F1.7]
    <div className="em-card">
      <div className="em-left" style={{ background: `linear-gradient(155deg, ${coverColor}, color-mix(in srgb, ${coverColor} 50%, #000))` }}>
        <div className="em-left-frame" />
        <div className="em-left-content">
          <div>
            <div className="em-left-eyebrow">ENTRY № {entryNo} · {isEdit ? "IN YOUR SHELF" : "NEW · UNSHELVED"}</div>
            <div className="em-left-author">{author || "—"}</div>
          </div>
          <div>
            <div className="em-left-title">{title || "Untitled volume"}</div>
            <div className="em-left-int-wrap">
              <div className="em-left-int-label">{topStrength != null ? "STRONGEST FELT" : "UNTAGGED"}</div>
              <div className="em-left-int-row">
                <span className="em-left-int-num">{topStrength ?? "—"}</span>
                {topStrength != null && <span className="em-left-int-of">/ 10</span>}
              </div>
              <div className="em-left-int-word">
                {topStrength != null
                  ? `${INTENSITY_LABELS[topStrength] || ""}.`
                  : `${emotions.length} feeling${emotions.length === 1 ? "" : "s"} tagged`}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="em-right">
        <button className="em-close" onClick={onClose} aria-label="Close">×</button>

        <div className="label" style={{ marginBottom: 8 }}>{isEdit ? `edit · entry no. ${entryNo}` : "new entry"}</div>
        <h2 className="em-h">
          {firstWords ? <>What did <em>{firstWords}</em> do to you?</> : "Begin a new entry."}
        </h2>

        <div className="em-field">
          <div className="label-sm em-field-label">title · author</div>
          <div className="em-search-wrap">
            <input
              ref={inputRef}
              className="em-input em-input-title"
              placeholder={isEdit ? "Book title" : "Search for a book…"}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onFocus={() => searchResults.length > 0 && setShowResults(true)}
              onKeyDown={handleKeyDown}
              autoComplete="off"
            />
            {searching && <Loader2 size={14} className="em-search-spinner" />}
            {showResults && (
              <div className="em-search-results" ref={resultsRef}>
                {searchResults.map((book, i) => (
                  <div
                    key={`${book.title}-${book.isbn || i}`}
                    className={`em-search-item ${i === selectedIndex ? "selected" : ""}`}
                    onClick={() => selectBook(book)}
                    onMouseEnter={() => setSelectedIndex(i)}
                  >
                    {book.cover_url ? (
                      <img className="em-search-cover" src={book.cover_url} alt="" onError={(e) => { e.target.style.display = "none"; }} />
                    ) : (
                      <div className="em-search-cover-placeholder"><BookOpen size={18} /></div>
                    )}
                    <div>
                      <div className="em-search-book-title">{book.title}</div>
                      <div className="em-search-book-author">
                        {book.author || "Unknown author"}{book.published_year && ` · ${book.published_year}`}
                      </div>
                    </div>
                  </div>
                ))}
                <div className="em-search-item em-search-custom" onClick={useCustomTitle}>
                  <div className="em-search-cover-placeholder"><Pencil size={18} /></div>
                  <div>
                    <div className="em-search-book-title">Use “{title}” as-is</div>
                    <div className="em-search-book-author">Add title &amp; author manually</div>
                  </div>
                </div>
              </div>
            )}
          </div>
          {!coverUrl && (
            <input
              className="em-input em-input-author"
              placeholder="Author"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
            />
          )}

          {/* aria-live, because it appears mid-typing rather than on an action —
              a sighted user sees it arrive; a screen reader user is told. */}
          {duplicate && (
            <div className="em-dupe" role="status" aria-live="polite">
              <div className="em-dupe-body">
                <div className="em-dupe-line">
                  {duplicate.reason === "title"
                    ? <>You have a <em>{duplicate.entry.title}</em> on the shelf already.</>
                    : <><em>{duplicate.entry.title}</em> is already on your shelf.</>}
                </div>
                {(() => {
                  const said = describeShelved(duplicate.entry);
                  return said ? <div className="em-dupe-meta">{said}</div> : null;
                })()}
                <p className="em-dupe-sub">
                  {duplicate.reason === "title"
                    ? "Same title, and one of the two has no author — so it might be a different book entirely."
                    : "Reading it again? A second entry keeps both records, and both sets of feelings, separate."}
                </p>
              </div>
              {onOpenExisting && (
                <button
                  type="button"
                  className="em-dupe-open"
                  onClick={() => onOpenExisting(duplicate.entry)}
                >
                  open that entry →
                </button>
              )}
            </div>
          )}
        </div>

        <div className="em-field">
          <div className="label-sm em-field-label">reading status</div>
          <div className="em-status" role="radiogroup" aria-label="Reading status">
            {STATUS_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={status === o.value}
                className={`em-status-opt ${status === o.value ? "active" : ""}`}
                onClick={() => setStatus(o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
          {status !== "want_to_read" && (
            <div className="em-dates">
              <label className="em-date">
                <span className="label-sm em-field-label">started</span>
                <input
                  type="date"
                  className="em-input"
                  value={startedAt || ""}
                  max={finishedAt || undefined}
                  onChange={(e) => setStartedAt(e.target.value)}
                />
              </label>
              {(status === "finished" || status === "reread") && (
                <label className="em-date">
                  <span className="label-sm em-field-label">finished</span>
                  <input
                    type="date"
                    className="em-input"
                    value={finishedAt || ""}
                    min={startedAt || undefined}
                    onChange={(e) => setFinishedAt(e.target.value)}
                  />
                </label>
              )}
            </div>
          )}

          {/* Roughly how far in — asked only of an open book, and only ever
              optional. A page number would mean asking which printing you hold;
              a rough share is the question a reader can actually answer. */}
          {PROGRESS_STATUSES.includes(status) && (
            <div className="em-progress">
              <label className="em-progress-label" htmlFor="em-progress-input">
                <span className="label-sm em-field-label">roughly how far in</span>
              </label>
              <input
                id="em-progress-input"
                type="range"
                className="em-progress-range"
                min={0}
                max={100}
                step={5}
                value={progress === "" ? 0 : progress}
                onChange={(e) => setProgress(e.target.value)}
              />
              <span className="em-progress-value">
                {progress === "" ? "not said" : `${progress}%`}
              </span>
              {progress !== "" && (
                <button type="button" className="em-progress-clear" onClick={() => setProgress("")}>
                  clear
                </button>
              )}
            </div>
          )}
        </div>

        <div className="em-field">
          <div className="label-sm em-field-label">what did it make you feel?</div>
          {/* Five doors → the emotions inside. Recognition, not recall. [Part A] */}
          <div className="em-fam-doors">
            {families.map(({ family, emotions: famEmos }) => {
              const count = famEmos.filter(([id]) => isSelected(id)).length;
              const open = openFamily === family;
              return (
                <button
                  key={family}
                  type="button"
                  className={`em-fam-door ${open ? "open" : ""} ${count ? "has-sel" : ""}`}
                  aria-expanded={open}
                  onClick={() => setOpenFamily(open ? null : family)}
                >
                  {family}
                  {count > 0 && <span className="em-fam-count">{count}</span>}
                </button>
              );
            })}
          </div>
          {openFamily && (
            <div className="em-emo-chips em-fam-chips">
              {(families.find((f) => f.family === openFamily)?.emotions || []).map(([id, e]) => {
                const active = isSelected(id);
                return (
                  <button
                    key={id}
                    type="button"
                    className={`chip ${active ? "active" : ""}`}
                    style={{ "--chip-c": e.color }}
                    aria-pressed={active}
                    onClick={() => toggleEmo(id)}
                  >
                    <span className="swatch" />
                    {e.label || id}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {emotions.length > 0 && (
          <div className="em-field">
            <div className="label-sm em-field-label">how strong was each?</div>
            <div className="em-strengths">
              {emotions.map(({ id, strength }) => {
                const e = EMOTIONS[id] || {};
                // Phrases are authored with their own casing — several now open
                // with a first-person "I", so we must not lowercase them here.
                const label = e.label || id;
                return (
                  <div className="em-strength-row" key={id}>
                    <span className="em-strength-name">
                      <span className="swatch" style={{ background: e.color }} />
                      {label}
                    </span>
                    <input
                      className="em-strength-range"
                      type="range"
                      min="1" max="10"
                      value={strength}
                      aria-label={`${label} strength`}
                      onChange={(ev) => setStrength(id, +ev.target.value)}
                    />
                    <span className="em-strength-num">{strength}</span>
                    <button
                      type="button"
                      className="em-strength-x"
                      aria-label={`Remove ${label}`}
                      onClick={() => toggleEmo(id)}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* DNF reason — only surfaces when the book was abandoned, so it stays
            in the main flow: it is already conditional, and folding a field
            that only appears when it is relevant hides it twice. [Part C] */}
        {DNF_STATUSES.includes(status) && (
          <OneTap
            label="why did you put it down?"
            options={DNF_OPTIONS}
            value={dnfReason}
            onChange={setDnfReason}
            wrap
          />
        )}

        {/* Fields stay mounted while folded — their values live in this
            component's state, so nothing is lost either way, but keeping them
            mounted means a collapse can't drop focus mid-typing. */}
        <details
          className="em-more"
          open={moreOpen}
          onToggle={(e) => setMoreOpen(e.currentTarget.open)}
        >
          <summary className="em-more-summary">
            <span>Add more details</span>
            <span className="em-more-chev" aria-hidden="true">⌄</span>
          </summary>

          {/* Verdict — a disambiguating one-tap. Optional, skippable. [Part C] */}
          <OneTap
            label="would you read it again?"
            options={VERDICT_OPTIONS}
            value={verdict}
            onChange={setVerdict}
          />

          <div className="em-field">
            <div className="label-sm em-field-label">the line that hit hardest</div>
            <textarea
              className="em-input em-textarea em-quote"
              placeholder="Optional — the quote you can't forget…"
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
              rows={2}
            />
          </div>

          <div className="em-field">
            <div className="label-sm em-field-label">private notes</div>
            <textarea
              className="em-input em-textarea"
              placeholder="Just for you — thoughts, context, where you were…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </details>

        <div className="em-footer">
          {isEdit ? (
            <button className="em-remove" onClick={handleDelete}>– remove from shelf</button>
          ) : <span />}
          <div style={{ display: "flex", gap: 10 }}>
            {isEdit && onCheckin && entry?.status === "reading" && (
              <button className="btn ghost em-checkin" onClick={() => onCheckin(entry)}>
                ◐ check in
              </button>
            )}
            {isEdit && onFinish && entry?.status !== "finished" && (
              <button className="btn ghost em-finish" onClick={() => onFinish(entry)}>
                ✦ finish this book
              </button>
            )}
            <button className="btn ghost" onClick={onClose}>cancel</button>
            {/* The label carries the warning, so the click doesn't have to be
                intercepted. "shelve it again" is an accurate description of what
                the button is about to do — no confirm step, no disabled state. */}
            <button className="btn brass" onClick={handleSave} disabled={!title.trim()}>
              {isEdit ? "save changes" : duplicate ? "shelve it again" : "shelve it"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
