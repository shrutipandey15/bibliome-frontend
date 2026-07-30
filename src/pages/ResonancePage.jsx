import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getResonanceMatches, reachOut, respondToMatch } from "../services/api";
import { markSeen } from "../components/resonance/signal";
import MatchCard from "../components/resonance/MatchCard";
import ResonanceThread from "../components/resonance/ResonanceThread";
import "./ResonancePage.css";

/**
 * Resonance — the one-to-one surface. [app/routers/resonance.py]
 *
 * Structurally incapable of becoming a social network:
 *   - at most three suggestions at a time (SURFACE_LIMIT), never a feed
 *   - no follow, no like, no reaction, no count, no public profile anywhere
 *   - no browsing: you cannot look for a person, only answer the ones surfaced
 *   - a decline is invisible to both sides — the card is just gone
 *
 * The reader never sees who is behind a card until they have both said yes.
 */

const EMPTY_COPY = {
  glyph: "❋",
  line: "No one yet.",
  sub: "Resonance is rare on purpose — it waits for someone who felt a book the way you did, at about the depth you did. That doesn't happen weekly. Keep reading, keep tagging honestly, and one day this page will have someone on it.",
};

export default function ResonancePage() {
  const navigate = useNavigate();
  const [matches, setMatches] = useState([]);
  const [reachesLeft, setReachesLeft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [openThread, setOpenThread] = useState(null); // the connected match

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getResonanceMatches();
      const list = data?.matches || [];
      setMatches(list);
      setReachesLeft(data?.reaches_left_today ?? null);
      // Opening the page IS the acknowledgement — no "mark all read" button.
      markSeen(list);
    } catch (err) {
      setError(err?.kind ? err : { kind: "server" });
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // The server returns the whole updated card, so we swap it in rather than
  // guessing the next state client-side. A mutual reach, for instance, jumps
  // straight to `connected` and only the server knows that.
  const replace = (updated) =>
    setMatches((prev) => prev.map((m) => (m.match_id === updated.match_id ? updated : m)));

  const doReach = async (match, note) => {
    setBusyId(match.match_id);
    try {
      const updated = await reachOut(match.match_id, note);
      replace(updated);
      if (reachesLeft != null) setReachesLeft((n) => Math.max(0, n - 1));
    } finally {
      setBusyId(null);
    }
  };

  const doAccept = async (match, note) => {
    setBusyId(match.match_id);
    try {
      replace(await respondToMatch(match.match_id, true, note || null));
    } finally {
      setBusyId(null);
    }
  };

  // Declining removes the card and says nothing — no toast, no undo, no "you
  // passed on this". The other side is never told either (the server doesn't
  // notify), and that symmetry is the point.
  const doDecline = async (match) => {
    setBusyId(match.match_id);
    setMatches((prev) => prev.filter((m) => m.match_id !== match.match_id));
    try {
      await respondToMatch(match.match_id, false);
    } catch {
      // Put it back rather than pretend — a card that silently reappears on the
      // next load is more confusing than one that never left.
      setMatches((prev) => [...prev, match]);
    } finally {
      setBusyId(null);
    }
  };

  if (openThread) {
    return (
      <div className="resonance-page">
        <ResonanceThread
          threadId={openThread.thread_id}
          bookTitle={openThread.book_title}
          handle={openThread.handle}
          onClose={() => setOpenThread(null)}
          onEnded={() => { setOpenThread(null); load(); }}
        />
      </div>
    );
  }

  const suggested = matches.filter((m) => m.status === "suggested");
  const waiting = matches.filter((m) => m.status === "pending");
  const connected = matches.filter((m) => m.status === "connected");
  const outOfReaches = reachesLeft === 0;

  return (
    <div className="resonance-page">
      <div className="rp-masthead">
        <div>
          <div className="label" style={{ marginBottom: 14 }}>· one reader at a time ·</div>
          <h1 className="rp-h1"><em>Resonance</em>.</h1>
          <p className="rp-dek">
            Someone else finished the same book feeling what you felt. You don't get their
            name, their face, or their shelf — only the book, the feeling, and the choice
            to say something. Nothing here is public, and nothing here is counted.
          </p>
        </div>
        <div className="rp-head-actions">
          <button className="btn ghost" onClick={() => navigate("/")} style={{ fontSize: 12 }}>
            ← back to shelf
          </button>
        </div>
      </div>
      <div className="rule-dbl" style={{ marginBottom: 28 }} />

      {loading ? (
        <div className="rp-loading">listening…</div>
      ) : error ? (
        <div className="rp-empty">
          <div className="rp-empty-glyph" aria-hidden="true">◌</div>
          <div className="rp-empty-line">This page couldn't be reached.</div>
          <button className="btn ghost" onClick={load} style={{ marginTop: 16 }}>try again</button>
        </div>
      ) : matches.length === 0 ? (
        <div className="rp-empty">
          <div className="rp-empty-glyph" aria-hidden="true">{EMPTY_COPY.glyph}</div>
          <div className="rp-empty-line">{EMPTY_COPY.line}</div>
          <p className="rp-empty-sub">{EMPTY_COPY.sub}</p>
        </div>
      ) : (
        <div className="rp-sections">
          <Section
            title="Open letters"
            note="You both said yes. This is yours now."
            matches={connected}
            busyId={busyId}
            onOpenThread={setOpenThread}
          />
          <Section
            title="Waiting"
            note="Sent, or arrived. Either way, no hurry."
            matches={waiting}
            busyId={busyId}
            onAccept={doAccept}
            onDecline={doDecline}
          />
          <Section
            title="Surfaced"
            note="At most three at a time. There is no next page."
            matches={suggested}
            busyId={busyId}
            onReach={doReach}
            onDecline={doDecline}
          />
          {outOfReaches && suggested.length > 0 && (
            /* The one number the feature exposes, and only once it matters —
               it's the reader's own budget, not a measure of anyone else. */
            <p className="rp-budget">
              You've reached out as much as you can today. The rest will still be here tomorrow.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, note, matches, busyId, onReach, onAccept, onDecline, onOpenThread }) {
  if (!matches.length) return null;
  return (
    <section className="rp-section">
      <div className="rp-section-head">
        <h2 className="rp-section-title">{title}</h2>
        <span className="rp-section-note">{note}</span>
      </div>
      <div className="rp-cards">
        {matches.map((m) => (
          <MatchCard
            key={m.match_id}
            match={m}
            busy={busyId === m.match_id}
            onReach={(note) => onReach?.(m, note)}
            onAccept={(note) => onAccept?.(m, note)}
            onDecline={() => onDecline?.(m)}
            onOpenThread={() => onOpenThread?.(m)}
          />
        ))}
      </div>
    </section>
  );
}
