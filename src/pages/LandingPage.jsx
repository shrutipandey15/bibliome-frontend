import { useEffect, useRef, useState } from "react";
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
  { n: "03", t: "Walk it back in three beats",
    d: "A book doesn't leave you the way it found you. When you finish one, you can trace the arc — how it began, how it felt in the thick of it, how it left you. Take it when a book earns it, skip it when it doesn't. That arc is what a star can't hold." },
  { n: "04", t: `After ${MIN_BOOKS} books, it starts reading you back`,
    d: `A first insight or two, pulled only from what you recorded — and usually, though not always, an archetype (one of ${ARCHETYPE_COUNT}; it would rather say nothing than guess). The deeper patterns — what shows up together, the feelings you never reach for — wait on a bigger shelf, and it won't fake them to fill the page.` },
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

// The single source for the FAQ. It renders the visible section AND is
// serialised into FAQPage JSON-LD (injected below, in an effect — Google
// renders JS and reads it). The <noscript> block in index.html carries a
// shorter prose copy for crawlers that don't run JS; keep the two roughly
// aligned when a claim changes, but the structured data comes from here.
// Numbers come from the same constants as the rest of the page.
const FAQ = [
  { q: "What is Bibliome?",
    d: `A private journal for readers. Instead of rating a book, you record what it did to you — which of ${EMO_LIST.length} emotions it pulled, how hard, and how it left you. After ${MIN_BOOKS} books it reads your patterns back as a reading archetype.` },
  { q: "Is Bibliome an emotion or mood book tracker?",
    d: `Yes — that's the whole idea. You log each book against ${EMO_LIST.length} emotions grouped into five families, with a strength for each, instead of a star rating or a mood tag. Over time the emotions become a picture of you as a reader.` },
  { q: "Is Bibliome free?",
    d: "Yes — free, with no ads, no third-party analytics or tracking scripts, and no data selling." },
  { q: "How is Bibliome different from Goodreads?",
    d: "No stars, no rankings, no page counts, no yearly goals, no streaks, no followers. Bibliome records how a book made you feel; Goodreads records that you read it." },
  { q: "How is Bibliome different from The StoryGraph?",
    d: "The StoryGraph analyses mood and pace to recommend your next read. Bibliome isn't a recommendation engine — it's a private emotional record of the books you've already read, and it turns that record into a reading personality rather than a to-read list." },
  { q: "Can I import my books from Goodreads or StoryGraph?",
    d: "Yes. Export your library as a CSV from Goodreads or The StoryGraph and upload it; Bibliome imports the titles and tells you honestly how many parsed, imported, and were skipped." },
  { q: "Is my reading journal private?",
    d: "The private journal is end-to-end encrypted in your browser before it's sent. We can't read it — not from the database, not from a backup, not if compelled. You can export or delete everything yourself." },
  { q: "How do I record how a book made me feel?",
    d: `You open one emotion family at a time, pick the feelings that fit from the ${EMO_LIST.length}, and give each a strength. You can keep the line you couldn't forget, and when you finish a book you can trace its arc — how it began, how it felt in the thick of it, how it left you.` },
  { q: "What is Reading DNA and a reading archetype?",
    d: `Reading DNA is the profile Bibliome builds from your emotional patterns — the feelings you reach for, the ones you avoid, what shows up together. A reading archetype is the human-readable summary of that: one of ${ARCHETYPE_COUNT}, such as the Grief Romantic or the Comfort Architect.` },
  { q: "How many books before I get an archetype?",
    d: `${MIN_BOOKS}. After ${MIN_BOOKS} logged books the engine offers a first insight or two and usually an archetype — one of ${ARCHETYPE_COUNT}, assigned from what you recorded, never a quiz and never something you pick. Deeper patterns wait on a bigger shelf.` },
  { q: "What are the reading archetypes?",
    d: `Examples include the Grief Romantic, the Midnight Arsonist, and the Comfort Architect. There are ${ARCHETYPE_COUNT} in total, each assigned from the emotional patterns in your own reading.` },
  { q: "Can I share my Reading DNA?",
    d: "Yes. Each profile has a shareable card at its own link that anyone can open without an account. Nothing else on your profile is public." },
  { q: "Does Bibliome connect me with other readers?",
    d: "In one narrow way, called Resonance. When someone else has recorded the same book with almost the same feelings at almost the same strength, Bibliome offers you a single way to say so — you write a note first, they see the note and not you, and if they write back you both learn who the other is at the same moment." },
  { q: "How does Resonance match readers?",
    d: "Only on a shared book and the emotions you both recorded for it — never on how much you read, who you know, or anything social. You get at most three suggestions at a time, you can't search for people, and a decline is silent: the other reader is never told." },
  { q: "Can I read together with friends or share a reading list?",
    d: "Yes, through Collections. A collection is a curated set of books you can keep private or open to any signed-in reader, and you can invite specific people with a link. Each book in a shared collection has its own discussion page." },
  { q: "Can I follow people or see follower counts?",
    d: "No. Nobody can follow you, and there are no counts on anything, anywhere — no followers, no likes tallied, no leaderboards. It's built so it can't become a social feed." },
  { q: "What are Echoes?",
    d: "Echoes are Bibliome's one small public room: short notes about what a book did to you, in a chronological feed that ends with “you're caught up.” There's no path from an Echo to someone's profile or other posts, and you can block, mute, or report." },
  { q: "Is there a Bibliome mobile app?",
    d: "Bibliome is a web app that installs to your home screen on phones and desktops, works offline for reading, and can send push notifications. There's no separate App Store or Play Store download." },
  { q: "Does Bibliome track pages read, reading speed, or yearly goals?",
    d: "No. There are no page counts, no reading-speed stats, no yearly challenges, and no streaks. The only thing it measures is how books made you feel." },
];

function Wordmark({ size = 28 }) {
  return (
    <div className="rr-wordmark" style={{ fontSize: size }}>
      Biblio<em>me</em>
    </div>
  );
}

export default function LandingPage({ onGetStarted }) {
  // ── The phone's persistent CTA ──
  // This page is ten screens on a phone and the only way to act on it sits at
  // the very top and the very bottom. A reader convinced somewhere in the
  // middle — at the archetypes, usually — has to scroll to one end to do
  // anything about it. So a bar carries the offer with them.
  //
  // It is deliberately conditional rather than always-on: it appears only once
  // the hero's own CTA has left the screen, and disappears again as the final
  // one arrives. Two live copies of the same button on screen at once is the
  // thing that makes these bars feel like an ad rather than a convenience.
  // CSS-hidden above 640 — the observer costs nothing there, and gating it on a
  // width read in JS would need re-running on resize to stay honest.
  const [showCta, setShowCta] = useState(false);
  const heroCtaRef = useRef(null);
  const finalCtaRef = useRef(null);

  // FAQPage structured data, built from the same FAQ array the section renders
  // so the two can't disagree. Injected here rather than in index.html because
  // that copy would have to be hand-kept in sync; Google runs JS and reads this.
  useEffect(() => {
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.d },
      })),
    });
    document.head.appendChild(el);
    return () => el.remove();
  }, []);

  useEffect(() => {
    const targets = [heroCtaRef.current, finalCtaRef.current].filter(Boolean);
    // jsdom implements neither, and an old browser simply keeps the two
    // in-page CTAs it already had.
    if (typeof IntersectionObserver !== "function" || targets.length === 0) return;

    const onScreen = new Set();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) onScreen.add(e.target);
          else onScreen.delete(e.target);
        }
        setShowCta(onScreen.size === 0);
      },
      // A CTA half off the bottom edge still counts as present — the bar must
      // not flash in for the moment it takes to scroll past one.
      { rootMargin: "-15% 0px -15% 0px" },
    );
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, []);

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
            <a href="#faq">FAQ</a>
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
            <div className="lrr-cta-row" ref={heroCtaRef}>
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
          {/* The dividing rule used to be an inline `borderLeft` on every step
              but the first. Inline styles outrank any stylesheet, so when the
              grid folds to one column on a phone the vertical rule came with
              it — a hairline down the left of steps 2–4, dividing nothing. It
              lives in CSS now, where the mobile tier can turn it into the
              horizontal rule the stacked layout actually wants. */}
          {STEPS.map((s) => (
            <div key={s.n} className="lrr-step">
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

      {/* ============== FAQ ============== */}
      <section className="lrr-faq paper" id="faq">
        <div className="label" style={{ marginBottom: 10 }}>· questions ·</div>
        <h2 className="lrr-h2">Frequently <em>asked</em>.</h2>
        <div className="lrr-faq-list">
          {FAQ.map((f) => (
            <details key={f.q} className="lrr-faq-item">
              <summary className="lrr-faq-q">{f.q}</summary>
              <p className="lrr-faq-d">{f.d}</p>
            </details>
          ))}
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
        <button ref={finalCtaRef} className="btn brass lrr-final-btn" onClick={onGetStarted} style={{ fontSize: 15, padding: "14px 28px" }}>
          <span style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 18 }}>Begin</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.2em" }}>YOUR DNA</span>
        </button>

        <footer className="lrr-footer">
          <span>© {new Date().getFullYear()} BIBLIOME · made with emotional damage</span>
          <span>
            <a href="https://github.com/shrutipandey15/bibliome" target="_blank" rel="noopener noreferrer">github</a>
            <span className="lrr-sep">·</span>
            {/* "privacy" used to sit here as bare text between two separators —
                it read as a link and went nowhere, because there was no page.
                There is now. */}
            <Link to="/privacy">privacy</Link>
            <span className="lrr-sep">·</span>
            <Link to="/terms">terms</Link>
            <span className="lrr-sep">·</span>
            <Link to="/reset-password">reset password</Link>
          </span>
        </footer>
      </section>

      {/* Last in the DOM so it is last in the tab order too — a fixed bar that
          intercepts the first Tab into the page is worse than no bar. Its
          hidden state is `visibility: hidden` rather than opacity alone, which
          is what takes it out of the tab order and away from screen readers
          instead of leaving an invisible button over the footer. */}
      <div className={`lrr-stickycta ${showCta ? "is-shown" : ""}`}>
        <span className="lrr-stickycta-copy">{MIN_BOOKS} books to begin</span>
        <button className="btn brass lrr-stickycta-btn" onClick={onGetStarted}>
          <span style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 16 }}>Begin</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.18em" }}>YOUR DNA</span>
        </button>
      </div>
    </div>
  );
}
