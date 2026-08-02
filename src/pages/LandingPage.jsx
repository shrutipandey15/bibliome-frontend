import { Link } from "react-router-dom";
import Shelf, { ShelfDecoration } from "../components/Shelf";
import ThemeToggle from "../components/ThemeToggle";
import { ARCHETYPE_COUNT } from "../components/dna/constants";
import "./LandingPage.css";

const ARCHETYPES_PREVIEW = [
  {
    id: "grief-romantic", name: "The Grief Romantic", color: "#6b3a5d", glyph: "◈",
    blurb: "You return to loss like a favorite song. Sadness isn't avoided — it's curated, like brandy after dinner.",
    tagline: "Sorrow as devotion.",
  },
  {
    id: "chaos-cartographer", name: "The Chaos Cartographer", color: "#c4553a", glyph: "✦",
    blurb: "You read to feel everything at once. Your shelf is a controlled demolition of moods.",
    tagline: "All weather, all the time.",
  },
  {
    id: "soft-masochist", name: "The Soft Masochist", color: "#b8964e", glyph: "◇",
    blurb: "You keep picking up books that destroy you — and you wouldn't have it any other way.",
    tagline: "Wreck me, gently.",
  },
];

const HERO_SHELF = [
  { id: 1, title: "The Secret History", author: "Donna Tartt",     intensity: 9, emotions: [{ emotion_id: "desire" }] },
  { id: 2, title: "Beloved",            author: "Toni Morrison",   intensity: 10, emotions: [{ emotion_id: "awe" }] },
  { id: 3, title: "Bluets",             author: "Maggie Nelson",   intensity: 8, emotions: [{ emotion_id: "grief" }] },
  { id: 4, title: "Piranesi",           author: "Susanna Clarke",  intensity: 8, emotions: [{ emotion_id: "awe" }] },
  { id: 5, title: "Crying in H Mart",   author: "Michelle Zauner", intensity: 9, emotions: [{ emotion_id: "catharsis" }] },
  { id: 6, title: "Babel",              author: "R.F. Kuang",      intensity: 9, emotions: [{ emotion_id: "rage" }] },
  { id: 7, title: "On Earth We're Briefly Gorgeous", author: "Ocean Vuong", intensity: 9, emotions: [{ emotion_id: "grief" }] },
];

const STEPS = [
  { n: "01", t: "Shelve what you've read",
    d: "Search any title — we'll find it across Google Books, Open Library, and our own growing catalog. Tag the emotions it triggered. Score the intensity. Add the line you can't forget." },
  { n: "02", t: "Five books is enough",
    d: "Our engine begins reading you back. Patterns emerge from the small data: what you gravitate toward, what you avoid, what co-occurs without you noticing." },
  { n: "03", t: "Receive your DNA",
    d: "A typeset archetype card — one of eight — based on the geometry of your shelf. Yours to keep, share, or print and tape inside your favorite book." },
  { n: "04", t: "Watch yourself change",
    d: "The heatmap, the monthly recap, the slow tilt of your reading personality. The book that finally fills your blind spot. The data is yours." },
];

const MANIFESTO = [
  { x: true,  t: "Not Goodreads.",       d: "No stars, no popularity contests, no rank." },
  { x: true,  t: "Not a book tracker.",  d: "We don't count pages or set goals." },
  { x: true,  t: "Not social media.",    d: "No feeds. No followers. No noise." },
  { x: false, t: "A mirror.",            d: "A slow, patient map of how books have shaped your inner life." },
];

function Wordmark({ size = 28 }) {
  return (
    <div className="rr-wordmark" style={{ fontSize: size }}>
      Book&nbsp;<em>DNA</em>
    </div>
  );
}

export default function LandingPage({ onGetStarted }) {
  return (
    <div className="landing-rr">
      {/* ============== HERO ============== */}
      <section className="lrr-hero">
        <nav className="lrr-nav">
          <Wordmark size={28} />
          <div className="lrr-nav-links">
            <a href="#how-it-works">How it works</a>
            <a href="#archetypes">Archetypes</a>
            <a href="#manifesto">Manifesto</a>
            <button className="btn ghost" onClick={onGetStarted} style={{ fontSize: 12 }}>Sign in</button>
            <button className="btn" onClick={onGetStarted} style={{ fontSize: 12 }}>Begin →</button>
            <ThemeToggle className="rr-theme-toggle" />
          </div>
        </nav>

        <div className="lrr-hero-grid">
          <div>
            <div className="lrr-hero-eyebrow">
              <div className="rule" style={{ width: 40 }} />
              <div className="label">a private journal for readers who feel too much</div>
            </div>
            <h1 className="lrr-h1">
              The emotional<br />
              <em>fingerprint</em><br />
              of your reading life.
            </h1>
            <p className="lrr-dek">
              Not ratings. Not reviews. The <em>actual</em> weather a book left in you —
              tracked, mapped, and turned into a portrait of who you've become as a reader.
            </p>
            <div className="lrr-cta-row">
              <button className="btn brass" onClick={onGetStarted} style={{ fontSize: 14, padding: "12px 22px" }}>
                <span style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 17 }}>Discover</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.18em" }}>YOUR DNA</span>
              </button>
              <a className="lrr-link-italic" href="#how-it-works">see how it works ↓</a>
            </div>
            <div className="lrr-trust-row">
              <div className="label-sm">free forever · no ads · no feeds</div>
              <div className="lrr-trust-sep" />
              <div className="lrr-trust-text">2,841 readers shelved this week</div>
            </div>
          </div>

          <div className="lrr-hero-shelf">
            <div className="lrr-hero-glow" aria-hidden="true" />
            <div style={{ position: "relative", zIndex: 1 }}>
              <Shelf
                entries={HERO_SHELF}
                leans={{ 2: "left", 6: "right" }}
                decoration={<ShelfDecoration kind="bust" />}
                bookend
              />
            </div>
            <div className="lrr-hero-fig">
              <span>—— an actual reader's shelf, anonymised</span>
              <span className="label-sm">fig. 1</span>
            </div>
          </div>
        </div>
      </section>

      {/* ============== HOW IT WORKS ============== */}
      <section className="lrr-how paper" id="how-it-works">
        <div className="lrr-how-head">
          <div>
            <div className="label" style={{ marginBottom: 10 }}>· method ·</div>
            <h2 className="lrr-h2">How <em>Bibliome</em> works.</h2>
          </div>
          <div className="lrr-how-dek">
            A slow, small ritual. Like writing in the margins, but the margins remember.
          </div>
        </div>
        <div className="lrr-how-grid">
          {STEPS.map((s, i) => (
            <div key={s.n} className="lrr-step" style={{ borderLeft: i === 0 ? "none" : "1px solid var(--rule)" }}>
              <div className="lrr-step-num">{s.n} — STEP</div>
              <h3 className="lrr-step-t">{s.t}</h3>
              <p className="lrr-step-d">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============== ARCHETYPES ============== */}
      <section className="lrr-arch" id="archetypes">
        <div className="lrr-arch-head">
          <h2 className="lrr-h2">Which kind of <em>reader</em> are you?</h2>
          <p className="lrr-arch-dek">
            One of eight archetypes — derived from the geometry of your shelf, not a quiz.
          </p>
        </div>
        <div className="lrr-arch-grid">
          {ARCHETYPES_PREVIEW.map((a, i) => (
            <article key={a.id} className="card editorial lrr-arch-card" style={{ borderTop: `3px solid ${a.color}` }}>
              <div className="lrr-arch-card-top">
                <div className="label-sm">archetype no. {String(i + 1).padStart(2, "0")}</div>
                <div className="lrr-arch-glyph" style={{ color: a.color }}>{a.glyph}</div>
              </div>
              <h3 className="lrr-arch-name">{a.name}</h3>
              <div className="lrr-arch-tag" style={{ color: a.color }}>“{a.tagline}”</div>
              <p className="lrr-arch-blurb">{a.blurb}</p>
              <div className="lrr-arch-bars">
                {[60, 80, 38, 92, 28, 70, 50].map((w, j) => (
                  <div key={j} style={{ width: 22, height: 8, background: a.color, opacity: w / 100, borderRadius: 1 }} />
                ))}
              </div>
              <div className="label-sm" style={{ marginTop: 8 }}>emotional fingerprint</div>
            </article>
          ))}
        </div>
        <div className="lrr-arch-foot">
          {ARCHETYPE_COUNT - ARCHETYPES_PREVIEW.length} others wait inside the catalog.
        </div>
      </section>

      {/* ============== MANIFESTO ============== */}
      <section className="lrr-manifesto vellum" id="manifesto">
        <div className="lrr-manifesto-grid">
          <div>
            <div className="label" style={{ marginBottom: 16 }}>· manifesto ·</div>
            <h2 className="lrr-h2" style={{ marginBottom: 18 }}>What it <em>isn't</em>.</h2>
            <p className="lrr-manifesto-dek">We built this for ourselves first. Then for you.</p>
          </div>
          <div>
            {MANIFESTO.map((it, i) => (
              <div key={i} className="lrr-manifesto-row" style={{ borderBottom: i < MANIFESTO.length - 1 ? "1px solid var(--rule)" : "none" }}>
                <div
                  className="lrr-manifesto-mark"
                  style={{ color: it.x ? "var(--ink-faint)" : "var(--brass)", textDecoration: it.x ? "line-through" : "none" }}
                >
                  {it.x ? "×" : "✦"}
                </div>
                <div>
                  <h4 className="lrr-manifesto-t">{it.t}</h4>
                  <p className="lrr-manifesto-d">{it.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============== FINAL CTA ============== */}
      <section className="lrr-final">
        <div className="lrr-final-orn">◈</div>
        <h2 className="lrr-h2-large">
          Your books already changed you.<br />
          <em>Now see how.</em>
        </h2>
        <p className="lrr-final-dek">
          Five books. Two minutes. One quietly devastating portrait of the reader you've become.
        </p>
        <button className="btn brass" onClick={onGetStarted} style={{ fontSize: 15, padding: "14px 28px" }}>
          <span style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 18 }}>Begin</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.2em" }}>YOUR DNA</span>
        </button>

        <footer className="lrr-footer">
          <span>© {new Date().getFullYear()} BIBLIOME · made with emotional damage</span>
          <span>
            <a href="https://github.com/shrutipandey15/bibliome" target="_blank" rel="noopener noreferrer">github</a>
            <span className="lrr-sep">·</span>
            <Link to="/reset-password">reset password</Link>
            <span className="lrr-sep">·</span>
            privacy
          </span>
        </footer>
      </section>
    </div>
  );
}
