import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Lock } from "lucide-react";
import Modal from "../components/Modal";
import ThemeToggle from "../components/ThemeToggle";
import TabBar from "../components/TabBar";
import { useJournalKey } from "../contexts/JournalKeyContext";
import { usePrivateJournal } from "../contexts/PrivateJournalContext";
import JournalSetup from "../components/journal/JournalSetup";
import JournalLock from "../components/journal/JournalLock";
import BlankPage from "../components/journal/BlankPage";
import ContinuousRead from "../components/journal/ContinuousRead";
import BatchTag from "../components/journal/BatchTag";
import JournalSearch from "../components/journal/JournalSearch";
import "../components/journal/journal.css";

/**
 * The journal shell — a state machine over the key, and nothing else.
 *
 *   loading  → a held breath while GET /journal/key answers
 *   absent   → first run: setup, which is the one wall in this feature
 *   locked   → the key isn't in this tab. Password, or recovery code.
 *   unlocked → the three screens
 *
 * The order matters: there is no route into the writing surface that doesn't
 * pass through a live key. A "write now, set up encryption later" path would
 * mean prose sitting somewhere unsealed, and there is nowhere for it to sit.
 */
export default function JournalPage() {
  return (
    <>
      <JournalBody />
      {/* Phones only — see EchoesPage. Journal is a route, not a Dashboard tab,
          so without this the bottom bar disappeared the moment you used it. */}
      <TabBar active="journal" barOnly />
    </>
  );
}

function JournalBody() {
  const { status, error } = useJournalKey();

  if (status === "loading") {
    return <div className="jr-shell jr-shell--gate"><div className="jr-quiet">Checking your journal…</div></div>;
  }
  if (status === "error") {
    return (
      <div className="jr-shell jr-shell--gate">
        <div className="jr-quiet">
          Couldn't reach your journal ({error?.kind || "server error"}). Nothing is
          lost — try again in a moment.
        </div>
      </div>
    );
  }
  if (status === "absent") {
    return <div className="jr-shell jr-shell--gate"><JournalSetup /></div>;
  }
  if (status === "locked") {
    return <div className="jr-shell jr-shell--gate"><JournalLock /></div>;
  }
  return <UnlockedJournal />;
}

function UnlockedJournal() {
  const { lock, rewrapWarning, dismissRewrapWarning } = useJournalKey();
  const { untagged, flushNow } = usePrivateJournal();
  const [view, setView] = useState("today"); // today | read | search
  const [tagging, setTagging] = useState(null);
  // Dismissing the unnamed-days prompt lasts the session. It comes back next
  // time, and it never blocks anything in the meantime.
  const [promptOff, setPromptOff] = useState(false);

  // Leaving the writing surface commits what's on it. The debounce would get
  // there on its own; this removes the window where it wouldn't.
  useEffect(() => { if (view !== "today") flushNow(); }, [view, flushNow]);

  const showPrompt = untagged.length > 0 && !promptOff;

  // The housekeeping card lives on the desk beside the page rather than in a bar
  // above it: an unnamed day is a thing to get to, not an interruption to read
  // past before you can write the next one.
  const prompt = showPrompt ? (
    <div className="jr-prompt">
      <div className="jr-prompt-line">
        {untagged.length} {untagged.length === 1 ? "day" : "days"} unnamed.
      </div>
      <p className="jr-prompt-sub">A named day is a findable day.</p>
      <div className="jr-prompt-actions">
        <button type="button" className="jr-link" onClick={() => setTagging(untagged)}>
          Name them
        </button>
        <button type="button" className="jr-link jr-link-quiet" onClick={() => setPromptOff(true)}>
          Not now
        </button>
      </div>
    </div>
  ) : null;

  return (
    <div className="jr-shell">
      <nav className="jr-bar">
        <Link to="/" className="jr-icon-btn" aria-label="Back to the reading room">
          <ArrowLeft size={16} />
        </Link>
        <div className="jr-wordmark">The <em>Journal</em></div>
        <div className="jr-tabs">
          {[["today", "Today"], ["read", "Read"], ["search", "Search"]].map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`jr-tab${view === id ? " is-on" : ""}`}
              onClick={() => setView(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="jr-bar-right">
          {/* The promise, kept in view — it is why everything else here is shaped
              the way it is. */}
          <span className="jr-seal">end-to-end encrypted</span>
          <ThemeToggle className="jr-icon-btn jr-icon-btn--ruled" />
          {/* Locking is a real affordance, not a settings-menu curiosity: it's the
              one action that takes the key out of memory without closing the tab. */}
          <button
            type="button"
            className="jr-icon-btn jr-icon-btn--ruled"
            onClick={lock}
            aria-label="Lock the journal"
          >
            <Lock size={15} />
          </button>
        </div>
      </nav>

      {rewrapWarning && (
        <div className="jr-quiet" role="status">
          {rewrapWarning}{" "}
          <button type="button" className="jr-link jr-link-quiet" onClick={dismissRewrapWarning}>
            Dismiss
          </button>
        </div>
      )}

      {view === "today" && (
        <BlankPage prompt={prompt} onNameDay={(page) => setTagging(page ? [page] : untagged)} />
      )}
      {view === "read" && <ContinuousRead onTagDay={(page) => setTagging([page])} />}
      {view === "search" && <JournalSearch onOpenDay={() => setView("read")} />}

      {tagging && (
        <Modal
          onClose={() => setTagging(null)}
          ariaLabel="Name these days"
          className="rr-modal-card"
          backdropClassName="rr-modal-backdrop"
        >
          <BatchTag pages={tagging} onClose={() => setTagging(null)} />
        </Modal>
      )}
    </div>
  );
}
