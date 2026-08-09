import { Link } from "react-router-dom";
import Shelf, { ShelfDecoration } from "../components/Shelf";
import ThemeToggle from "../components/ThemeToggle";
import { ARCHETYPE_COUNT, MIN_BOOKS } from "../components/dna/constants";
import { EMO_LIST } from "../services/emotions";
import "./LandingPage.css";

// Three of the eight, verbatim from the engine that actually assigns them
// (app/services/dna_engine.py PERSONALITY_TYPES) — id, name, colour, glyph and
// description all copied, not paraphrased.
//
// This block used to advertise "The Chaos Cartographer", which does not exist
// and never has: a reader could be sold an archetype the engine cannot return.
// Two of the three real ones also carried another archetype's colour and glyph.
// If these drift again, the engine is the source of truth, not this file.
const ARCHETYPES_PREVIEW = [
  {
    id: "grief_romantic", name: "The Grief Romantic", color: "#3A5A6B", glyph: "◈",
    blurb: "You seek books that break your heart because feeling deeply is how you know you're alive. Loss isn't your enemy — numbness is.",
  },
  {
    id: "midnight_arsonist", name: "The Midnight Arsonist", color: "#C47A3A", glyph: "△",
    blurb: "You read like you're setting fire to your own beliefs. Comfort zones are for people who haven't found the right book yet.",
  },
  {
    id: "comfort_architect", name: "The Comfort Architect", color: "#7A8B6F", glyph: "○",
    blurb: "You build emotional safety through stories. Your bookshelf isn't a collection — it's a home you can always return to.",
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

// Every claim below is a thing the app does today. Copy that describes an
// unbuilt feature is the same failure as a fabricated number.
const STEPS = [
  { n: "01", t: "Put the book on the shelf",
    d: `Type a title and we look for it in Google Books, Open Library and our own catalog at once — cover, author and all. Or type it in yourself; the search never blocks the save.` },
  { n: "02", t: "Say what it did to you",
    d: `Not a rating. Pick from ${EMO_LIST.length} feelings, grouped into five families you open one at a time, and give each one a strength. Keep the line you couldn't forget.` },
  { n: "03", t: "Finish it in three beats",
    d: "A book doesn't leave you the way it found you, so finishing one asks three times: how it began, how it felt in the thick of it, how it left you. That arc is what a star can't hold." },
  { n: "04", t: `After ${MIN_BOOKS} books, it reads you back`,
    d: `Your archetype — one of ${ARCHETYPE_COUNT} — plus the patterns underneath it: what you reach for, what shows up together, and the feelings you have never once recorded.` },
];

// The constraints that make Resonance bearable rather than another inbox. All
// four are enforced server-side, not merely honoured by the client.
const RESONANCE_RULES = [
  { t: "Three at a time, at most.",
    d: "Not an inbox and not a feed. A handful of suggestions, and only when the books genuinely line up." },
  { t: "You can't go looking.",
    d: "There is no search for people, no browsing, no profile to visit. You can only answer what the shelf surfaces." },
  { t: "A no is silent.",
    d: "Decline and the card is simply gone. The other reader is never told, and never sees it happen." },
  { t: "Matched on the book, not on you.",
    d: "The only inputs are a shared book and the feelings you both recorded for it. Nothing counts how much you read, or who you know." },
];

// "No feeds" was too broad to be true — Echo exists. But it is built so it
// *cannot* become one, and saying exactly that is both accurate and a better
// argument than the overclaim.
const MANIFESTO = [
  { x: true,  t: "Not Goodreads.",      d: "No stars. No rankings. Nothing to be popular in." },
  { x: true,  t: "Not a tracker.",      d: "No page counts, no yearly goals, no streaks to break." },
  { x: true,  t: "Not a follower app.", d: "Nobody can follow you. There are no counts on anything, anywhere." },
  { x: false, t: "A mirror, with three doors.", d: "One small public room that ends in “you're caught up.” One reader at a time, when a book lines up. One journal, encrypted so that even we can't read it." },
];

function Wordmark({ size = 28 }) {
  return (
    <div className="rr-wordmark" style={{ fontSize: size }}>
      Biblio<em>me</em>
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
            <a href="#resonance">Resonance</a>
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
              Instead of giving a book stars, you record what it <em>did</em> to you —
              which feelings it pulled, how hard, and how it left you. After {MIN_BOOKS} books,
              your shelf starts describing you back.
            </p>
            <div className="lrr-cta-row">
              <button className="btn brass" onClick={onGetStarted} style={{ fontSize: 14, padding: "12px 22px" }}>
                <span style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 17 }}>Discover</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.18em" }}>YOUR DNA</span>
              </button>
              <a className="lrr-link-italic" href="#how-it-works">see how it works ↓</a>
            </div>
            <div className="lrr-trust-row">
              {/* Every one of these is enforced in code: there is no follower
                  model, no ranking, and no count rendered on any surface. */}
              <div className="label-sm">free · no ads · no followers · no rankings</div>
              <div className="lrr-trust-sep" />
              {/* This slot used to read "2,841 readers shelved this week" — a
                  hardcoded string, derived from nothing. A fabricated number is
                  bad enough on a product whose first rule is honest states or
                  none; a *reader count* is also the exact comparative metric the
                  rest of the app refuses to render. So: the shape of the thing,
                  counted from the constants that actually define it. */}
              <div className="lrr-trust-text">
                {EMO_LIST.length} emotions · {ARCHETYPE_COUNT} archetypes · {MIN_BOOKS} books to begin
              </div>
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
            {/* Was captioned "an actual reader's shelf, anonymised". It is
                seven titles hardcoded twenty lines up — the same fabrication as
                the invented reader count that used to sit in the trust row. */}
            <div className="lrr-hero-fig">
              <span>—— a shelf, spines coloured by what each book pulled</span>
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
            Four small steps, each one a minute. Like writing in the margins, except the margins remember.
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
            One of {ARCHETYPE_COUNT}, worked out from what you actually recorded — never a quiz,
            and never something you pick for yourself.
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
              <p className="lrr-arch-blurb">{a.blurb}</p>
              {/* A seven-bar strip of fixed values labelled "emotional
                  fingerprint" used to sit here. The real fingerprint is a bar
                  per feeling drawn from a reader's own tally, so this was a
                  picture of a number nobody had. An archetype has no fingerprint
                  of its own — only a reader does. */}
            </article>
          ))}
        </div>
        <div className="lrr-arch-foot">
          The other {ARCHETYPE_COUNT - ARCHETYPES_PREVIEW.length} you meet by reading.
        </div>
      </section>

      {/* ============== RESONANCE ============== */}
      {/* Every claim here is enforced in app/services/resonance_service.py:
          SURFACE_LIMIT = 3, identity withheld until `connected`, a decline
          never reported back, and an explicit "nothing is counted here". */}
      <section className="lrr-res" id="resonance">
        <div className="lrr-res-grid">
          <div>
            <div className="label" style={{ marginBottom: 10 }}>· resonance ·</div>
            <h2 className="lrr-h2">The other reader who <em>felt it too</em>.</h2>
            <p className="lrr-res-dek">
              Once in a while the app notices that someone else recorded the same book
              the same way you did — the same feelings, at close to the same strength —
              and offers you exactly one way to say so.
            </p>
            <p className="lrr-res-dek">
              You write a note first. They see the note, not you. If they write back,
              the letters open and you both learn who the other is at the same moment.
              If they don't, nothing happens, and you are never told.
            </p>
          </div>
          <ul className="lrr-res-rules">
            {RESONANCE_RULES.map((r) => (
              <li key={r.t} className="lrr-res-rule">
                <span className="lrr-res-mark" aria-hidden="true">·</span>
                <div>
                  <h3 className="lrr-res-t">{r.t}</h3>
                  <p className="lrr-res-d">{r.d}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ============== MANIFESTO ============== */}
      <section className="lrr-manifesto vellum" id="manifesto">
        <div className="lrr-manifesto-grid">
          <div>
            <div className="label" style={{ marginBottom: 16 }}>· manifesto ·</div>
            <h2 className="lrr-h2" style={{ marginBottom: 18 }}>What it <em>isn't</em>.</h2>
            <p className="lrr-manifesto-dek">
              Most of what a reading app usually does, this one deliberately doesn't.
              Everything private unless you say otherwise.
            </p>
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
        {/* "Two minutes" was a claim about logging five books, which it isn't. */}
        <p className="lrr-final-dek">
          {MIN_BOOKS} books is all it takes to start. Begin with the one you'd lend out reluctantly.
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
            {/* "privacy" sat here as bare text between two separators, so it
                read as a third link and went nowhere. There is no privacy page
                to point it at yet. */}
            <Link to="/reset-password">reset password</Link>
          </span>
        </footer>
      </section>
    </div>
  );
}
