import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { getDigest, recordDigestClick } from "../services/api";
import { EMOTIONS } from "../services/emotions";
import { useJournal } from "../contexts/JournalContext";
import "./DigestPage.css";

/**
 * One week's digest. The notification (and push) carries the subject and the
 * lead's teaser; this page reveals everything, and is where the sections that
 * need a tap live: re-tagging a past note, tagging a book with the feeling of
 * the week, sharing the weather. Section ids are the deep-link anchors
 * (#past_self, #weather, #emotion_of_week).
 */
export default function DigestPage() {
  const { period } = useParams();
  const { hash } = useLocation();
  const [digest, setDigest] = useState(null);
  const [state, setState] = useState("loading"); // loading | ready | missing

  useEffect(() => {
    let live = true;
    getDigest(period)
      .then((d) => {
        if (!live) return;
        setDigest(d);
        setState("ready");
        recordDigestClick(period, "open");
      })
      .catch(() => { if (live) setState("missing"); });
    return () => { live = false; };
  }, [period]);

  useEffect(() => {
    if (state === "ready" && hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" });
  }, [state, hash]);

  if (state === "loading") return <div className="dg-page"><p className="dg-quiet">Opening your letter…</p></div>;
  if (state === "missing") {
    return (
      <div className="dg-page">
        <p className="dg-quiet">That week's digest isn't here.</p>
        <Link className="btn ghost" to="/">Back to your shelf</Link>
      </div>
    );
  }
  return <div className="dg-page"><DigestView digest={digest} period={period} /></div>;
}

/**
 * The digest itself. `preview` is the admin's read-only view of someone else's
 * digest: no reveals (they're the reader's own notes), no taps, no clicks.
 */
export function DigestView({ digest, period, preview = false }) {
  const track = (section) => { if (!preview) recordDigestClick(period, section); };
  const [lead, ...smaller] = digest.sections;
  return (
    <>
      <div className="label">· your week ·</div>
      <h1 className="dg-subject">{digest.subject}</h1>
      {digest.intro && <p className="dg-intro">{digest.intro}</p>}
      <Section s={lead} period={period} preview={preview} track={track} lead />
      {smaller.map((s) => <Section key={s.kind} s={s} period={period} preview={preview} track={track} />)}
      {digest.action && (
        <p className="dg-action">
          ⟶ {preview
            ? <span>{digest.action.label}</span>
            : <Link to={digest.action.link} onClick={() => track("action")}>{digest.action.label}</Link>}
        </p>
      )}
    </>
  );
}

function Lines({ text }) {
  return text.split("\n").filter(Boolean).map((line, i) => <p key={i}>{line}</p>);
}

function Section({ s, period, preview, track, lead = false }) {
  const onThisPage = s.link.startsWith(`/digest/${period}`);
  const go = lead ? (s.button || "Open") : "Open →";
  return (
    <section id={s.kind} className={`dg-section card editorial${lead ? " dg-lead" : ""}`}>
      <div className="label-sm dg-title">· {s.title} ·</div>
      <div className="dg-body"><Lines text={s.body} /></div>
      {!preview && s.kind === "past_self" && <PastSelf s={s} track={track} />}
      {s.kind === "weather" && <Weather s={s} preview={preview} />}
      {!preview && s.kind === "emotion_of_week" && <TagFeeling s={s} track={track} />}
      {!onThisPage && !preview && (
        <Link className={`btn ${lead ? "brass" : "ghost"} dg-go`} to={s.link} onClick={() => track(s.kind)}>{go}</Link>
      )}
    </section>
  );
}

function PastSelf({ s, track }) {
  const navigate = useNavigate();
  const r = s.reveal;
  if (!r) return <p className="dg-quiet">That note isn't on your shelf anymore.</p>;
  return (
    <>
      {r.note && <blockquote className="dg-note">{r.note}</blockquote>}
      {r.finish_thought && r.finish_thought !== r.note && <blockquote className="dg-note">{r.finish_thought}</blockquote>}
      <p className="dg-ask">How does it feel now?</p>
      <button className="btn brass" onClick={() => { track("past_self"); navigate(`/?entry=${s.data.entry_id}`); }}>
        Re-tag {s.data.book}
      </button>
    </>
  );
}

function Weather({ s, preview }) {
  const [copied, setCopied] = useState(false);
  const text = `My shelf's weather: ${s.data.forecast}`;
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); setCopied(true); }
    } catch { /* dismissed */ }
  };
  return (
    <div className="dg-weather">
      <div className="dg-weather-card">
        {s.data.emotions.map((slug, i) => (
          <span key={slug} className="dg-weather-band" style={{ background: EMOTIONS[slug]?.color, flex: 3 - i }}>
            {EMOTIONS[slug]?.name || slug}
          </span>
        ))}
      </div>
      {!preview && <button className="btn ghost" onClick={share}>{copied ? "Copied" : "Share the forecast"}</button>}
    </div>
  );
}

function TagFeeling({ s, track }) {
  const { entries, editEntry } = useJournal();
  const [done, setDone] = useState(null);
  const slug = s.data.emotion;
  const name = EMOTIONS[slug]?.name || slug;
  const candidates = entries
    .filter((e) => e.status !== "want_to_read" && !e.emotions?.some((x) => x.emotion_id === slug))
    .slice(0, 8);

  const tag = async (e) => {
    const emotions = [...(e.emotions || []).map(({ emotion_id, strength }) => ({ emotion_id, strength })),
      { emotion_id: slug, strength: 6 }];
    await editEntry(e.id, { emotions });
    track("emotion_of_week");
    setDone(e.title);
  };

  if (done) return <p className="dg-ask">Tagged {done} with {name}.</p>;
  if (!candidates.length) return null;
  return (
    <>
      <p className="dg-ask">Which book gave you {name}? One tap.</p>
      <div className="dg-chips">
        {candidates.map((e) => <button key={e.id} className="btn ghost" onClick={() => tag(e)}>{e.title}</button>)}
      </div>
    </>
  );
}
