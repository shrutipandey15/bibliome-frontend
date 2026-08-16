import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from "react";
import { Settings, MoreHorizontal, Sun, Moon, User, Sparkles, Plus, ChevronDown } from "lucide-react";
import { Routes, Route, useParams, Link, useNavigate, Navigate, Outlet, useSearchParams } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import { useJournal, JournalProvider } from "./contexts/JournalContext";
import { JournalKeyProvider } from "./contexts/JournalKeyContext";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";
import useIsNarrow from "./hooks/useIsNarrow";
import ThemeToggle from "./components/ThemeToggle";
import TabBar from "./components/TabBar";
import { PrivateJournalProvider } from "./contexts/PrivateJournalContext";
import { saveCardAsImage } from "./utils/cardUtils";
import { getSharedDNA, getEmotionVocab, setReadFor } from "./services/api";
import AuthPage from "./pages/AuthPage";
import BookCard from "./components/BookCard";
import EmptyShelf from "./components/EmptyShelf";
import ShelfError from "./components/ShelfError";
import EntryModal from "./components/EntryModal";
import TbrQuickAdd from "./components/TbrQuickAdd";
import Modal from "./components/Modal";
import FinishFlow from "./components/FinishFlow";
import CheckinPanel from "./components/CheckinPanel";
import MirrorCard from "./components/MirrorCard";
import ImportModal from "./components/ImportModal";
import WelcomeModal from "./components/WelcomeModal";
import NotificationCenter from "./components/notifications/NotificationCenter";
import ResonanceMark from "./components/resonance/ResonanceMark";
import DNACard from "./components/DNACard";
import { cardArchetype } from "./services/dnaCard";
import DNAView from "./components/dna/DNAView";
import ReadForQuestion from "./components/dna/ReadForQuestion";
import { MIN_BOOKS, openedBooks } from "./components/dna/constants";
import LandingPage from "./pages/LandingPage";
import { Patterns } from "./components/Panels";
import ErrorBoundary from "./components/ErrorBoundary";
import Shelf from "./components/Shelf";
import { ShelfDecoration } from "./components/Shelf";
import { EMO_LIST, EMOTIONS, getPrimaryEmotion, hydrateEmotions } from "./services/emotions";
import { clearCache } from "./services/offline";
import { findDuplicateEntry } from "./utils/findDuplicate";
import { takeInvite } from "./services/pendingInvite";
import "./App.css";

const AdminPage = lazy(() => import("./pages/AdminPage"));
const PublicProfile = lazy(() => import("./pages/PublicProfile"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const EchoesPage = lazy(() => import("./pages/EchoesPage"));
const ResonancePage = lazy(() => import("./pages/ResonancePage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const JournalPage = lazy(() => import("./pages/JournalPage"));
const LegalPage = lazy(() => import("./pages/LegalPage"));
const JoinCollectionPage = lazy(() => import("./pages/JoinCollectionPage"));


function SharedProfile() {
  const { token } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user: currentUser } = useAuth();

  useEffect(() => {
    setLoading(true);
    getSharedDNA(token)
      .then((data) => { setProfile(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="loading-screen"><div className="loading-glyph">◈</div><div className="loading-text">Deciphering Link...</div></div>;
  // Two different nulls behind one screen: a revoked/expired token, and a live
  // link belonging to a reader whose DNA isn't ready yet (the backend 404s that
  // case rather than serving a card the app itself wouldn't show them).
  if (!cardArchetype(profile)) {
    return (
      <div className="empty-state empty-state-full">
        <div className="empty-glyph">?</div>
        <div className="empty-title">Nothing to see here</div>
        <div className="empty-sub">This link has expired, or its reader's DNA isn't ready yet.</div>
        <Link to="/" className="back-btn">Go Home</Link>
      </div>
    );
  }

  return (
    <div className="app public-view">
      <header className="header">
        <div className="brand">
          {/* `.logo` had no stylesheet rule anywhere — this header rendered the
              brand as unstyled body text. Same wordmark class as the reading room. */}
          <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}><div className="rr-logo">Biblio<em>me</em></div></Link>
        </div>
        <div className="header-right">
          <Link to="/" className="gen-btn">{currentUser ? "My Dashboard" : "Get Your Own"}</Link>
        </div>
      </header>
      <main className="main" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
         <div className="dna-reveal-label" style={{ marginTop: 0 }}>Reading Personality</div>
         {/* The endpoint returns `handle`, never `username` — this read the wrong
             key and so every shared card was signed @READER. */}
         <DNACard profile={profile} username={profile.handle || "Reader"} allowShare={false} />
      </main>
    </div>
  );
}

function buildDashboardStats(entries) {
  const total = entries.length;
  const intensities = entries.map((e) => e.intensity).filter((v) => typeof v === "number");
  const avg = intensities.length ? (intensities.reduce((a, b) => a + b, 0) / intensities.length).toFixed(1) : "—";
  // emotion frequency
  const freq = {};
  entries.forEach((e) => (e.emotions || []).forEach((em) => {
    const id = em.emotion_id;
    if (!id) return;
    freq[id] = (freq[id] || 0) + 1;
  }));
  const topEmotion = Object.entries(freq).sort((a, b) => b[1] - a[1])[0] || [null, 0];
  // How many of the eighteen registers this shelf has ever reached for. The
  // fourth figure the strip needed: real, countable here, and the same one the
  // study prints, so the two surfaces agree.
  const registers = Object.keys(freq).length;
  // No books/month here. It divided by the shelf's date span in months, which is
  // near-zero for a shelf built in one sitting — it rendered as 57387453.9. The
  // rate is not worth showing on the shelf; the backend's own guarded figure
  // (dna_engine.books_per_month, floored at a 30-day window) is the only one.
  return { total, avg, topEmotion, registers };
}

/**
 * The letter in the avatar. Every reader used to get an "R" — the fallback was
 * a hardcoded letter, so the moment `display_name` was blank rather than absent
 * (`""` is falsy but so is `undefined`, and either way the chain fell through)
 * or the user had not loaded yet, the avatar showed someone else's initial with
 * total confidence. A letter is a claim about who you are, so it now comes from
 * a real field or not at all: name → username → the local part of the email,
 * and the first LETTER OR DIGIT in it, skipping the quotes, emoji and leading
 * punctuation that display names collect. With nothing to go on we render "·",
 * which reads as "not known yet" rather than as a stranger's initial.
 */
function avatarInitial(user) {
  const source = [user?.display_name, user?.username, user?.email?.split("@")[0]]
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .find(Boolean);
  if (!source) return "·";
  const letter = [...source].find((ch) => /\p{L}|\p{N}/u.test(ch));
  return letter ? letter.toUpperCase() : "·";
}

function ReadingRoomHeader({ user, tab, onAddBook, onShelveBook, onRevealDNA, canGenerate, generating, navigate, entriesCount }) {
  const initial = avatarInitial(user);
  const [menuOpen, setMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const showDNA = canGenerate && tab !== "dna";

  // Every sheet row closes the sheet on the way out. Navigations unmount it
  // anyway, but Read DNA and the theme toggle both leave the reader on this
  // page, and a sheet still sitting over the thing you just asked to see is
  // the most common way this pattern goes wrong.
  const fromSheet = (fn) => () => { setMenuOpen(false); fn(); };

  return (
    <div className="rr-header">
      <div className="rr-header-row">
        <div className="rr-brand">
          <div className="rr-logo">Biblio<em>me</em></div>
          <div className="rr-brand-meta">
            <div className="label rr-volume">vol. iv · {new Date().getFullYear()}</div>
            <div className="rr-tagline">{user?.display_name || user?.username || "your"}'s reading journal</div>
          </div>
        </div>
        <div className="rr-actions">
          {/* Wide screens only — below 640 this is the .rr-fab above the tab
              bar instead. It never goes into the `⋯` sheet, though: it is the
              only control here that CREATES anything, and burying the one
              action that makes the app worth opening is how a reader ends up
              with an empty shelf. */}
          <button className="btn ghost rr-add-btn rr-wide-only" onClick={onAddBook}>
            <span className="rr-add-btn-label">+ ADD BOOK</span>
          </button>
          {/* Shelving is a different act from logging a reading, so it gets its
              own control rather than a mode inside the add-book modal [B2.2]. */}
          <button className="btn ghost rr-add-btn rr-wide-only" onClick={onShelveBook}>
            <span className="rr-add-btn-label">+ TO READ</span>
          </button>
          {showDNA && (
            <button className="btn brass rr-dna-btn rr-wide-only" onClick={onRevealDNA} disabled={generating}>
              <span className="rr-dna-btn-verb">{generating ? "Reading" : "Read"}</span>
              <span className="rr-dna-btn-noun">DNA</span>
            </button>
          )}
          {/* Resonance's whole entry point. Renders NOTHING unless the reader
              has a match — no tab, no permanent affordance, no count. A reader
              who has never matched will not know the feature is there, which is
              the intended amount of pressure. */}
          <ResonanceMark />
          {/* Stays out of the overflow sheet on purpose. It carries an unread
              dot that has to be visible to mean anything, and it opens a Modal
              of its own — nesting that inside the sheet would mean two stacked
              dialogs and two focus traps. It is also the single instance that
              owns the notification poll; a second copy inside the sheet would
              double the request rate. */}
          <NotificationCenter />
          <ThemeToggle className="rr-theme-toggle rr-wide-only" />
          {/* Settings was behind the avatar and the study behind a `◐`, which is
              backwards: everywhere else on the web the avatar is you, and a gear
              is settings. Nobody was going to read a half-filled circle as "your
              study", and it sat beside three other unlabelled glyphs. */}
          <button
            className="rr-theme-toggle rr-wide-only"
            onClick={() => navigate("/settings")}
            title="Settings"
            aria-label="Settings"
          >
            <Settings size={17} />
          </button>
          <button
            className="rr-avatar rr-wide-only"
            onClick={() => navigate("/me")}
            title="Your study — profile, collections and your signature"
            aria-label="Your study"
          >
            {initial}
          </button>
          {/* The mirror image of .rr-wide-only: only ever visible once the four
              controls above have been folded away. */}
          <button
            className="rr-theme-toggle rr-more-btn"
            onClick={() => setMenuOpen(true)}
            aria-haspopup="dialog"
            title="More"
            aria-label="More"
          >
            <MoreHorizontal size={18} />
          </button>
        </div>
      </div>
      <TabBar active={tab} shelfCount={entriesCount} />

      {/* A bottom sheet rather than a dropdown. Modal already gives us the focus
          trap, Escape, backdrop-press and focus restore, and .rr-modal-card
          already becomes a docked sheet under 640 — the same treatment
          NotificationCenter uses, so this reads as an existing pattern rather
          than a new one. It also buys thumb reach and rows that are naturally
          44px+, which a dropdown anchored under the header gives up. */}
      {menuOpen && (
        <Modal
          onClose={() => setMenuOpen(false)}
          ariaLabel="More actions"
          className="rr-modal-card"
          backdropClassName="rr-modal-backdrop"
        >
          <div className="rr-sheet">
            <div className="label rr-sheet-head">more</div>
            {showDNA && (
              <button className="rr-sheet-item" onClick={fromSheet(onRevealDNA)} disabled={generating}>
                <Sparkles size={18} />
                <span>{generating ? "Reading your DNA…" : "Read your DNA"}</span>
              </button>
            )}
            <button className="rr-sheet-item" onClick={fromSheet(() => navigate("/me"))}>
              <User size={18} />
              <span>Your study</span>
            </button>
            <button className="rr-sheet-item" onClick={fromSheet(() => navigate("/settings"))}>
              <Settings size={18} />
              <span>Settings</span>
            </button>
            {/* Not <ThemeToggle/>: that renders a bare icon button, which in a
                sheet of labelled rows would be the one target you can't read.
                Same context, same toggleTheme — just given a label. */}
            <button className="rr-sheet-item" onClick={fromSheet(toggleTheme)}>
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
              <span>Switch to {theme === "dark" ? "Vellum" : "Lamplight"}</span>
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ReadingRoomHero({ entries, stats, user, onBookClick, onRevealDNA, canGenerate, generating }) {
  const featured = entries.slice(0, 5);
  const top = EMOTIONS[stats.topEmotion?.[0]];
  const topCount = stats.topEmotion?.[1] ?? 0;
  const total = stats.total;
  const number = total > 0 ? total : 0;
  return (
    <div className="rr-hero">
      <div>
        <div className="label" style={{ marginBottom: 16 }}>currently shelving · entry no. {String(number).padStart(3, "0")}</div>
        <h1>
          {number > 0 ? `${number} volume${number === 1 ? "" : "s"},` : "An empty room,"}<br />
          <em>{number > 0 ? "one quiet" : "one waiting"}</em> year.
        </h1>
        {/* Countable, or nothing. The old dek asserted a mood ("keeping the lights
            on for a friend who isn't home yet") and a "spike of catharsis" that
            were hardcoded, not derived — equally true of any reader. [F-DNA-1] */}
        <p className="rr-hero-dek">
          {top ? (
            <>Most tagged:{" "}
              <span style={{ color: top.color, fontWeight: 600 }}>{top.name}</span>
              {" "}— {topCount} of {total} {total === 1 ? "book" : "books"}.
            </>
          ) : (
            <>Begin with one book. The shelf grows with you. Each entry is a small confession in the margin of your year.</>
          )}
        </p>
        <div className="rr-hero-cta">
          {canGenerate && (
            <button className="btn brass" onClick={onRevealDNA} disabled={generating} style={{ fontSize: 13 }}>
              <span style={{ fontStyle: "italic", fontFamily: "var(--font-display)" }}>Read</span> your DNA →
            </button>
          )}
          <button className="btn ghost rr-browse-btn" style={{ fontSize: 12 }} onClick={() => document.querySelector(".rr-stacks")?.scrollIntoView({ behavior: "smooth" })}>
            browse the stacks ↓
          </button>
        </div>
        <div className="rr-hero-aside">
          <span className="quote">“</span>
          <span className="aside-text">Every book changed you in ways you can't articulate. This tries.</span>
        </div>
      </div>

      <div className="rr-hero-shelf-wrap">
        <div className="label-sm rr-hero-shelf-label">◈ in rotation</div>
        {featured.length > 0 ? (
          <Shelf
            entries={featured}
            leans={{ 1: "left", 3: "right" }}
            decoration={<ShelfDecoration kind="stack" />}
            onBookClick={onBookClick}
          />
        ) : (
          <Shelf entries={[]} decoration={<ShelfDecoration kind="bust" />} />
        )}
        {featured.length > 0 && <div className="rr-hero-click">↑ click any spine</div>}
      </div>
    </div>
  );
}

function ReadingRoomStatStrip({ stats }) {
  const top = EMOTIONS[stats.topEmotion?.[0]] || { name: "—", color: "var(--ink-quiet)" };
  // Four figures across four columns. There were three in a grid declared for
  // six, so the strip crowded into the left half and left a bare rule hanging in
  // the space where the missing ones would have been.
  const items = [
    { l: "volumes",        v: String(stats.total).padStart(2, "0") },
    { l: "registers felt", v: String(stats.registers ?? 0).padStart(2, "0"), suf: `/${EMO_LIST.length}` },
    { l: "avg intensity",  v: stats.avg, suf: "/10" },
    { l: "top emotion",    v: top.name, color: top.color },
  ];
  return (
    <div className="rr-statstrip">
      {items.map((s, i) => (
        <div className="rr-stat" key={i}>
          <div className="label-sm" style={{ marginBottom: 2 }}>{s.l}</div>
          <div className="rr-stat-val" style={{ color: s.color || "var(--ink)" }}>
            {s.v}{s.suf && <span className="rr-stat-suf">{s.suf}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function ReadingRoomFilterBar({ entries, filter, onFilter, sort, onSort, view, onView, search, onSearch }) {
  const presentEmotions = EMO_LIST.filter(([id]) => entries.some((e) => e.emotions?.some((em) => em.emotion_id === id)));
  const [sheetOpen, setSheetOpen] = useState(false);
  const activeEmotion = filter ? EMOTIONS[filter] : null;

  const countFor = (id) => entries.filter((b) => b.emotions?.some((em) => em.emotion_id === id)).length;

  // One chip, rendered into both the desktop row and the mobile sheet, so the
  // two can't drift in appearance or in what a tap does. `id === null` is the
  // "all" chip, which clears rather than toggles.
  const chip = (id, name, color, { closeSheet = false } = {}) => (
    <button
      key={id ?? "all"}
      className={`chip ${(id === null ? !filter : filter === id) ? "active" : ""}`}
      style={{ "--chip-c": color }}
      onClick={() => {
        onFilter(id === null ? null : (filter === id ? null : id));
        if (closeSheet) setSheetOpen(false);
      }}
    >
      <span className="swatch" />
      {name}
      {id !== null && <span className="chip-count">·{countFor(id)}</span>}
    </button>
  );

  return (
    <div className="rr-filterbar">
      <div className="rr-search">
        <span className="rr-search-glyph" aria-hidden="true">⌕</span>
        <input
          className="rr-search-input"
          type="search"
          placeholder="search your shelf…"
          aria-label="Search your library by title or author"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>
      <div className="label rr-filter-label">filter by feeling</div>
      {/* `display: contents` on wide screens, so these stay direct flex children
          of .rr-filterbar and the desktop bar is EXACTLY as it was — same nine
          chips, same wrap. Hidden outright below 640, where the trigger and the
          sheet below take over. */}
      <div className="rr-chiprow">
        {chip(null, "all", "var(--ink)")}
        {presentEmotions.slice(0, 9).map(([id, e]) => chip(id, e.name, e.color))}
      </div>

      {/* Mobile only. A horizontal scroll row was the wrong shape for this: it
          grows without bound as the reader unlocks more of the vocabulary (18
          registers), and finding one feeling means scrubbing sideways past the
          others with no sense of how many are left. A sheet shows the whole set
          at once, wraps instead of scrolling, and costs one tap. */}
      <button
        className="rr-filter-trigger"
        onClick={() => setSheetOpen(true)}
        aria-haspopup="dialog"
      >
        <span className="rr-filter-trigger-label">filter by feeling</span>
        <span className="rr-filter-trigger-value">
          {activeEmotion ? (
            <>
              <span className="swatch" style={{ "--chip-c": activeEmotion.color }} />
              {activeEmotion.name}
            </>
          ) : "all"}
          <ChevronDown size={15} aria-hidden="true" />
        </span>
      </button>

      <div className="rr-filter-sort">
        <span className="label">sort</span>
        <select className="rr-sort-select" value={sort} onChange={(e) => onSort(e.target.value)}>
          <option value="date">most recent</option>
          <option value="intensity">most intense</option>
          <option value="title">alphabetical</option>
        </select>
        <div className="rr-view-toggle">
          {["cover", "spine"].map((v) => (
            <button key={v} className={view === v ? "active" : ""} onClick={() => onView(v)}>{v}</button>
          ))}
        </div>
      </div>

      {sheetOpen && (
        <Modal
          onClose={() => setSheetOpen(false)}
          ariaLabel="Filter by feeling"
          className="rr-modal-card"
          backdropClassName="rr-modal-backdrop"
        >
          <div className="rr-filter-sheet">
            <div className="label rr-sheet-head">filter by feeling</div>
            {/* Every feeling the reader has actually recorded — not the nine the
                desktop bar has room for. The sheet wraps and can scroll
                vertically, so the full vocabulary costs nothing here. */}
            <div className="rr-filter-sheet-grid">
              {chip(null, "all", "var(--ink)", { closeSheet: true })}
              {presentEmotions.map(([id, e]) => chip(id, e.name, e.color, { closeSheet: true }))}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// How many books the grid puts in the DOM before it offers the rest.
//
// This bounds RENDERING only — the fetch still walks the whole library into
// memory (getAllEntries), because in-library search, the stat strip and the
// emotion chip counts all read the full set. Paginating the fetch would make
// all three quietly wrong.
//
// 48 divides evenly by the 6-, 4- and 2-column grids, so a capped shelf never
// ends on a ragged row.
const STACK_STEP = 48;

// One stack, two lists, a toggle between them [B2.2]. Not two columns side by
// side: the shelf is the thing you came to look at, and permanently giving a
// third of it to books nobody has read yet is the wrong trade. The pile is one
// click away instead.
//
// The lists are DERIVED FROM STATUS, never stored separately, so a book crosses
// over the moment its status changes — filling in a to-read book in EntryModal
// is what moves it out of To Read and into The Stacks, with nothing to sync.
const STACK_COPY = {
  read: {
    title: "The Stacks",
    unit: "on display",
    // Reachable with a shelf of nothing but to-read books: different from an
    // empty shelf, and it shouldn't read as one.
    empty: "Nothing read yet. Open To Read and fill one in.",
  },
  pile: {
    title: "To Read",
    unit: "waiting",
    empty: "Nothing waiting. Add one with “+ TO READ”.",
  },
};

function ReadingRoomStacks({ readEntries, pileEntries, view, onBookClick, totalCount, pileTotal }) {
  const [tab, setTab] = useState("read");
  const [shown, setShown] = useState(STACK_STEP);

  const entries = tab === "pile" ? pileEntries : readEntries;
  const copy = STACK_COPY[tab];

  // `entries` here is the filtered/sorted memo, so its identity changes exactly
  // when the visible set does. Without this reset a cap raised to 96 on the
  // unfiltered shelf would carry into a filter that matches 3 books — or into
  // the other tab, which is usually much shorter.
  useEffect(() => { setShown(STACK_STEP); }, [entries]);

  // A reader who empties their pile shouldn't be left staring at an empty tab.
  useEffect(() => {
    if (tab === "pile" && pileTotal === 0) setTab("read");
  }, [tab, pileTotal]);

  const visible = entries.slice(0, shown);
  const remaining = entries.length - visible.length;

  return (
    <div className={`rr-stacks rr-stacks-${tab}`}>
      {/* The heading IS the switch: two titles with a slash between them, the
          inactive one dimmed. No separate control to notice and no chrome —
          the reader is choosing which shelf they are looking at, which is what
          a title says anyway. The count moves below the books, where it reports
          on what is already on screen instead of competing with the switch. */}
      <div className="rr-stacks-head" role="tablist" aria-label="Which books to show">
        <h2 className="rr-stacks-title">
          <button
            role="tab"
            aria-selected={tab === "read"}
            className={`rr-stacks-title-opt ${tab === "read" ? "active" : ""}`}
            onClick={() => setTab("read")}
          >
            The Stacks
          </button>
          <span className="rr-stacks-title-sep" aria-hidden="true">/</span>
          <button
            role="tab"
            aria-selected={tab === "pile"}
            className={`rr-stacks-title-opt ${tab === "pile" ? "active" : ""}`}
            onClick={() => setTab("pile")}
          >
            TBR{pileTotal > 0 && <span className="rr-stacks-title-n">{pileTotal}</span>}
          </button>
        </h2>
      </div>
      {tab === "pile" && pileEntries.length > 0 && (
        <p className="rr-stacks-note">
          Not counted in your DNA until you’ve read them. Tap one to fill it in.
        </p>
      )}
      {visible.length === 0 ? (
        <p className="rr-stacks-note">{copy.empty}</p>
      ) : view === "spine" ? (
        <Shelf entries={visible} bookend onBookClick={onBookClick} />
      ) : (
        <div className="rr-cover-grid">
          {visible.map((entry, i) => (
            // `i % STACK_STEP` keeps the entrance stagger inside one batch. With
            // a raw index the 49th book would wait 2.4s to appear and the 96th
            // nearly 5s, so an appended batch would trickle in rather than land.
            // Identical to the old behaviour for the first 48.
            <BookCard key={entry.id} entry={entry} index={i % STACK_STEP} width={150} onClick={() => onBookClick(entry)} />
          ))}
        </div>
      )}
      {/* Below the books: it describes what you just looked at. */}
      {visible.length > 0 && (
        <div className="rr-stacks-count">
          · {visible.length} {copy.unit}
          {(tab === "pile" ? pileTotal : totalCount) > visible.length && (
            <span className="rr-stacks-count-of"> of {tab === "pile" ? pileTotal : totalCount}</span>
          )}
        </div>
      )}
      {remaining > 0 && (
        <div className="rr-stacks-more">
          <button className="btn ghost rr-stacks-more-btn" onClick={() => setShown((n) => n + STACK_STEP)}>
            show {Math.min(remaining, STACK_STEP)} more ↓
          </button>
          <div className="label">{remaining} more {remaining === 1 ? "book" : "books"} here</div>
        </div>
      )}
    </div>
  );
}

function Dashboard() {
  const { user } = useAuth();
  const {
    entries, analytics, stale,
    loading, generating, entriesError,
    addEntry, editEntry, removeEntry, finishBook, generate, ensureFresh, loadEntries
  } = useJournal();

  const navigate = useNavigate();


  // Tabs are URL-driven so each view is deep-linkable and the browser back
  // button moves between them. `?view=` is the source of truth. [F1.6 / P5-4]
  const [searchParams, setSearchParams] = useSearchParams();
  const VALID_TABS = ["shelf", "dna"];
  const viewParam = searchParams.get("view");
  // `?view=patterns` was its own tab before the fold; keep old links working by
  // landing them on DNA, which now carries the patterns section.
  const normalized = viewParam === "patterns" ? "dna" : viewParam;
  const tab = VALID_TABS.includes(normalized) ? normalized : "shelf";
  const setTab = (id) => {
    if (id === "echoes") { navigate("/echoes"); return; }
    if (id === "journal") { navigate("/journal"); return; }
    // Keep the URL clean: the default tab drops the param entirely. A new history
    // entry (not replace) is what makes Back return to the previous tab.
    setSearchParams(id === "shelf" ? {} : { view: id });
  };

  const [modal, setModal] = useState(null);
  const [finishTarget, setFinishTarget] = useState(null);
  const [checkinTarget, setCheckinTarget] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [showTbr, setShowTbr] = useState(false);
  // First-run welcome: shown once (localStorage-gated), only to a brand-new user
  // with an empty shelf. [F2.10]
  const [showWelcome, setShowWelcome] = useState(() => {
    try { return !localStorage.getItem("bibliome_onboarded"); } catch { return false; }
  });
  const dismissWelcome = () => {
    try { localStorage.setItem("bibliome_onboarded", "1"); } catch { /* ignore */ }
    setShowWelcome(false);
  };
  const [filterEmotion, setFilterEmotion] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [view, setView] = useState("cover");
  const [toast, setToast] = useState(null);

  // The FAB gets out of the way while you're reading down the page and comes
  // back the moment you scroll up. DNA is almost entirely prose, and a button
  // parked over the middle of a sentence is worse than one you have to flick to
  // recover.
  const [fabHidden, setFabHidden] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    let queued = false;
    const onScroll = () => {
      if (queued) return;
      queued = true;
      // rAF-coalesced: scroll fires far faster than we can usefully react, and
      // this listener runs on every page in the app.
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const dy = y - last;
        // Near the top there is nothing to read past yet, so the button stays.
        // The 6px threshold ignores jitter and iOS rubber-banding, which would
        // otherwise flicker the FAB at the ends of the page.
        if (y <= 120) setFabHidden(false);
        else if (Math.abs(dy) > 6) setFabHidden(dy > 0);
        last = y;
        queued = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Patterns is a whole second page below the DNA argument. On a phone it opens
  // collapsed; on desktop there is room for it inline, so it starts open and its
  // <summary> is hidden entirely. Re-synced on breakpoint crossings so a resize
  // doesn't strand it closed on a wide screen with no way to open it.
  const isNarrow = useIsNarrow();
  const [patternsOpen, setPatternsOpen] = useState(!isNarrow);
  // Re-sync on breakpoint crossings, so a resize can't strand the section closed
  // on a wide screen where its <summary> is hidden and there'd be no way to open it.
  useEffect(() => { setPatternsOpen(!isNarrow); }, [isNarrow]);
  const [showReadFor, setShowReadFor] = useState(false);
  const dnaCardRef = useRef(null);

  useEffect(() => {
    // The DNA tab now renders the mirror AND the aggregate patterns section, so
    // it needs both payloads fresh.
    if (tab === "dna") { ensureFresh("profile"); ensureFresh("patterns"); }
  }, [tab, ensureFresh]);

  // Ask "what do you read for?" ONCE — at the moment the user first opens DNA,
  // a natural point of curiosity. Skippable, editable later in settings. [F7.7]
  useEffect(() => {
    if (tab !== "dna") return;
    let asked = true;
    try { asked = !!localStorage.getItem("bibliome_readfor_asked"); } catch { /* ignore */ }
    const answered = (analytics.profile?.reads_for || []).length > 0;
    if (!asked && !answered) setShowReadFor(true);
  }, [tab, analytics.profile]);

  const showToast = (message, type = "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const stats = useMemo(() => buildDashboardStats(entries), [entries]);

  // In-library search/filter [F2.7 / B2.9]. The whole library is already in
  // memory (getAllEntries), so title/author search + emotion filter run instantly
  // client-side — no round-trip per keystroke.
  const filteredEntries = useMemo(() => {
    let result = entries;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((e) =>
        (e.title || "").toLowerCase().includes(q) ||
        (e.author || "").toLowerCase().includes(q),
      );
    }
    if (filterEmotion) result = result.filter((e) => e.emotions?.some((em) => em.emotion_id === filterEmotion));
    if (sortBy === "intensity") result = [...result].sort((a, b) => (b.intensity || 0) - (a.intensity || 0));
    else if (sortBy === "title") result = [...result].sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    return result;
  }, [entries, filterEmotion, searchQuery, sortBy]);

  // The shelf is two stacks: books that carry a reading, and the pile that does
  // not. Same filter/sort applies to both, so searching finds a book wherever
  // it sits. `openedBooks` is the same rule the DNA gate uses, so the two
  // surfaces can never disagree about which books count.
  const readEntries = useMemo(() => openedBooks(filteredEntries), [filteredEntries]);
  const pileEntries = useMemo(
    () => filteredEntries.filter((e) => e.status === "want_to_read"),
    [filteredEntries],
  );
  const pileTotal = useMemo(
    () => entries.filter((e) => e.status === "want_to_read").length,
    [entries],
  );

  const handleSaveEntry = async (data, existingId) => {
    try {
      if (existingId && !String(existingId).startsWith("temp-")) await editEntry(existingId, data);
      else await addEntry(data);
      setModal(null);
    } catch (err) { showToast("Failed to save book"); }
  };
  // The whole library is already in memory, so "have I shelved this?" is a local
  // question — no lookup endpoint, no debounce, no round trip per keystroke.
  // Memoised because EntryModal recomputes the match inside a useMemo keyed on
  // this function's identity.
  const findDuplicate = useCallback(
    (fields) => findDuplicateEntry(entries, fields, {
      // Editing an existing book must not flag that book as its own duplicate.
      excludeId: modal && modal !== "new" ? modal.id : null,
    }),
    [entries, modal],
  );

  const handleDeleteEntry = async (id) => {
    try { await removeEntry(id); setModal(null); }
    catch (err) { showToast("Failed to delete book"); }
  };
  // Let errors propagate so FinishFlow can show them inline; toast only on success.
  const handleFinishBook = async (id, data) => {
    const saved = await finishBook(id, data);
    showToast("Book finished ✦", "success");
    return saved;
  };
  const handleGenerateDNA = async () => {
    try { await generate(); setTab("dna"); showToast("Your DNA is ready.", "success"); }
    catch (err) { showToast(err.message || "Failed to generate DNA"); }
  };
  const handleSaveCard = async () => {
    try { await saveCardAsImage(dnaCardRef.current, user?.username); showToast("Card saved", "success"); }
    catch { showToast("Couldn't save card — try a screenshot instead."); }
  };
  const markReadForAsked = () => { try { localStorage.setItem("bibliome_readfor_asked", "1"); } catch { /* ignore */ } };
  const handleSaveReadFor = async (values) => {
    await setReadFor(values);              // let errors surface inline in ReadForQuestion
    markReadForAsked();
    setShowReadFor(false);
    showToast("Saved. The app will watch for the gap.", "success");
  };
  const skipReadFor = () => { markReadForAsked(); setShowReadFor(false); };

  if (loading) return <div className="loading-screen"><div className="loading-glyph">◈</div><div className="loading-text">Loading library...</div></div>;

  // The DNA gate counts books the reader opened, not rows on the shelf. A
  // want_to_read is excluded from DNA server-side, so counting it here would
  // offer "Read DNA" on a shelf the backend will refuse to profile [B2.2].
  const openedCount = openedBooks(entries).length;
  const canGenerate = openedCount >= MIN_BOOKS;

  return (
    <div className="app">
      <ReadingRoomHeader
        user={user}
        tab={tab}
        onAddBook={() => setModal("new")}
        onShelveBook={() => setShowTbr(true)}
        onRevealDNA={handleGenerateDNA}
        canGenerate={canGenerate}
        generating={generating}
        navigate={navigate}
        entriesCount={entries.length}
      />

      <main>
        {tab === "shelf" && (
          <ErrorBoundary name="Shelf">
            {entriesError && entries.length === 0 ? (
              <ShelfError error={entriesError} onRetry={loadEntries} />
            ) : entries.length === 0 ? (
              <EmptyShelf onAddClick={() => setModal("new")} onImport={() => setShowImport(true)} />
            ) : (
              <>
                <ReadingRoomHero
                  entries={entries}
                  stats={stats}
                  user={user}
                  onBookClick={(b) => setModal(b)}
                  onRevealDNA={handleGenerateDNA}
                  canGenerate={canGenerate}
                  generating={generating}
                />
                <ReadingRoomStatStrip stats={stats} />
                <MirrorCard />
                {!canGenerate && (
                  <div className="progress-wrap">
                    <div className="progress-info">
                      DNA progress<span className="progress-count">{openedCount} / {MIN_BOOKS}</span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${Math.min(100, (openedCount / MIN_BOOKS) * 100)}%` }} />
                    </div>
                  </div>
                )}
                <ReadingRoomFilterBar
                  entries={entries}
                  filter={filterEmotion}
                  onFilter={setFilterEmotion}
                  sort={sortBy}
                  onSort={setSortBy}
                  view={view}
                  onView={setView}
                  search={searchQuery}
                  onSearch={setSearchQuery}
                />
                <ReadingRoomStacks
                  readEntries={readEntries}
                  pileEntries={pileEntries}
                  view={view}
                  onBookClick={(b) => setModal(b)}
                  totalCount={openedCount}
                  pileTotal={pileTotal}
                />
                <div className="rr-footer">
                  <span>Bibliome · personal edition · printed for one</span>
                  <span>fin —</span>
                </div>
              </>
            )}
          </ErrorBoundary>
        )}

        {tab === "dna" && (
          <>
            <ErrorBoundary name="DNA">
              <DNAView
                profile={analytics.profile}
                username={user?.username}
                onSave={handleSaveCard}
                onEditReadFor={() => setShowReadFor(true)}
                cardRef={dnaCardRef}
                bookCount={entries.length}
                stats={analytics.stats}
              />
            </ErrorBoundary>

            {/* The aggregate, folded in below the mirror. Deliberately OUTSIDE the
                DNA gate — patterns are real from the first book, so a reader under
                the 5-book gate still gets their own numbers, not an empty tab. */}
            <ErrorBoundary name="Patterns">
              <details
                className="rr-fold"
                open={patternsOpen}
                onToggle={(e) => setPatternsOpen(e.currentTarget.open)}
              >
                {/* Hidden above 640, where the section just runs inline as
                    before. <details> rather than a hand-rolled toggle: it comes
                    with the disclosure semantics, keyboard operation and
                    find-in-page behaviour already correct. */}
                <summary className="rr-fold-summary">
                  <span>Your patterns</span>
                  <span className="rr-fold-chev" aria-hidden="true">⌄</span>
                </summary>
                {/* Not rendered while collapsed. The heatmap is a 69 × 18 matrix
                    — well over a thousand cells — so this is the difference
                    between a folded section and a folded section that still
                    costs everything it would have cost open. */}
                {patternsOpen && (stale.stats || stale.heatmap
                  ? <div className="loading-screen"><div className="loading-glyph">◈</div><div className="loading-text">Reading your patterns...</div></div>
                  : <Patterns stats={analytics.stats} heatmap={analytics.heatmap} embedded />)}
              </details>
            </ErrorBoundary>
          </>
        )}
      </main>

      {/* Mobile's add-book affordance, replacing the header `+` below 640 — not
          joining it. Two buttons for one action would split the reader's
          attention; this one just moves it into the thumb zone, since the
          header sits at the top of a 6.7" screen where a thumb reaches worst.
          Mounted here rather than inside ReadingRoomHeader so it stays put
          across all four tabs, exactly as the header button did. */}
      <button
        className={`rr-fab ${fabHidden ? "is-hidden" : ""}`}
        onClick={() => setModal("new")}
        aria-label="Add a book"
      >
        <Plus size={26} aria-hidden="true" />
      </button>

      {modal && (
        <Modal
          onClose={() => setModal(null)}
          ariaLabel={modal === "new" ? "Log a book" : "Edit book"}
          className="rr-modal-card"
          backdropClassName="rr-modal-backdrop"
        >
          <EntryModal
            // EntryModal seeds every field from `entry` in useState initialisers,
            // which only run on mount — so swapping to the already-shelved copy
            // has to remount it, or the new-entry form state would survive the
            // switch and quietly overwrite the book they asked to open.
            key={modal === "new" ? "new" : modal.id}
            entry={modal === "new" ? null : modal}
            onSave={handleSaveEntry}
            onDelete={handleDeleteEntry}
            onClose={() => setModal(null)}
            onFinish={(entry) => { setModal(null); setFinishTarget(entry); }}
            onCheckin={(entry) => { setModal(null); setCheckinTarget(entry); }}
            findDuplicate={findDuplicate}
            onOpenExisting={(existing) => setModal(existing)}
          />
        </Modal>
      )}

      {checkinTarget && (
        <Modal
          onClose={() => setCheckinTarget(null)}
          ariaLabel={`Check in on ${checkinTarget.title || "book"}`}
          className="rr-modal-card"
          backdropClassName="rr-modal-backdrop"
        >
          <CheckinPanel entry={checkinTarget} onClose={() => setCheckinTarget(null)} />
        </Modal>
      )}

      {showImport && (
        <Modal
          onClose={() => setShowImport(false)}
          ariaLabel="Import your library"
          className="rr-modal-card"
          backdropClassName="rr-modal-backdrop"
        >
          <ImportModal onClose={() => setShowImport(false)} onImported={loadEntries} />
        </Modal>
      )}

      {showTbr && (
        <Modal
          onClose={() => setShowTbr(false)}
          ariaLabel="Add to reading list"
          className="rr-modal-card"
          backdropClassName="rr-modal-backdrop"
        >
          <TbrQuickAdd onClose={() => setShowTbr(false)} />
        </Modal>
      )}

      {showWelcome && !loading && entries.length === 0 && (
        <Modal
          onClose={dismissWelcome}
          ariaLabel="Welcome to Bibliome"
          className="rr-modal-card"
          backdropClassName="rr-modal-backdrop"
        >
          <WelcomeModal
            onBegin={() => { dismissWelcome(); setModal("new"); }}
            onDismiss={dismissWelcome}
          />
        </Modal>
      )}

      {showReadFor && (
        <Modal
          onClose={skipReadFor}
          ariaLabel="What do you read for"
          className="rr-modal-card"
          backdropClassName="rr-modal-backdrop"
        >
          <ReadForQuestion
            value={analytics.profile?.reads_for || []}
            onSave={handleSaveReadFor}
            onSkip={skipReadFor}
          />
        </Modal>
      )}

      {finishTarget && (
        <Modal
          onClose={() => setFinishTarget(null)}
          ariaLabel={`Finish ${finishTarget.title || "book"}`}
          className="rr-modal-card"
          backdropClassName="rr-modal-backdrop"
        >
          <FinishFlow
            entry={finishTarget}
            onFinish={handleFinishBook}
            onClose={() => setFinishTarget(null)}
          />
        </Modal>
      )}
      {toast && <div className={`toast toast-${toast.type}`} onClick={() => setToast(null)}>{toast.message}</div>}
    </div>
  );
}

function AuthedLayout() {
  const { authed } = useAuth();
  const navigate = useNavigate();

  // Signing in from an invite link returns you to the invitation. [#5]
  useEffect(() => {
    if (!authed) return;
    const token = takeInvite();
    if (token) navigate(`/collections/join/${token}`, { replace: true });
  }, [authed, navigate]);

  if (!authed) return <Navigate to="/login" replace />;
  return (
    <JournalProvider>
      {/* The journal's key state is mounted here, not on /journal, so the
          password captured at login can unwrap the data key while it still
          exists in memory. Both providers are inert until the journal is
          unlocked, and PrivateJournalProvider fetches nothing before then. */}
      <JournalKeyProvider>
        <PrivateJournalProvider>
          <Outlet />
        </PrivateJournalProvider>
      </JournalKeyProvider>
    </JournalProvider>
  );
}

const RouteLoader = () => (
  <div className="loading-screen">
    <div className="loading-glyph">◈</div>
  </div>
);

export default function App() {
  const { authed, loading } = useAuth();
  const navigate = useNavigate();

  // Pull the canonical emotion vocabulary from the server once at boot so labels
  // and colors can never drift from the backend. Best-effort: the local seed is
  // already canonical, so a failure just leaves the seed in place. [F1.5 / B2.10]
  useEffect(() => {
    getEmotionVocab().then(hydrateEmotions).catch(() => {});
  }, []);

  if (loading) return <RouteLoader />;

  return (
    <ThemeProvider>
    <Suspense fallback={<RouteLoader />}>
      <Routes>
        <Route path="/s/:token" element={<SharedProfile />} />
        <Route path="/u/:username" element={<PublicProfile />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        {/* Top-level, not under the authed layout: someone deciding whether to
            sign up is exactly who needs to read these. */}
        <Route path="/privacy" element={<LegalPage />} />
        <Route path="/terms" element={<LegalPage />} />
        <Route path="/login" element={authed ? <Navigate to="/" replace /> : <AuthPage />} />
        {/* Top-level, like the other capability links: an invite has to open for
            a signed-out reader too, so it can name the collection and then send
            them to sign in — rather than bouncing them to a login page that
            explains nothing. [#5] */}
        <Route path="/collections/join/:token" element={<JoinCollectionPage />} />

        <Route
          path="/"
          element={
            authed
              ? <AuthedLayout />
              : <LandingPage onGetStarted={() => navigate("/login")} />
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="echoes" element={<EchoesPage />} />
          <Route path="resonance" element={<ResonancePage />} />
          <Route path="journal" element={<JournalPage />} />
          <Route path="me" element={<ProfilePage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="admin" element={<AdminPage />} />
        </Route>
      </Routes>
    </Suspense>
    </ThemeProvider>
  );
}