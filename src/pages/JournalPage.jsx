import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Lock } from "lucide-react";
import Modal from "../components/Modal";
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
  const { status, error } = useJournalKey();

  if (status === "loading") {
    return <div className="jr-shell jr-quiet">Checking your journal…</div>;
  }
  if (status === "error") {
    return (
      <div className="jr-shell jr-quiet">
        Couldn't reach your journal ({error?.kind || "server error"}). Nothing is
        lost — try again in a moment.
      </div>
    );
  }
  if (status === "absent") {
    return <div className="jr-shell"><JournalSetup /></div>;
  }
  if (status === "locked") {
    return <div className="jr-shell"><JournalLock /></div>;
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

  return (
    <div className="jr-shell">
      <nav className="jr-nav">
        <Link to="/" className="jr-icon-btn" aria-label="Back to the reading room">
          <ArrowLeft size={16} />
        </Link>
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
        {/* Locking is a real affordance, not a settings-menu curiosity: it's the
            one action that takes the key out of memory without closing the tab. */}
        <button type="button" className="jr-icon-btn" onClick={lock} aria-label="Lock the journal">
          <Lock size={15} />
        </button>
      </nav>

      {rewrapWarning && (
        <div className="jr-prompt">
          <span>{rewrapWarning}</span>
          <button type="button" className="jr-link jr-link-quiet" onClick={dismissRewrapWarning}>
            Dismiss
          </button>
        </div>
      )}

      {untagged.length > 0 && !promptOff && view !== "search" && (
        <div className="jr-prompt">
          <span>
            {untagged.length} {untagged.length === 1 ? "day" : "days"} unnamed.
          </span>
          <button type="button" className="jr-link" onClick={() => setTagging(untagged)}>
            Name them
          </button>
          <button type="button" className="jr-link jr-link-quiet" onClick={() => setPromptOff(true)}>
            Not now
          </button>
        </div>
      )}

      {view === "today" && <BlankPage />}
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
