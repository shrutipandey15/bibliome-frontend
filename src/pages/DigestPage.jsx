import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight, CircleDashed, CloudSun, Compass, Eye, Fingerprint, Hourglass, Mail, PenLine, Share2, Sparkles,
} from "lucide-react";
import { getDigest, recordDigestClick } from "../services/api";
import { getCachedDigest, setCachedDigest } from "../services/offline";
import ThemeToggle from "../components/ThemeToggle";
import { EMOTIONS } from "../services/emotions";
import { useAuth } from "../contexts/AuthContext";
import { useJournal } from "../contexts/JournalContext";
import BookCard from "../components/BookCard";
import "./DigestPage.css";

/**
 * One week's digest, drawn as a tiny private magazine: a cover (the lead, its
 * book, one big number), an "in this issue" strip to jump around, and each
 * section as its own object on the desk — a specimen card for the feeling, an
 * index card for a past note, a postcard for the weather, a sealed letter.
 *
 * The notification (and push) carries the subject and the lead's teaser; this
 * page reveals everything. Section ids are the deep-link anchors.
 */
export default function DigestPage() {
  const { period } = useParams();
  const { hash } = useLocation();
  const { user } = useAuth();
  const [digest, setDigest] = useState(() => getCachedDigest(period));
  const [state, setState] = useState(digest ? "ready" : "loading"); // loading | ready | missing | offline
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let live = true;
    getDigest(period)
      .then((d) => {
        if (!live) return;
        setDigest(d);
        setStale(false);
        setState("ready");
        setCachedDigest(period, d);
        recordDigestClick(period, "open");
      })
      .catch((e) => {
        if (!live) return;
        // Offline (an installed app opened from a push with no signal): show the
        // copy we kept if it's this week's, and say so; never "it isn't here".
        if (e?.kind === "offline") {
          const kept = getCachedDigest(period);
          if (kept) { setDigest(kept); setStale(true); setState("ready"); }
          else setState("offline");
        } else setState("missing");
      });
    return () => { live = false; };
  }, [period]);

  useEffect(() => {
    if (state === "ready" && hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" });
  }, [state, hash]);

  return (
    <div className="dg-page">
      {/* The installed app has no browser back button: this is the way out. */}
      <div className="dg-bar">
        <Link className="btn ghost dg-back" to="/">← back to shelf</Link>
        <ThemeToggle className="rr-theme-toggle" />
      </div>
      {state === "loading" && <p className="dg-quiet dg-center">Opening this week's issue…</p>}
      {state === "missing" && <p className="dg-quiet dg-center">That week's letter isn't here.</p>}
      {state === "offline" && (
        <p className="dg-quiet dg-center">You're offline. This week's letter will open once you're back.</p>
      )}
      {state === "ready" && (
        <>
          {stale && <p className="dg-stale">Offline · showing the copy saved on this device</p>}
          <DigestView digest={digest} period={period} name={user?.display_name || user?.username} />
        </>
      )}
    </div>
  );
}

// "2026-41" → "5 – 11 October 2026" (the ISO week, Monday to Sunday).
export function weekRange(period) {
  const m = /^(\d{4})-(\d{1,2})$/.exec(period || "");
  if (!m) return null;
  const [year, week] = [Number(m[1]), Number(m[2])];
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const day = (d, opts) => d.toLocaleDateString("en-GB", { timeZone: "UTC", ...opts });
  const sameMonth = monday.getUTCMonth() === sunday.getUTCMonth();
  return sameMonth
    ? `${day(monday, { day: "numeric" })} – ${day(sunday, { day: "numeric", month: "long", year: "numeric" })}`
    : `${day(monday, { day: "numeric", month: "short" })} – ${day(sunday, { day: "numeric", month: "short", year: "numeric" })}`;
}

const ICON = {
  past_self: PenLine, archetype_letter: Mail, weather: CloudSun, while_away: Hourglass,
  emotion_of_week: Sparkles, drift: Compass, dna_waiting: Fingerprint, revealed: Eye,
};

// Where a section's link goes, said plainly.
const GO = {
  drift: "See your DNA",
  archetype_letter: "Pin it to your DNA page",
  while_away: "Open the book",
  dna_waiting: "Add a book",
  revealed: "Meet yourself",
};

// The lead's first line can be the subject again ("Someone is forming here.");
// the headline has already said it.
const norm = (t) => t.trim().replace(/[.!]$/, "").toLowerCase();
function dropEcho(s, subject) {
  const [first, ...rest] = s.body.split("\n");
  return rest.length && norm(first) === norm(subject) ? { ...s, body: rest.join("\n") } : s;
}

// The one big number on the cover, when the lead has one.
function bigFigure(s) {
  if (s.kind === "while_away" && s.data.years) return { n: s.data.years, unit: s.data.years === 1 ? "year ago" : "years ago" };
  if (s.kind === "past_self" && s.data.when) return { words: `${s.data.when} ago` };
  return null;
}

/**
 * The issue itself. `preview` is the admin's read-only view of someone else's
 * digest: no reveals (they're the reader's own notes), no taps, no clicks.
 */
export function DigestView({ digest, period, name, preview = false }) {
  const track = (section) => { if (!preview) recordDigestClick(period, section); };
  const lead = dropEcho(digest.sections[0], digest.subject);
  const smaller = digest.sections.slice(1);
  const issue = Number((period || "").split("-")[1]) || null;

  return (
    <article className="dg">
      <Cover digest={digest} lead={lead} issue={issue} period={period} name={name} preview={preview} track={track} />

      <nav className="dg-toc" aria-label="In this issue">
        <span className="label-sm">in this issue</span>
        <ol>
          {digest.sections.map((s, i) => {
            const Icon = ICON[s.kind] || CircleDashed;
            return (
              <li key={s.kind}>
                <a href={`#${s.kind}`} onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(s.kind)?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}>
                  <span className="dg-toc-n">{String(i + 1).padStart(2, "0")}</span>
                  <Icon size={16} aria-hidden="true" />
                  <span>{s.title}</span>
                </a>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="dg-desk">
        {smaller.map((s, i) => (
          <Piece key={s.kind} s={s} n={i + 2} period={period} preview={preview} track={track} />
        ))}
      </div>

      {digest.action && (
        <aside className="dg-action">
          <span className="dg-action-ring" aria-hidden="true" />
          <div>
            <div className="label-sm">one small thing · under ten seconds</div>
            {preview
              ? <div className="dg-action-label">{digest.action.label}</div>
              : <Link className="dg-action-label" to={digest.action.link} onClick={() => track("action")}>{digest.action.label}</Link>}
          </div>
          <ArrowRight className="dg-action-arrow" size={20} aria-hidden="true" />
        </aside>
      )}

      <footer className="dg-foot">
        <p className="hand dg-signoff">Until next week.</p>
        {!preview && <Link className="dg-settings" to="/settings?section=notifications">Change when this arrives</Link>}
      </footer>
    </article>
  );
}

/* ---------------- the cover ---------------- */

function Cover({ digest, lead, issue, period, name, preview, track }) {
  const { entries } = useJournal();
  const onThisPage = lead.link.startsWith(`/digest/${period}`);
  const fig = bigFigure(lead);
  const book = lead.data?.entry_id ? entries.find((e) => e.id === lead.data.entry_id) : null;

  return (
    <header id={lead.kind} className={`dg-cover dg-k-${lead.kind}`}>
      <div className="dg-cover-top">
        <span>Bibliome</span>
        <span>{weekRange(period)}</span>
      </div>

      <div className="dg-cover-grid">
        <div className="dg-cover-text">
          {issue && <div className="dg-issue" aria-label={`Issue ${issue}`}>No.&thinsp;{issue}</div>}
          {digest.intro && <p className="dg-intro">{digest.intro}</p>}
          <h1 className="dg-subject">{digest.subject}</h1>
          {fig && (
            <div className="dg-figure">
              {fig.n != null ? <><b>{fig.n}</b> <span>{fig.unit}</span></> : <span className="dg-figure-words">{fig.words}</span>}
            </div>
          )}
          <LeadBody s={lead} preview={preview} track={track} />
          {!onThisPage && !preview && (
            <Link className="btn brass dg-cta" to={lead.link} onClick={() => track(lead.kind)}>
              {lead.button || "Open"} <ArrowRight size={16} aria-hidden="true" />
            </Link>
          )}
          {name && <p className="dg-greet">for {name}</p>}
        </div>

        <div className="dg-cover-art" aria-hidden="true">
          <CoverArt s={lead} book={book} />
        </div>
      </div>
    </header>
  );
}

function CoverArt({ s, book }) {
  if (book) return <div className="dg-art-book"><BookCard entry={book} width={170} showCaption={false} /></div>;
  if (s.kind === "dna_waiting") {
    return (
      <div className="dg-art-blur">
        <span className="dg-art-blur-glyph">◈</span>
        <span className="dg-art-blur-name">The Something Reader</span>
      </div>
    );
  }
  if (s.kind === "weather") return <Sky emotions={s.data.emotions} tall />;
  if (s.kind === "emotion_of_week") {
    const emo = EMOTIONS[s.data.emotion];
    return <div className="dg-art-orb" style={{ "--emo": emo?.color }}>{emo?.name}</div>;
  }
  if (s.kind === "archetype_letter") return <div className="dg-art-seal"><Mail size={40} /></div>;
  const Icon = ICON[s.kind] || CircleDashed;
  return <div className="dg-art-icon"><Icon size={56} strokeWidth={1.2} /></div>;
}

function LeadBody({ s, preview, track }) {
  if (s.kind === "archetype_letter") return <Letter text={s.body} />;
  if (s.kind === "weather") return <p className="dg-lead-text">{s.data.forecast}</p>;
  if (s.kind === "emotion_of_week") return <FeelingBody s={s} preview={preview} track={track} plain />;
  return (
    <>
      {s.body.split("\n").filter(Boolean).map((l, i) => <p key={i} className="dg-lead-text">{l}</p>)}
      {s.kind === "past_self" && !preview && <PastSelfNote s={s} track={track} />}
    </>
  );
}

/* ---------------- the smaller pieces ---------------- */

function Piece({ s, n, period, preview, track }) {
  const onThisPage = s.link.startsWith(`/digest/${period}`);
  const Icon = ICON[s.kind] || CircleDashed;
  const head = (
    <div className="dg-piece-head">
      <span className="dg-piece-n">{String(n).padStart(2, "0")}</span>
      <Icon size={15} aria-hidden="true" />
      <span className="label-sm">{s.title}</span>
    </div>
  );
  const more = !onThisPage && !preview && (
    <Link className="dg-more" to={s.link} onClick={() => track(s.kind)}>
      {GO[s.kind] || "Open"} <ArrowRight size={14} aria-hidden="true" />
    </Link>
  );

  switch (s.kind) {
    case "emotion_of_week": {
      const emo = EMOTIONS[s.data.emotion];
      return (
        <section id={s.kind} className="dg-piece dg-specimen" style={{ "--emo": emo?.color || "var(--brass)" }}>
          {head}
          <FeelingBody s={s} preview={preview} track={track} />
        </section>
      );
    }
    case "past_self":
      return (
        <section id={s.kind} className="dg-piece dg-index">
          <span className="dg-clip" aria-hidden="true" />
          {head}
          <p className="dg-index-when hand">{s.data.when ? `${s.data.when} ago` : "a while ago"}</p>
          <p className="dg-text">{s.body}</p>
          {!preview && <PastSelfNote s={s} track={track} />}
        </section>
      );
    case "weather":
      return (
        <section id={s.kind} className="dg-piece dg-postcard">
          <Sky emotions={s.data.emotions} />
          <div className="dg-postcard-body">
            {head}
            <p className="dg-postcard-text">{s.data.forecast}</p>
            {!preview && <ShareForecast text={s.data.forecast} />}
          </div>
        </section>
      );
    case "archetype_letter":
      return (
        <section id={s.kind} className="dg-piece dg-envelope">
          <span className="dg-wax" aria-hidden="true">✦</span>
          {head}
          <Letter text={s.body} />
          {more}
        </section>
      );
    default:
      return (
        <section id={s.kind} className="dg-piece dg-plain">
          {head}
          {s.body.split("\n").filter(Boolean).map((l, i) => <p key={i} className="dg-text dg-text-big">{l}</p>)}
          {more}
        </section>
      );
  }
}

function Sky({ emotions, tall = false }) {
  const colors = emotions.map((slug) => EMOTIONS[slug]?.color || "#8a6a2e");
  return (
    <div className={`dg-sky${tall ? " is-tall" : ""}`}
      style={{ background: `radial-gradient(120% 90% at 85% 10%, ${colors[2]}cc 0%, transparent 55%), radial-gradient(90% 80% at 10% 100%, ${colors[1]} 0%, transparent 60%), ${colors[0]}` }}>
      {emotions.map((slug) => <span key={slug}>{EMOTIONS[slug]?.name || slug}</span>)}
    </div>
  );
}

function ShareForecast({ text }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ text: `My shelf's weather: ${text}` });
      else { await navigator.clipboard.writeText(`My shelf's weather: ${text}`); setCopied(true); }
    } catch { /* dismissed */ }
  };
  return (
    <button className="dg-ghostbtn" onClick={share}>
      <Share2 size={14} aria-hidden="true" /> {copied ? "Copied" : "Share the forecast"}
    </button>
  );
}

function Letter({ text }) {
  // A last paragraph starting with "—" is the signature.
  const paras = text.split("\n\n");
  const sig = paras.length > 1 && paras[paras.length - 1].startsWith("—") ? paras.pop() : null;
  return (
    <div className="dg-letter">
      {paras.map((p, i) => <p key={i}>{p}</p>)}
      {sig && <p className="dg-letter-sig hand">{sig}</p>}
    </div>
  );
}

function FeelingBody({ s, preview, track, plain = false }) {
  const emo = EMOTIONS[s.data.emotion];
  const lines = s.body.split("\n");
  // A trailing "…book on your shelf…" line is about the shelf, not the essay.
  const tail = lines.length > 1 && /book on your shelf/i.test(lines[lines.length - 1]) ? lines.pop() : null;
  return (
    <div className="dg-feeling" style={{ "--emo": emo?.color || "var(--brass)" }}>
      {!plain && <div className="dg-feeling-name">{emo?.name || s.data.emotion}</div>}
      {emo?.label && <div className="dg-feeling-phrase">“{emo.label}”</div>}
      <blockquote className="dg-feeling-essay">{lines.map((l, i) => <p key={i}>{l}</p>)}</blockquote>
      {tail && <p className="dg-feeling-closest">{tail}</p>}
      {!preview && <TagFeeling s={s} track={track} />}
    </div>
  );
}

function PastSelfNote({ s, track }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const r = s.reveal;
  if (!r) return <p className="dg-quiet">That note isn't on your shelf anymore.</p>;
  const notes = [r.note, r.finish_thought !== r.note ? r.finish_thought : null].filter(Boolean);
  return (
    <>
      {notes.map((n, i) => (
        <figure key={i} className={`dg-slip${open ? " is-open" : ""}`}>
          <blockquote className="hand">{n}</blockquote>
          {!open && n.length > 180 && (
            <button className="dg-slip-more" onClick={() => setOpen(true)}>Read all of it</button>
          )}
        </figure>
      ))}
      <p className="dg-ask">How does it feel now?</p>
      <button className="dg-ghostbtn" onClick={() => { track("past_self"); navigate(`/?entry=${s.data.entry_id}`); }}>
        <PenLine size={14} aria-hidden="true" /> Re-tag {s.data.book}
      </button>
    </>
  );
}

function TagFeeling({ s, track }) {
  const { entries, editEntry } = useJournal();
  const [done, setDone] = useState(null);
  const slug = s.data.emotion;
  const name = EMOTIONS[slug]?.name || slug;
  const candidates = entries
    .filter((e) => e.status !== "want_to_read" && !e.emotions?.some((x) => x.emotion_id === slug))
    .slice(0, 10);

  const tag = async (e) => {
    const emotions = [...(e.emotions || []).map(({ emotion_id, strength }) => ({ emotion_id, strength })),
      { emotion_id: slug, strength: 6 }];
    await editEntry(e.id, { emotions });
    track("emotion_of_week");
    setDone(e.title);
  };

  if (done) return <p className="dg-ask">Tagged <em>{done}</em> with {name}.</p>;
  if (!candidates.length) return null;
  return (
    <div className="dg-tag">
      <p className="dg-ask">Which book gave you {name}? Tap its cover.</p>
      <div className="dg-shelfrow">
        {candidates.map((e) => (
          <button key={e.id} className="dg-shelfbook" onClick={() => tag(e)} aria-label={e.title} title={e.title}>
            <BookCard entry={e} width={64} showCaption={false} />
          </button>
        ))}
      </div>
    </div>
  );
}
