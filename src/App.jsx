import { useState, useEffect, useMemo, useRef, lazy, Suspense } from "react";
import { Settings } from "lucide-react";
import { Routes, Route, useParams, Link, useNavigate, Navigate, Outlet, useSearchParams } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import { useJournal, JournalProvider } from "./contexts/JournalContext";
import { saveCardAsImage } from "./utils/cardUtils";
import { getSharedDNA, getEmotionVocab, setReadFor } from "./services/api";
import AuthPage from "./pages/AuthPage";
import BookCard from "./components/BookCard";
import EmptyShelf from "./components/EmptyShelf";
import ShelfError from "./components/ShelfError";
import EntryModal from "./components/EntryModal";
import Modal from "./components/Modal";
import FinishFlow from "./components/FinishFlow";
import CheckinPanel from "./components/CheckinPanel";
import MirrorCard from "./components/MirrorCard";
import ImportModal from "./components/ImportModal";
import WelcomeModal from "./components/WelcomeModal";
import NotificationCenter from "./components/notifications/NotificationCenter";
import DNACard from "./components/DNACard";
import DNAView from "./components/dna/DNAView";
import ReadForQuestion from "./components/dna/ReadForQuestion";
import { MIN_BOOKS } from "./components/dna/constants";
import LandingPage from "./pages/LandingPage";
import { Patterns } from "./components/Panels";
import ErrorBoundary from "./components/ErrorBoundary";
import Shelf from "./components/Shelf";
import { ShelfDecoration } from "./components/Shelf";
import { EMO_LIST, EMOTIONS, getPrimaryEmotion, hydrateEmotions } from "./services/emotions";
import { clearCache } from "./services/offline";
import "./App.css";

function useReadingRoomTheme() {
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return "light";
    const stored = localStorage.getItem("bd-theme");
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("bd-theme", theme);
  }, [theme]);
  return [theme, () => setTheme((t) => (t === "dark" ? "light" : "dark"))];
}

const AdminPage = lazy(() => import("./pages/AdminPage"));
const PublicProfile = lazy(() => import("./pages/PublicProfile"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const EchoesPage = lazy(() => import("./pages/EchoesPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));


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
  if (!profile || !profile.personality) {
    return (
      <div className="empty-state" style={{ height: "100vh" }}>
        <div className="empty-glyph">?</div>
        <div className="empty-title">Link Expired</div>
        <div className="empty-sub">This profile is no longer accessible.</div>
        <Link to="/" className="back-btn">Go Home</Link>
      </div>
    );
  }

  return (
    <div className="app public-view">
      <header className="header">
        <div className="brand">
          <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}><div className="logo">BOOK <span>DNA</span></div></Link>
        </div>
        <div className="header-right">
          <Link to="/" className="gen-btn">{currentUser ? "My Dashboard" : "Get Your Own"}</Link>
        </div>
      </header>
      <main className="main" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
         <div className="dna-reveal-label" style={{ marginTop: 0 }}>Reading Personality</div>
         <DNACard profile={profile} username={profile.username || "Reader"} allowShare={false} />
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
  // books per month based on created_at range, if available
  const dates = entries.map((e) => e.created_at).filter(Boolean).map((d) => new Date(d).getTime());
  let perMonth = total;
  if (dates.length > 1) {
    const span = (Math.max(...dates) - Math.min(...dates)) / (1000 * 60 * 60 * 24 * 30);
    perMonth = span > 0 ? +(total / span).toFixed(1) : total;
  }
  return { total, avg, topEmotion, perMonth };
}

function ReadingRoomHeader({ user, tab, onTab, theme, onToggleTheme, onAddBook, onRevealDNA, canGenerate, generating, navigate, entriesCount }) {
  // Three tabs — Shelf · DNA · Echo. Patterns folded into DNA: both surfaced the
  // same emotion data, so the aggregate now reads as the closing section of the
  // DNA scroll rather than a competing tab.
  const tabs = [
    { id: "shelf",    label: "Shelf", count: entriesCount },
    { id: "dna",      label: "DNA"   },
    { id: "echoes",   label: "Echo"  },
  ];
  const initial = (user?.display_name || user?.username || "R").trim().charAt(0).toUpperCase();
  return (
    <div className="rr-header">
      <div className="rr-header-row">
        <div className="rr-brand">
          <div className="rr-logo">Book <em>DNA</em></div>
          <div className="rr-brand-meta">
            <div className="label rr-volume">vol. iv · {new Date().getFullYear()}</div>
            <div className="rr-tagline">{user?.display_name || user?.username || "your"}'s reading journal</div>
          </div>
        </div>
        <div className="rr-actions">
          <button className="btn ghost" onClick={onAddBook} style={{ fontSize: 12, padding: "8px 14px" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em" }}>+ ADD BOOK</span>
          </button>
          {canGenerate && tab !== "dna" && (
            <button className="btn brass" onClick={onRevealDNA} disabled={generating} style={{ fontSize: 12, padding: "9px 18px" }}>
              <span style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 15 }}>
                {generating ? "Reading" : "Read"}
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase" }}>DNA</span>
            </button>
          )}
          <NotificationCenter />
          <button className="rr-theme-toggle" onClick={() => navigate("/me")} title="Your study (profile)" aria-label="Your profile">◐</button>
          <button className="rr-theme-toggle" onClick={onToggleTheme} title="Toggle Vellum / Lamplight">
            {theme === "dark" ? "☀" : "☾"}
          </button>
          <button className="rr-avatar" onClick={() => navigate("/settings")} title="Settings">{initial}</button>
        </div>
      </div>
      <div className="rr-tabs">
        {tabs.map((t) => (
          <button key={t.id} className={`rr-tab ${tab === t.id ? "active" : ""}`} onClick={() => onTab(t.id)}>
            {t.label}
            {t.count !== undefined && <span className="rr-tab-count">{String(t.count).padStart(2, "0")}</span>}
            {tab === t.id && <span className="rr-tab-mark">✦</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

function ReadingRoomHero({ entries, stats, user, onBookClick, onRevealDNA, canGenerate, generating }) {
  const featured = entries.slice(0, 5);
  const top = EMOTIONS[stats.topEmotion?.[0]];
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
        <p className="rr-hero-dek">
          {top ? (
            <>You read like someone keeping the lights on for a friend who isn't home yet. Your shelf leans toward{" "}
              <span style={{ color: top.color, fontWeight: 600 }}>{top.label.toLowerCase()}</span>, with the occasional bright spike of catharsis.
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
          <button className="btn ghost" style={{ fontSize: 12 }} onClick={() => document.querySelector(".rr-stacks")?.scrollIntoView({ behavior: "smooth" })}>
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
  const items = [
    { l: "volumes",        v: String(stats.total).padStart(2, "0") },
    { l: "avg intensity",  v: stats.avg, suf: "/10" },
    { l: "top emotion",    v: top.name, color: top.color },
    { l: "books / month",  v: typeof stats.perMonth === "number" ? stats.perMonth.toFixed(1) : stats.perMonth },
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
      <div className="label" style={{ marginRight: 4 }}>filter by feeling</div>
      <button className={`chip ${!filter ? "active" : ""}`} style={{ "--chip-c": "var(--ink)" }} onClick={() => onFilter(null)}>
        <span className="swatch" />all
      </button>
      {presentEmotions.slice(0, 9).map(([id, e]) => {
        const n = entries.filter((b) => b.emotions?.some((em) => em.emotion_id === id)).length;
        return (
          <button
            key={id}
            className={`chip ${filter === id ? "active" : ""}`}
            style={{ "--chip-c": e.color }}
            onClick={() => onFilter(filter === id ? null : id)}
          >
            <span className="swatch" />
            {e.name}
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, opacity: 0.65 }}>·{n}</span>
          </button>
        );
      })}
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
    </div>
  );
}

function ReadingRoomStacks({ entries, view, onBookClick, totalCount }) {
  return (
    <div className="rr-stacks">
      <div className="rr-stacks-head">
        <h2>
          The Stacks
          <em>· {entries.length} on display</em>
        </h2>
        <div className="label">selecting from {totalCount}</div>
      </div>
      {view === "spine" ? (
        <Shelf entries={entries} bookend onBookClick={onBookClick} />
      ) : (
        <div className="rr-cover-grid">
          {entries.map((entry, i) => (
            <BookCard key={entry.id} entry={entry} index={i} width={150} onClick={() => onBookClick(entry)} />
          ))}
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
  const [theme, toggleTheme] = useReadingRoomTheme();

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
    // Keep the URL clean: the default tab drops the param entirely. A new history
    // entry (not replace) is what makes Back return to the previous tab.
    setSearchParams(id === "shelf" ? {} : { view: id });
  };

  const [modal, setModal] = useState(null);
  const [finishTarget, setFinishTarget] = useState(null);
  const [checkinTarget, setCheckinTarget] = useState(null);
  const [showImport, setShowImport] = useState(false);
  // First-run welcome: shown once (localStorage-gated), only to a brand-new user
  // with an empty shelf. [F2.10]
  const [showWelcome, setShowWelcome] = useState(() => {
    try { return !localStorage.getItem("bookdna_onboarded"); } catch { return false; }
  });
  const dismissWelcome = () => {
    try { localStorage.setItem("bookdna_onboarded", "1"); } catch { /* ignore */ }
    setShowWelcome(false);
  };
  const [filterEmotion, setFilterEmotion] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [view, setView] = useState("cover");
  const [toast, setToast] = useState(null);
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
    try { asked = !!localStorage.getItem("bookdna_readfor_asked"); } catch { /* ignore */ }
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

  const handleSaveEntry = async (data, existingId) => {
    try {
      if (existingId && !String(existingId).startsWith("temp-")) await editEntry(existingId, data);
      else await addEntry(data);
      setModal(null);
    } catch (err) { showToast("Failed to save book"); }
  };
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
  const markReadForAsked = () => { try { localStorage.setItem("bookdna_readfor_asked", "1"); } catch { /* ignore */ } };
  const handleSaveReadFor = async (values) => {
    await setReadFor(values);              // let errors surface inline in ReadForQuestion
    markReadForAsked();
    setShowReadFor(false);
    showToast("Saved. The app will watch for the gap.", "success");
  };
  const skipReadFor = () => { markReadForAsked(); setShowReadFor(false); };

  if (loading) return <div className="loading-screen"><div className="loading-glyph">◈</div><div className="loading-text">Loading library...</div></div>;

  const canGenerate = entries.length >= MIN_BOOKS;

  return (
    <div className="app">
      <ReadingRoomHeader
        user={user}
        tab={tab}
        onTab={(id) => id === "echoes" ? navigate("/echoes") : setTab(id)}
        theme={theme}
        onToggleTheme={toggleTheme}
        onAddBook={() => setModal("new")}
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
                      DNA progress<span className="progress-count">{entries.length} / {MIN_BOOKS}</span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${Math.min(100, (entries.length / MIN_BOOKS) * 100)}%` }} />
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
                  entries={filteredEntries}
                  view={view}
                  onBookClick={(b) => setModal(b)}
                  totalCount={entries.length}
                />
                <div className="rr-footer">
                  <span>Book DNA · personal edition · printed for one</span>
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
              />
            </ErrorBoundary>

            {/* The aggregate, folded in below the mirror. Deliberately OUTSIDE the
                DNA gate — patterns are real from the first book, so a reader under
                the 5-book gate still gets their own numbers, not an empty tab. */}
            <ErrorBoundary name="Patterns">
              {stale.stats || stale.heatmap
                ? <div className="loading-screen"><div className="loading-glyph">◈</div><div className="loading-text">Reading your patterns...</div></div>
                : <Patterns stats={analytics.stats} heatmap={analytics.heatmap} embedded />}
            </ErrorBoundary>
          </>
        )}
      </main>

      {modal && (
        <Modal
          onClose={() => setModal(null)}
          ariaLabel={modal === "new" ? "Log a book" : "Edit book"}
          className="rr-modal-card"
          backdropClassName="rr-modal-backdrop"
        >
          <EntryModal
            entry={modal === "new" ? null : modal}
            onSave={handleSaveEntry}
            onDelete={handleDeleteEntry}
            onClose={() => setModal(null)}
            onFinish={(entry) => { setModal(null); setFinishTarget(entry); }}
            onCheckin={(entry) => { setModal(null); setCheckinTarget(entry); }}
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

      {showWelcome && !loading && entries.length === 0 && (
        <Modal
          onClose={dismissWelcome}
          ariaLabel="Welcome to BookDNA"
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
  if (!authed) return <Navigate to="/login" replace />;
  return (
    <JournalProvider>
      <Outlet />
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
    <Suspense fallback={<RouteLoader />}>
      <Routes>
        <Route path="/s/:token" element={<SharedProfile />} />
        <Route path="/u/:username" element={<PublicProfile />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/login" element={authed ? <Navigate to="/" replace /> : <AuthPage />} />

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
          <Route path="me" element={<ProfilePage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="admin" element={<AdminPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}