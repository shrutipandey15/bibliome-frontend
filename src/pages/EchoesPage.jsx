import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronDown, PenLine } from "lucide-react";
import { EMOTIONS, getEmotionFamilies } from "../services/emotions";
import {
  getEchoFeed, blockHandle, muteHandle, reportEcho, reportReply,
} from "../services/api";
import Modal from "../components/Modal";
import ThemeToggle from "../components/ThemeToggle";
import TabBar from "../components/TabBar";
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
 *
 * The layout is two columns because the page has two jobs and they don't belong
 * to each other: a column you READ, and a rail you ACT from. The eighteen
 * emotions used to sit as a chip wall above the feed, where they read as
 * eighteen equal buttons; in the rail they read as an index, grouped by the
 * families the vocabulary already has.
 */
// The "your echoes" view needs `?mine=true` on GET /echoes/feed, which the
// backend does not implement (app/routers/echo.py reads cursor/limit/book_title/
// book_author/emotion/prompt_id and ignores anything else). An ignored param
// returns the everyone-feed — so shipping the toggle labels a public feed as
// "yours", which is the one lie this surface cannot afford: it invites someone
// to reread what they think is only theirs.
//
// Everything downstream (state, queries, both empty states, the private-counts
// note) is already written and correct. Flip this the day the param lands.
export const MINE_FILTER_SUPPORTED = false;

export default function EchoesPage() {
  const navigate = useNavigate();
  // `?echo=<id>` opens straight into that thread — the landing point for an
  // "someone replied to your echo" notification. Read once, on mount: it's an
  // entry point, not a live binding, and re-reading it would reopen the thread
  // every time the reader closed it.
  const [searchParams] = useSearchParams();
  const deepLinkEchoId = useRef(searchParams.get("echo"));
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
  const [feelSheet, setFeelSheet] = useState(false);
  // EchoThread fetches the echo itself from its id, so `{ id }` is the whole of
  // what a deep link needs to hand it.
  const [threadEcho, setThreadEcho] = useState(
    () => (deepLinkEchoId.current ? { id: deepLinkEchoId.current } : null),
  );
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

  const activeEmo = emotion ? EMOTIONS[emotion] : null;

  return (
    <div className="echoes-page">
      <div className="ep-main">
        <header className="ep-masthead">
          <div>
            <div className="label">· the one public room ·</div>
            <h1 className="ep-h1">The <em>Echoes</em>.</h1>
            <p className="ep-dek">
              The raw thing a book did to you, and other people doing the same. No
              followers. No counts. No feed that never ends.
            </p>
          </div>
          <div className="ep-head-actions">
            <button className="btn ghost" onClick={() => navigate("/")} style={{ fontSize: 12 }}>← back to shelf</button>
            <ThemeToggle className="rr-theme-toggle" />
          </div>
        </header>

        {/* WHOSE — everyone vs your own. It composes with the feeling anchor in
            the rail: "your echoes" + "grief" is one query. */}
        <div className="ep-scope">
          {MINE_FILTER_SUPPORTED && (
            <div className="ep-seg" role="group" aria-label="Whose echoes">
              <button aria-pressed={!mine} onClick={() => setMine(false)}>everyone</button>
              <button aria-pressed={mine} onClick={() => setMine(true)}>your echoes</button>
            </div>
          )}
          {activeEmo && (
            <button
              className="ep-active-filter"
              onClick={() => setEmotion(null)}
              aria-label={`Clear the ${(activeEmo.name || emotion)} filter`}
            >
              <span className="swatch" style={{ background: activeEmo.color }} />
              {(activeEmo.name || emotion).toLowerCase()} ✕
            </button>
          )}
          {/* Phones only (CSS-hidden above 640, where the rail carries this).
              Same trigger+sheet shape as the Shelf's filter-by-feeling, so it's
              a pattern already learned rather than a new one. */}
          <button
            className="ep-feel-trigger"
            onClick={() => setFeelSheet(true)}
            aria-haspopup="dialog"
          >
            <span className="ep-feel-trigger-label">a feeling</span>
            <span className="ep-feel-trigger-value">
              {activeEmo ? (
                <>
                  <span className="swatch" style={{ background: activeEmo.color }} />
                  {(activeEmo.name || emotion).toLowerCase()}
                </>
              ) : "any"}
              <ChevronDown size={15} aria-hidden="true" />
            </span>
          </button>
          <div className="ep-order">chronological</div>
        </div>

        {/* The private-counts promise, stated where the counts appear. */}
        {mine && (
          <p className="ep-mine-note">
            Your echoes, and what came back. Nobody else sees these numbers.
          </p>
        )}

        {loading ? (
          <div className="ep-loading">
            <div className="ep-loading-glyph" aria-hidden="true">◈</div>
            <div className="ep-loading-text">listening for echoes</div>
          </div>
        ) : error ? (
          <div className="ep-notice error" role="alert">
            <div className="ep-notice-kicker">couldn't reach the room</div>
            <h2>That one's on us.</h2>
            <p>Our end broke, not yours. Nothing you wrote went anywhere.</p>
            <button className="btn" onClick={() => loadFirst(emotion, mine)}>try again</button>
          </div>
        ) : echoes.length === 0 ? (
          <div className="ep-notice ep-notice--empty">
            <div className="ep-notice-glyph" aria-hidden="true">✦</div>
            <h2>
              {mine
                ? (emotion ? "You haven't echoed this feeling." : "You haven't said anything yet.")
                : (emotion ? "Nobody has echoed this feeling." : "Empty.")}
            </h2>
            {/* Your own empty shelf is not a silent room — don't tell the author to
                "go first" among their own echoes. */}
            <p className="italic">
              {mine
                ? "Whatever the last book did to you goes here."
                : "Someone has to go first and it may as well be you."}
            </p>
            <button className="btn brass" onClick={() => setComposing(true)}>write an echo</button>
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
                <div className="ep-caughtup-glyph" aria-hidden="true">◆</div>
                <div className="ep-caughtup-line">That's all of it.</div>
                {/* Naming the design as deliberate: the feed stopping is the feature. */}
                <div className="ep-caughtup-sub">The feed ends. That's the whole point.</div>
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
      </div>

      <FeelingRail
        emotion={emotion}
        onEmotion={setEmotion}
        onCompose={() => setComposing(true)}
      />

      {composing && (
        <Modal onClose={() => setComposing(false)} ariaLabel="Write an echo" className="ec-modal-card" backdropClassName="rr-modal-backdrop">
          <EchoComposer
            onPosted={(echo) => { if (!emotion || echo?.primary_emotion === emotion) setEchoes((p) => [echo, ...p]); showToast("Echo posted"); }}
            onClose={() => setComposing(false)}
          />
        </Modal>
      )}

      {threadEcho && (
        <Modal onClose={() => setThreadEcho(null)} ariaLabel="Echo thread" className="et-modal-card" backdropClassName="rr-modal-backdrop">
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

      {/* The rail's other half. Phones only, and deliberately the same shape as
          the Shelf's add-book FAB — this page's single creative action, put
          where a thumb reaches. */}
      <button className="rr-fab ep-fab" onClick={() => setComposing(true)} aria-label="Write an echo">
        <PenLine size={24} aria-hidden="true" />
      </button>

      {feelSheet && (
        <Modal
          onClose={() => setFeelSheet(false)}
          ariaLabel="Filter by feeling"
          className="rr-modal-card"
          backdropClassName="rr-modal-backdrop"
        >
          <div className="ep-feel-sheet">
            <div className="label rr-sheet-head">a feeling</div>
            <button
              className={`chip ${!emotion ? "active" : ""}`}
              style={{ "--chip-c": "var(--ink)" }}
              onClick={() => { setEmotion(null); setFeelSheet(false); }}
            >
              <span className="swatch" />any feeling
            </button>
            {getEmotionFamilies().map(({ family, emotions }) => (
              <div className="ep-feel-sheet-fam" key={family}>
                <div className="ep-fam-name">{family}</div>
                <div className="ep-feel-sheet-chips">
                  {emotions.map(([id, e]) => (
                    <button
                      key={id}
                      className={`chip ${emotion === id ? "active" : ""}`}
                      style={{ "--chip-c": e.color }}
                      onClick={() => { setEmotion(emotion === id ? null : id); setFeelSheet(false); }}
                    >
                      <span className="swatch" />
                      {(e.name || id).toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {/* Phones only. Without it, tapping ECHO in the bottom bar navigated to a
          page with no bottom bar — a persistent control that vanished on use. */}
      <TabBar active="echoes" barOnly />
    </div>
  );
}

/**
 * The rail. Two things: the one action this page has, and the feeling index.
 *
 * Grouped by family because "grief" and "boredom" are not siblings, and a flat
 * row of eighteen chips asserted that they were. The families come from the
 * server's own vocabulary, so this never drifts from the tagging surfaces.
 */
function FeelingRail({ emotion, onEmotion, onCompose }) {
  const families = getEmotionFamilies();
  return (
    <aside className="ep-rail" aria-label="Write, and filter by feeling">
      <div className="ep-rail-inner">
        <div>
          <button className="ep-rail-write" onClick={onCompose}>
            <span>write an echo</span>
            <span className="ep-rail-write-mark" aria-hidden="true">↵</span>
          </button>
          <p className="ep-rail-friction">Say the true thing, not the clever thing.</p>
        </div>

        <div className="ep-rail-rule" />

        <div className="ep-rail-feelings">
          <div>
            <div className="ep-rail-label">a feeling</div>
            <button
              className="ep-feel ep-feel-any"
              aria-pressed={!emotion}
              onClick={() => onEmotion(null)}
            >
              <span className="ep-feel-swatch" />
              any feeling
            </button>
          </div>
          {families.map(({ family, emotions }) => (
            <div className="ep-fam" key={family}>
              <div className="ep-fam-name">{family}</div>
              {emotions.map(([id, e]) => (
                <button
                  key={id}
                  className="ep-feel"
                  style={{ "--feel-c": e.color }}
                  aria-pressed={emotion === id}
                  onClick={() => onEmotion(emotion === id ? null : id)}
                >
                  <span className="ep-feel-swatch" />
                  {(e.name || id).toLowerCase()}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
