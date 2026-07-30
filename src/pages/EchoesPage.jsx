import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { EMO_LIST } from "../services/emotions";
import {
  getEchoFeed, blockHandle, muteHandle, reportEcho, reportReply,
} from "../services/api";
import Modal from "../components/Modal";
import EchoCard from "../components/echo/EchoCard";
import EchoComposer from "../components/echo/EchoComposer";
import EchoThread from "../components/echo/EchoThread";
import ReportModal from "../components/echo/ReportModal";
import "./EchoesPage.css";

/**
 * Echo — the single public surface. [Phase 3 / F3.3]
 *
 * Structurally incapable of becoming a social feed:
 *   - chronological, keyset-paginated, ENDS with an explicit "you're caught up"
 *   - renders NO counts of any kind (no trending, no "echo of the day", no totals)
 *   - no path from the feed to a person's other content or a profile [F3.7]
 */
export default function EchoesPage() {
  const navigate = useNavigate();
  const [echoes, setEchoes] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [caughtUp, setCaughtUp] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [emotion, setEmotion] = useState(null); // "a feeling" anchor view
  // "your echoes" — composes WITH the emotion anchor rather than replacing it, so
  // "my echoes tagged grief" is one query on the server. [B: ?mine=true]
  const [mine, setMine] = useState(false);

  const [composing, setComposing] = useState(false);
  const [threadEcho, setThreadEcho] = useState(null);
  const [reportTarget, setReportTarget] = useState(null); // { echo } or { echo, reply }
  const [toast, setToast] = useState(null);
  // Handles the viewer has muted/blocked — their replies never render inline. [F6.5]
  const [hiddenHandles, setHiddenHandles] = useState(() => new Set());

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Load the first page for the current anchor. Resets the list.
  const loadFirst = useCallback(async (emo, onlyMine) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getEchoFeed({ emotion: emo || null, mine: onlyMine });
      setEchoes(data.echoes || []);
      setCursor(data.next_cursor || null);
      setCaughtUp(!!data.caught_up);
    } catch (err) {
      setError(err.kind ? err : { kind: "server" });
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadFirst(emotion, mine); }, [emotion, mine, loadFirst]);

  const loadMore = async () => {
    if (loadingMore || caughtUp || !cursor) return;
    setLoadingMore(true);
    try {
      const data = await getEchoFeed({ cursor, emotion: emotion || null, mine });
      setEchoes((prev) => [...prev, ...(data.echoes || [])]);
      setCursor(data.next_cursor || null);
      setCaughtUp(!!data.caught_up);
    } catch {
      showToast("Couldn't load more", "error");
    }
    setLoadingMore(false);
  };

  const hide = (handle) => setHiddenHandles((s) => new Set(s).add(handle));

  // Safety actions
  const doMute = async (echo) => {
    try { await muteHandle(echo.handle); hide(echo.handle); setEchoes((p) => p.filter((e) => e.handle !== echo.handle)); showToast(`Muted @${echo.handle}`); }
    catch { showToast("Couldn't mute", "error"); }
  };
  const doBlock = async (echo) => {
    try { await blockHandle(echo.handle); hide(echo.handle); setEchoes((p) => p.filter((e) => e.handle !== echo.handle)); showToast(`Blocked @${echo.handle}`); }
    catch { showToast("Couldn't block", "error"); }
  };
  const submitReport = async (category) => {
    if (reportTarget?.reply) await reportReply(reportTarget.echo.id, reportTarget.reply.id, category);
    else await reportEcho(reportTarget.echo.id, category);
  };

  return (
    <div className="echoes-page">
      <div className="ep-masthead">
        <div>
          <div className="label" style={{ marginBottom: 14 }}>· the one public room ·</div>
          <h1 className="ep-h1">The <em>Echoes</em>.</h1>
          <p className="ep-dek">
            The raw thing a book did to you — and others doing the same. No followers, no
            counts, no feed that never ends. Say the true thing.
          </p>
        </div>
        <div className="ep-head-actions">
          <button className="btn ghost" onClick={() => navigate("/")} style={{ fontSize: 12 }}>← back to shelf</button>
          <button className="btn brass" onClick={() => setComposing(true)}>write an echo</button>
        </div>
      </div>
      <div className="rule-dbl" style={{ marginBottom: 24 }} />

      {/* WHOSE — everyone vs your own. Kept on its own row above the feeling
          anchors because the two compose: "your echoes" + "grief" is one query. */}
      <div className="ep-filters ep-filters-whose">
        <button
          className={`chip ${!mine ? "active" : ""}`}
          style={{ "--chip-c": "var(--ink)" }}
          aria-pressed={!mine}
          onClick={() => setMine(false)}
        >
          everyone
        </button>
        <button
          className={`chip ${mine ? "active" : ""}`}
          style={{ "--chip-c": "var(--ink)" }}
          aria-pressed={mine}
          onClick={() => setMine(true)}
        >
          your echoes
        </button>
      </div>

      {/* The private-counts promise, stated where the counts appear. */}
      {mine && (
        <p className="ep-mine-note">
          What you've said, and who was listening. These counts are yours alone — no
          one else sees them.
        </p>
      )}

      {/* "A Feeling" anchor views — filter, not ranking. */}
      <div className="ep-filters">
        <div className="label" style={{ marginRight: 4 }}>a feeling</div>
        <button
          className={`chip ${!emotion ? "active" : ""}`}
          style={{ "--chip-c": "var(--ink)" }}
          aria-pressed={!emotion}
          onClick={() => setEmotion(null)}
        >
          <span className="swatch" /> any
        </button>
        {/* The single word, not the tagging phrase — a filter row is an index of
            the vocabulary, and "grief" sits in a chip where "it grieved me" does
            not. The swatch keeps the colour cue redundant with the label. */}
        {EMO_LIST.map(([id, e]) => (
          <button
            key={id}
            className={`chip ${emotion === id ? "active" : ""}`}
            style={{ "--chip-c": e.color }}
            aria-pressed={emotion === id}
            onClick={() => setEmotion(emotion === id ? null : id)}
          >
            <span className="swatch" />{(e.name || id).toLowerCase()}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-screen" style={{ minHeight: 260 }}>
          <div className="loading-glyph">◈</div>
          <div className="loading-text">listening for echoes…</div>
        </div>
      ) : error ? (
        <div className="empty-state" role="alert">
          <div className="empty-glyph">⚠</div>
          <div className="empty-title">Couldn't reach the echoes</div>
          <div className="empty-sub">Something went wrong on our end. Try again in a moment.</div>
          <button className="btn" style={{ marginTop: 18 }} onClick={() => loadFirst(emotion, mine)}>try again</button>
        </div>
      ) : echoes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-glyph">✦</div>
          <div className="empty-title">
            {mine
              ? (emotion ? "You haven't echoed this feeling yet" : "You haven't written an echo yet")
              : (emotion ? "No echoes for this feeling yet" : "No echoes yet")}
          </div>
          {/* Your own empty shelf is not a silent room — don't tell the author to
              "be the first" among their own echoes. */}
          <div className="empty-sub">
            {mine
              ? "Whatever a book did to you, this is where you'd put it."
              : "The silence is loud. Be the first to say something true."}
          </div>
          <button className="btn brass" style={{ marginTop: 18 }} onClick={() => setComposing(true)}>write an echo</button>
        </div>
      ) : (
        <div className="ep-feed">
          {echoes.map((echo) => (
            <EchoCard
              key={echo.id}
              echo={echo}
              onReadMore={setThreadEcho}
              onReport={(e) => setReportTarget({ echo: e })}
              onMute={doMute}
              onBlock={doBlock}
              onToast={showToast}
              hiddenHandles={hiddenHandles}
            />
          ))}

          {/* Feeds end. Explicit, calm terminus — no infinite scroll. */}
          {caughtUp ? (
            <div className="ep-caughtup">
              <span className="ep-caughtup-glyph" aria-hidden="true">◆</span>
              <span className="ep-caughtup-line">You're caught up.</span>
              {/* Naming the design as deliberate: the feed stopping is the feature. */}
              <span className="ep-caughtup-sub">Nothing more waiting. That's on purpose.</span>
              <button className="ep-caughtup-cta" onClick={() => setComposing(true)}>
                Add your own →
              </button>
            </div>
          ) : (
            <button className="ep-more" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? "loading…" : "load older echoes"}
            </button>
          )}
        </div>
      )}

      {composing && (
        <Modal onClose={() => setComposing(false)} ariaLabel="Write an echo" className="rr-modal-card" backdropClassName="rr-modal-backdrop">
          <EchoComposer
            onPosted={(echo) => { if (!emotion || echo?.primary_emotion === emotion) setEchoes((p) => [echo, ...p]); showToast("Echo posted"); }}
            onClose={() => setComposing(false)}
          />
        </Modal>
      )}

      {threadEcho && (
        <Modal onClose={() => setThreadEcho(null)} ariaLabel="Echo thread" className="rr-modal-card" backdropClassName="rr-modal-backdrop">
          <EchoThread
            echoId={threadEcho.id}
            onReport={(reply) => setReportTarget({ echo: threadEcho, reply })}
          />
        </Modal>
      )}

      {reportTarget && (
        <Modal onClose={() => setReportTarget(null)} ariaLabel="Report content" className="rr-modal-card" backdropClassName="rr-modal-backdrop">
          <ReportModal onSubmit={submitReport} onClose={() => setReportTarget(null)} />
        </Modal>
      )}

      {toast && <div className={`toast toast-${toast.type}`} onClick={() => setToast(null)}>{toast.message}</div>}
    </div>
  );
}
