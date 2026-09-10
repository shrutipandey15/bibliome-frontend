import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useJournal } from "../contexts/JournalContext";
import { EMOTIONS } from "../services/emotions";
import { saveCardAsImage } from "../utils/cardUtils";
import { getMyProfile, updateMyProfile, getInsight } from "../services/api";
import DNACard from "../components/DNACard";
import { cardArchetype } from "../services/dnaCard";
import CollectionsEditor from "../components/profile/CollectionsEditor";
import JoinedCollections from "../components/profile/JoinedCollections";
import { MIN_BOOKS } from "../components/dna/constants";
import { romanYear } from "../utils/roman";
import useIsNarrow from "../hooks/useIsNarrow";
import "./ProfilePage.css";

/**
 * The profile as private mirror — the self-view. [F2.8 / §Feature 2]
 *
 * "A reader's identity through their reading, not through metrics." Renders the
 * blueprint's information hierarchy from the composed /me/profile: identity strip
 * → Now → signature → collections → history. No follower counts, no
 * profile-view counts, no comparison — only substance.
 *
 * Two columns: the study on the left (who you are, what's open, what you've
 * shelved), the artifact on the right (the signature card, what you've reached,
 * what the shelf has noticed). Every figure on this page is counted from real
 * entries by `compose_profile` — where the backend has nothing to count, the
 * element is absent rather than zeroed or invented.
 */

// How much each section shows before it offers the rest. Nothing here scrolls
// inside itself: a section you can't Ctrl+F is a section you can't find things in.
const CAP = { nowReading: 3, recent: 6, margins: 6 };
// "from your margins" can hold a lot of entries and each is a tall block, so it
// reveals in steps — one tap that dumped all of them added five screens of page.
const MARGINS_STEP = 6;

const MONTH = { month: "long", year: "numeric" };

/** First letter or digit of the name, for the masthead avatar. "·" when there's
 *  nothing real to show — never a stranger's initial. */
function initialOf(profile) {
  const s = (profile.display_name || profile.handle || "").trim();
  const ch = [...s].find((c) => /\p{L}|\p{N}/u.test(c));
  return ch ? ch.toUpperCase() : "·";
}

function monthYear(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString(undefined, MONTH);
}

/** A figure only renders when there is something real behind it. */
function Figure({ value, label, quiet = false }) {
  if (value == null) return null;
  return (
    <div className={`pf-figure${quiet ? " pf-figure--quiet" : ""}`}>
      <div className="pf-figure-n">{value}</div>
      <div className="pf-figure-label">{label}</div>
    </div>
  );
}

function SectionHead({ children, aside }) {
  return (
    <div className="pf-head">
      <span>{children}</span>
      {aside && <span className="pf-head-aside">{aside}</span>}
    </div>
  );
}

/**
 * A section that folds on a phone and runs inline on the desk.
 *
 * The archive sections — the shelf, what you've reached, the lines you kept —
 * are the bulk of this page and the least time-sensitive part of it. On a desk
 * they sit in two columns and cost nothing; on a phone they are five screens
 * stacked below the fold, so getting from your signature to your margins means
 * scrolling past everything in between whether you wanted it or not.
 *
 * `<details>` rather than a hand-rolled toggle: it brings the disclosure
 * semantics, keyboard operation and find-in-page behaviour already correct —
 * Ctrl+F still reaches a closed section's text and opens it.
 *
 * A DOM swap rather than a media query, because the desk version must not
 * change at all: its section head carries a real button ("all 69 →"), which
 * inside a <summary> would be a click fighting the disclosure for the same tap.
 * Swapping also means a rotate from portrait to landscape re-renders the plain
 * section, so nothing can be stranded closed at a width with no control to
 * open it.
 */
function FoldSection({ narrow, title, aside, phoneAside, defaultOpen = false, className = "", children }) {
  const [open, setOpen] = useState(defaultOpen);

  if (!narrow) {
    return (
      <section className={className}>
        <SectionHead aside={aside}>{title}</SectionHead>
        {children}
      </section>
    );
  }

  return (
    <details className={`${className} pf-fold`} open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="pf-head pf-fold-summary">
        <span>{title}</span>
        <span className="pf-fold-right">
          {/* A closed section should still say what is inside it — otherwise
              folding trades a long page for a page that tells you nothing. */}
          {phoneAside && <span className="pf-head-aside">{phoneAside}</span>}
          <span className="pf-fold-chev" aria-hidden="true">⌄</span>
        </span>
      </summary>
      {children}
    </details>
  );
}

/**
 * The show-more control, which is also the show-less control.
 *
 * Expanding used to be one-way: a reader who opened all 24 kept lines had no way
 * back to two except reloading the page. Same button, both directions.
 */
function MoreToggle({ open, onToggle, hidden, label }) {
  if (hidden <= 0) return null;
  return (
    <button className="pf-more" onClick={onToggle} aria-expanded={open}>
      {open ? "← show fewer" : `+${hidden} more ${label} →`}
    </button>
  );
}

/** A book in the recently-shelved grid: cover, title, and what it pulled. */
function ShelfBook({ book, onClick }) {
  const emo = book.dominant_emotion ? EMOTIONS[book.dominant_emotion] : null;
  return (
    <button type="button" className="pf-shelf-book" onClick={onClick}>
      {book.cover_url ? (
        <img className="pf-shelf-cover" src={book.cover_url} alt="" loading="lazy" onError={(e) => { e.target.style.visibility = "hidden"; }} />
      ) : (
        <span className="pf-shelf-cover pf-shelf-cover--none" style={{ background: emo?.color || "var(--ink-ghost)" }} />
      )}
      <span className="pf-shelf-title">{book.title}</span>
      {book.author && <span className="pf-shelf-author">{book.author}</span>}
      {emo && (
        <span className="pf-shelf-emo">
          <span className="pf-dot" style={{ background: emo.color }} />
          {(emo.name || emo.label || "").toLowerCase()}
        </span>
      )}
    </button>
  );
}

/** A book in progress. The caption is the reader's own last check-in — never a
 *  progress bar, because nothing in the model knows how far through you are. */
function OpenBook({ book }) {
  const emo = book.dominant_emotion ? EMOTIONS[book.dominant_emotion] : null;
  const checkin = book.last_checkin;
  const checkinEmo = checkin?.emotion ? EMOTIONS[checkin.emotion] : null;

  return (
    <div className="pf-open">
      {book.cover_url ? (
        <img className="pf-open-cover" src={book.cover_url} alt="" loading="lazy" onError={(e) => { e.target.style.visibility = "hidden"; }} />
      ) : (
        <span className="pf-open-cover pf-open-cover--none" style={{ background: emo?.color || "var(--ink-ghost)" }} />
      )}
      <div className="pf-open-meta">
        <div className="pf-open-title">{book.title}</div>
        {book.author && <div className="pf-open-author">{book.author}</div>}
        {/* Only when the reader has actually said. `null` is "hasn't said", not
            0% — a bar sitting at zero would be an answer they never gave. */}
        {book.progress != null && (
          <div className="pf-open-progress">
            <span
              className="pf-open-track"
              role="progressbar"
              aria-valuenow={book.progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${book.title} — ${book.progress}% in`}
            >
              <span className="pf-open-fill" style={{ width: `${book.progress}%`, background: emo?.color || "var(--brass)" }} />
            </span>
            <span className="pf-open-pct">{book.progress}%</span>
          </div>
        )}
        {checkinEmo && (
          <div className="pf-open-weather">
            <span className="pf-dot" style={{ background: checkinEmo.color }} />
            {(checkinEmo.name || checkinEmo.label || "").toLowerCase()}
            {checkin.at && <span className="pf-open-when"> · {monthYear(checkin.at)}</span>}
          </div>
        )}
      </div>
      {checkin?.note && <div className="pf-open-note">“{checkin.note}”</div>}
    </div>
  );
}

/**
 * A study with nothing in it yet.
 *
 * Every other section on this page is computed from entries, so on day one they
 * all correctly render nothing — which leaves a name floating on an empty page
 * and no clue that the room fills itself. This says what will live here and
 * sends them to the one action that starts it. It is not a fake preview: no
 * sample figures, no greyed-out placeholder card pretending to be a signature.
 */
function EmptyStudy({ onStart }) {
  return (
    <section className="pf-empty">
      <div className="label pf-empty-eyebrow">· nothing shelved yet ·</div>
      <p className="pf-empty-lead">
        This room is written by your reading. Log one book and it starts filling itself.
      </p>
      <ul className="pf-empty-list">
        <li><b>your figures</b> — volumes, registers felt, how hard things land, what you set down</li>
        <li><b>your signature</b> — the card, after {MIN_BOOKS} books have something to say</li>
        <li><b>your margins</b> — the lines you keep, one per book</li>
        <li><b>your collections</b> — shelves you name yourself, private unless you say otherwise</li>
      </ul>
      <button className="btn brass" onClick={onStart}>log your first book</button>
    </section>
  );
}

/** The rail before there's a signature to put in it. Says what's missing and how
 *  far off it is — never a blurred or invented card. */
function SignaturePending({ bookCount }) {
  const left = Math.max(0, MIN_BOOKS - bookCount);
  return (
    <section>
      <SectionHead>your signature</SectionHead>
      <p className="pf-pending">
        {left === 0
          ? "Your card is being read from your shelf — check the DNA tab."
          : `${left} more ${left === 1 ? "book" : "books"} and there is enough here to draw your card.`}
      </p>
    </section>
  );
}

function BioEditor({ bio, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(bio || "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try { await onSave(draft.trim() || null); setEditing(false); }
    finally { setBusy(false); }
  };

  if (!editing) {
    return (
      <div className="pf-bio">
        {bio ? <p className="pf-bio-text">{bio}</p> : <p className="pf-bio-empty">Add a line about how you read.</p>}
        <button className="pf-bio-edit" onClick={() => { setDraft(bio || ""); setEditing(true); }}>
          {bio ? "edit" : "+ add"}
        </button>
      </div>
    );
  }
  return (
    <div className="pf-bio">
      <textarea
        className="pf-bio-input"
        value={draft}
        maxLength={300}
        rows={2}
        aria-label="Your bio"
        placeholder="e.g. reads for catharsis; drawn to grief and awe"
        onChange={(e) => setDraft(e.target.value)}
      />
      <div className="pf-bio-actions">
        <button className="btn ghost" onClick={() => setEditing(false)} disabled={busy}>cancel</button>
        <button className="btn brass" onClick={save} disabled={busy}>{busy ? "saving…" : "save"}</button>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { entries } = useJournal();
  const narrow = useIsNarrow();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [insight, setInsight] = useState(null);
  const [showAllRecent, setShowAllRecent] = useState(false);
  const [marginsCount, setMarginsCount] = useState(CAP.margins);
  const [showAllOpen, setShowAllOpen] = useState(false);
  const cardRef = useRef(null);

  const load = useCallback(async () => {
    const p = await getMyProfile();
    setProfile(p);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // The shelf's own observation. Null-able by contract — the backend says nothing
  // rather than inventing a sentence, and so does this panel.
  useEffect(() => {
    let alive = true;
    getInsight().then((i) => { if (alive) setInsight(i?.sentence || null); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const saveBio = async (bio) => {
    const updated = await updateMyProfile({ bio });
    setProfile(updated);
  };

  if (loading) {
    return <div className="loading-screen"><div className="loading-glyph">◈</div><div className="loading-text">composing your profile…</div></div>;
  }
  if (!profile) {
    return (
      <div className="pf-page">
        <div className="empty-state">
          <div className="empty-glyph">◈</div>
          <div className="empty-title">Profile unavailable</div>
          <button className="btn" style={{ marginTop: 16 }} onClick={() => navigate("/")}>back to shelf</button>
        </div>
      </div>
    );
  }

  const disposition = profile.personality_type;
  const nowReading = profile.now_reading || [];
  const recent = profile.recent || [];
  const margins = profile.margins || [];
  const bookCount = profile.book_count ?? 0;

  // The cached signature carries the archetype; the live payload carries this
  // reader's own register tally and how many readers share the archetype today.
  // Both move independently of the cache, so they are merged in at render.
  const signature = cardArchetype(profile.signature)
    ? {
      ...profile.signature,
      book_count: bookCount,
      emotion_counts: profile.emotion_counts,
      archetype_share: profile.archetype_share,
    }
    : null;

  // The earliest date the shelf can evidence, not the signup date — an imported
  // decade of reading must not sit under "since 2026". Falls back to the join
  // date for a payload cached before the field existed.
  const sinceRaw = profile.shelf_since || profile.member_since;
  const since = sinceRaw ? new Date(sinceRaw) : null;
  const sinceRoman = since && !Number.isNaN(since.getTime()) ? romanYear(since.getFullYear()) : null;

  // Day one. Every section below is computed from entries, so they all correctly
  // render nothing — which is exactly why the page needs to say so itself.
  const empty = bookCount === 0;

  const openShown = showAllOpen ? nowReading : nowReading.slice(0, CAP.nowReading);
  const recentShown = showAllRecent ? recent : recent.slice(0, CAP.recent);
  const marginsShown = margins.slice(0, marginsCount);

  return (
    <div className="pf-page">
      <div className="pf-topbar">
        <button className="btn ghost" onClick={() => navigate("/")}>← back to shelf</button>
      </div>

      {/* ── Masthead: a decorative band, the avatar straddling its edge, and an
          identity row — figures on one side, name in the middle, the way into
          the full reading on the other. A strong full-width header is what lets
          the two-column body below read as a content area rather than as two
          piles. ── */}
      <header className="pf-masthead">
        <div className="pf-band" aria-hidden="true" />
        <div className="pf-mast-row">
          {!empty ? (
            <div className="pf-mast-figures">
              <Figure value={bookCount} label={bookCount === 1 ? "volume" : "volumes"} />
              <Figure value={profile.registers_felt} label="registers felt" />
              <Figure value={profile.avg_intensity} label="avg intensity" />
              <Figure value={profile.set_down} label="set down" quiet />
            </div>
          ) : <div />}

          <div className="pf-mast-id">
            <div className="pf-avatar" aria-hidden="true">{initialOf(profile)}</div>
            <h1 className="pf-name">{profile.display_name || `@${profile.handle}`}</h1>
            {disposition && <div className="pf-disposition">{disposition}</div>}
            <div className="pf-handle">
              <span>@{profile.handle}</span>
              {sinceRoman && <span> · reading since {sinceRoman}</span>}
            </div>
          </div>

          <div className="pf-mast-actions">
            <button className="btn ghost" onClick={() => navigate("/settings")}>edit profile</button>
            <button className="pf-says-link" onClick={() => navigate("/?view=dna")}>
              read the full DNA →
            </button>
          </div>
        </div>
      </header>

      {empty ? (
        <EmptyStudy onStart={() => navigate("/")} />
      ) : (
        <div className="pf-body">
          {/* ── Left: who you are and what you've kept ── */}
          <aside className="pf-aside">
            <section className="pf-intro">
              <SectionHead>introduction</SectionHead>
              <BioEditor bio={profile.bio} onSave={saveBio} />
              {/* The shelf's own observation — one quiet line. Null-able by contract. */}
              {insight && <p className="pf-says-line">“{insight}”</p>}
            </section>

            {(signature || bookCount > 0) && (
              <div className="pf-sig-card">
                {signature ? (
                  <DNACard
                    ref={cardRef}
                    profile={signature}
                    username={profile.handle}
                    size="small"
                    allowShare
                    onSave={() => saveCardAsImage(cardRef.current, profile.handle)}
                  />
                ) : <SignaturePending bookCount={bookCount} />}
              </div>
            )}

          </aside>

          {/* ── Right: what you're reading ── */}
          <div className="pf-main">
            {nowReading.length > 0 && (
              <section className="pf-section pf-section--flush">
                <SectionHead aside={nowReading.length > 1 ? `${nowReading.length} open at once` : null}>now reading</SectionHead>
                <div className="pf-opens">
                  {openShown.map((b) => <OpenBook key={b.entry_id} book={b} />)}
                </div>
                <MoreToggle
                  open={showAllOpen}
                  onToggle={() => setShowAllOpen((v) => !v)}
                  hidden={nowReading.length - CAP.nowReading}
                  label="open"
                />
              </section>
            )}

            {recent.length > 0 && (
              <FoldSection
                narrow={narrow}
                className="pf-section"
                title="recently shelved"
                aside={<button className="pf-head-link" onClick={() => navigate("/")}>all {bookCount} →</button>}
                phoneAside={`${bookCount}`}
                defaultOpen
              >
                <div className="pf-shelf-grid">
                  {recentShown.map((b) => <ShelfBook key={b.entry_id} book={b} onClick={() => navigate("/")} />)}
                </div>
                <MoreToggle
                  open={showAllRecent}
                  onToggle={() => setShowAllRecent((v) => !v)}
                  hidden={recent.length - CAP.recent}
                  label=""
                />
              </FoldSection>
            )}

            {/* Collections you own and curate. */}
            <section className="pf-section">
              <SectionHead>collections</SectionHead>
              <CollectionsEditor
                collections={profile.collections || []}
                shelf={entries}
                onChanged={load}
              />
            </section>

            {/* Collections OTHER people own that you joined — renders nothing
                when you've joined none. [#5/#6] */}
            <section className="pf-section pf-section--joined">
              <JoinedCollections />
            </section>
          </div>
        </div>
      )}

      {/* An empty shelf can still have joined someone else's collection. */}
      {empty && (
        <section className="pf-section pf-section--joined">
          <JoinedCollections />
        </section>
      )}

      {/* From your margins — the lines you kept, one per book. Full width below
          both columns: kept lines run long and there can be many, so in a
          half-width column they tower over what's beside them. Owner-only by
          contract (the backend sends [] to anyone else). Reveals in steps. */}
      {!empty && margins.length > 0 && (
        <FoldSection
          narrow={narrow}
          className="pf-section pf-margins-section"
          title="from your margins"
          aside="lines you kept"
          phoneAside={`${margins.length} kept`}
        >
          <div className="pf-margins">
            {marginsShown.map((m) => {
              const emo = m.dominant_emotion ? EMOTIONS[m.dominant_emotion] : null;
              return (
                <blockquote key={m.entry_id} className="pf-margin" style={{ borderLeftColor: emo?.color || "var(--brass)" }}>
                  <p className="pf-margin-text">“{m.quote}”</p>
                  <footer className="pf-margin-cite">
                    {m.title}{monthYear(m.at) ? ` · ${monthYear(m.at)}` : ""}
                  </footer>
                </blockquote>
              );
            })}
          </div>
          {marginsShown.length < margins.length ? (
            <button className="pf-more" onClick={() => setMarginsCount((c) => c + MARGINS_STEP)}>
              +{Math.min(MARGINS_STEP, margins.length - marginsShown.length)} more from your margins →
            </button>
          ) : marginsCount > CAP.margins ? (
            <button className="pf-more" onClick={() => setMarginsCount(CAP.margins)}>← show fewer</button>
          ) : null}
        </FoldSection>
      )}

      <footer className="pf-footer">
        <span>bibliome.app</span>
        <span>your study · @{profile.handle}</span>
      </footer>
    </div>
  );
}
