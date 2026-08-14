import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getResonanceMatches, reachOut, respondToMatch } from "../services/api";
import { markSeen } from "../components/resonance/signal";
import MatchCard, { ThreadRow } from "../components/resonance/MatchCard";
import ResonanceThread from "../components/resonance/ResonanceThread";
import ThemeToggle from "../components/ThemeToggle";
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
  line: "Nobody.",
  sub: "This is rare on purpose. Most books don't land on two people the same way, and the ones that do take a while to find each other.",
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
      <header className="rp-masthead">
        <div>
          <div className="label">· one reader at a time ·</div>
          <h1 className="rp-h1">Resonance<span className="rp-stop">.</span></h1>
          <p className="rp-dek">
            Someone else finished the same book feeling what you felt. You get the book,
            the feeling, and the choice to say something — never a name, a face, or a shelf.
          </p>
        </div>
        <div className="rp-head-actions">
          <div className="rp-head-row">
            <button className="btn ghost" onClick={() => navigate("/")} style={{ fontSize: 12 }}>
              ← back to shelf
            </button>
            <ThemeToggle className="rr-theme-toggle" />
          </div>
          {/* The rules of the room, stated where every other product puts a
              follower count. */}
          <div className="rp-promises">
            nothing public<br />nothing counted<br />no next page
          </div>
        </div>
      </header>

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
            note="You both said yes."
            variant="rows"
            matches={connected}
            busyId={busyId}
            onOpenThread={setOpenThread}
          />
          <Section
            title="Waiting"
            note="Sent, or arrived. Nothing to do either way."
            matches={waiting}
            busyId={busyId}
            onAccept={doAccept}
            onDecline={doDecline}
          />
          <Section
            title="Surfaced"
            note="At most three at a time. There is no next page."
            matches={suggested}
            foldable
            busyId={busyId}
            onReach={doReach}
            onDecline={doDecline}
          />
          {outOfReaches && suggested.length > 0 && (
            /* The one number the feature exposes, and only once it matters —
               it's the reader's own budget, not a measure of anyone else. */
            <p className="rp-budget">
              That's your reaching for today. The rest keep.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// How many matches a section draws before offering the rest.
//
// GET /resonance/matches has no cursor — it returns every match this reader has
// ever had, and "Open letters" and "Waiting" only ever grow. Surfaced is capped
// at three by the feature itself, so only the other two need this. A cursor on
// the endpoint is the real fix; this bounds the DOM in the meantime.
const SECTION_STEP = 8;

function Section({ title, note, matches, variant, foldable, busyId, onReach, onAccept, onDecline, onOpenThread }) {
  const [shown, setShown] = useState(SECTION_STEP);
  // Above the early return: hooks cannot run conditionally.
  useEffect(() => { setShown(SECTION_STEP); }, [matches.length]);

  if (!matches.length) return null;
  const visible = matches.slice(0, shown);
  const remaining = matches.length - visible.length;
  return (
    <section className="rp-section">
      <div className="rp-section-head">
        <h2 className="rp-section-title">{title}</h2>
        <span className="rp-section-note">{note}</span>
        <span className="rp-section-rule" aria-hidden="true" />
      </div>
      <div className={`rp-cards ${variant === "rows" ? "rp-cards-rows" : ""}`}>
        {visible.map((m) => (
          variant === "rows" ? (
            <ThreadRow key={m.match_id} match={m} onOpen={() => onOpenThread?.(m)} />
          ) : (
            <MatchCard
              key={m.match_id}
              match={m}
              busy={busyId === m.match_id}
              foldable={foldable}
              onReach={(note) => onReach?.(m, note)}
              onAccept={(note) => onAccept?.(m, note)}
              onDecline={() => onDecline?.(m)}
              onOpenThread={() => onOpenThread?.(m)}
            />
          )
        ))}
        {remaining > 0 && (
          <button className="rp-more" onClick={() => setShown((n) => n + SECTION_STEP)}>
            show {Math.min(remaining, SECTION_STEP)} more · {visible.length} of {matches.length}
          </button>
        )}
      </div>
    </section>
  );
}
