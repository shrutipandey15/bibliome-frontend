// One renderer for the content pages, used twice.
//
// vite.config.js calls these at build time to bake each page into its own
// dist/<route>/index.html, so a crawler that runs no JavaScript gets the whole
// page. The React routes in pages/ContentPages.jsx then drop the SAME string in
// with dangerouslySetInnerHTML, so in-app navigation shows exactly what the
// crawler saw. Two consumers, one markup — the alternative was a JSX version
// and a Node string version drifting apart within a month.
//
// dangerouslySetInnerHTML is safe here because every input is a literal in
// data/archetypes.js and data/comparisons.js. If any of this ever comes from a
// user or the API, this file needs real escaping, not just `esc` below.
//
// Dependency-free on purpose: Node imports it directly during the build.

import { ARCHETYPES } from "./archetypes.js";
import { COMPARISONS } from "./comparisons.js";

export const SITE = "https://bibliome.app";

// These pages are served as dist/<route>/index.html, i.e. as directories. nginx
// (try_files $uri $uri/ /index.html) resolves a directory through its index, and
// depending on the request it may 301 the slashless form to the slashed one. So
// the slashed form is the one URL that is always final, and it is what the
// canonical, og:url, the sitemap and every internal link use. react-router
// ignores a trailing slash, so in-app navigation is unaffected.
export const href = (path) => `${path}/`;
export const urlFor = (path) => `${SITE}${path}/`;

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const attr = (s) => esc(s).replace(/"/g, "&quot;");

const sections = (list) =>
  list
    .map(
      (s) =>
        `<section><h2>${esc(s.h)}</h2>${s.p.map((t) => `<p>${esc(t)}</p>`).join("")}</section>`,
    )
    .join("");

// ── /archetypes/:slug ──
export function renderArchetype(a) {
  return (
    `<article class="cp cp-archetype" style="--cp-accent:${attr(a.color)}">` +
    `<nav class="cp-crumb"><a href="/">Bibliome</a> <span>/</span> <a href="${href('/archetypes')}">Reading archetypes</a></nav>` +
    `<header class="cp-head"><div class="cp-glyph" aria-hidden="true">${esc(a.glyph)}</div>` +
    `<h1>${esc(a.name)}</h1><p class="cp-tagline">${esc(a.tagline)}</p></header>` +
    sections(a.sections) +
    `<section><h2>At a glance</h2><dl class="cp-dl">` +
    `<dt>Emotions that produce it</dt><dd>${a.primary.map(esc).join(", ")}</dd>` +
    `<dt>Emotions it avoids</dt><dd>${a.anti.map(esc).join(", ")}</dd>` +
    `<dt>Comfort tropes</dt><dd>${a.tropes.map(esc).join(" · ")}</dd>` +
    `<dt>Blind spots</dt><dd>${a.blindSpots.map(esc).join(" · ")}</dd>` +
    `</dl></section>` +
    `<section class="cp-cta"><h2>Which one are you?</h2>` +
    `<p>Bibliome does not let you pick. Log 5 books against the 18 emotions and the engine assigns one of the 8 from what you actually recorded. Free, no ads, and the journal is end-to-end encrypted.</p>` +
    `<p><a class="cp-btn" href="/">Start your Reading DNA</a></p></section>` +
    `<nav class="cp-more"><h2>The other seven</h2><ul>` +
    ARCHETYPES.filter((o) => o.slug !== a.slug)
      .map((o) => `<li><a href="${href(`/archetypes/${o.slug}`)}">${esc(o.name)}</a></li>`)
      .join("") +
    `</ul></nav></article>`
  );
}

// ── /archetypes ──
export function renderArchetypeIndex() {
  return (
    `<article class="cp cp-index">` +
    `<nav class="cp-crumb"><a href="/">Bibliome</a> <span>/</span> Reading archetypes</nav>` +
    `<header class="cp-head"><h1>The 8 reading archetypes</h1>` +
    `<p class="cp-tagline">Bibliome does not ask what you read. It asks what the book did to you, across 18 emotions in five families. After 5 books it reads the pattern back as one of these eight — assigned from what you recorded, never a quiz and never something you pick.</p></header>` +
    `<ul class="cp-cards">` +
    ARCHETYPES.map(
      (a) =>
        `<li style="--cp-accent:${attr(a.color)}"><a href="${href(`/archetypes/${a.slug}`)}">` +
        `<span class="cp-glyph" aria-hidden="true">${esc(a.glyph)}</span>` +
        `<h2>${esc(a.name)}</h2><p>${esc(a.tagline)}</p></a></li>`,
    ).join("") +
    `</ul>` +
    sections([
      {
        h: "What a reading archetype is",
        p: [
          "A reading archetype is a description of the reader, derived from the reading. It is not a genre preference and it is not a personality quiz result — Bibliome never asks you to pick one, and there is no way to choose.",
          "The input is emotional. Every time you finish a book you record what it did to you: which of the 18 emotions it pulled, from five families — it messed me up, it held me, the yearning, it hit different, and it lost me — and how strongly each one landed. No stars, no page counts, no rating out of ten.",
          "After five books there is enough signal to score. The engine compares the emotions your shelf actually recorded against each archetype's three defining emotions and its two anti-emotions — the feelings that archetype conspicuously does not log. The anti-emotions do as much work as the primaries: two readers can both log a great deal of grief and end up in different places entirely based on whether they ever record the release afterwards.",
        ],
      },
      {
        h: "Why eight",
        p: [
          "Eight is what the emotion vocabulary can actually distinguish. Each archetype is anchored on a triple of emotions that no other archetype holds in full, so a shelf cannot sit ambiguously between two of them forever — and the set has been re-anchored more than once when two started collecting the same readers.",
          "It also means an archetype is falsifiable. If your reading changes, the label changes with it, and Bibliome will tell you it shifted rather than quietly keeping the old one.",
        ],
      },
    ]) +
    `<section class="cp-cta"><h2>Get yours</h2>` +
    `<p>Free, no ads, no data selling, and the private journal is end-to-end encrypted in your browser.</p>` +
    `<p><a class="cp-btn" href="/">Start your Reading DNA</a></p></section></article>`
  );
}

// ── /vs/:slug ──
export function renderCompare(c) {
  return (
    `<article class="cp cp-compare">` +
    `<nav class="cp-crumb"><a href="/">Bibliome</a> <span>/</span> ${esc(c.title)}</nav>` +
    `<header class="cp-head"><h1>${esc(c.title)}</h1><p class="cp-tagline">${esc(c.intro)}</p></header>` +
    `<section><h2>Side by side</h2><div class="cp-tablewrap"><table><thead><tr>` +
    `<th scope="col"></th><th scope="col">Bibliome</th><th scope="col">${esc(c.other)}</th>` +
    `</tr></thead><tbody>` +
    c.table
      .map(
        ([k, mine, theirs]) =>
          `<tr><th scope="row">${esc(k)}</th><td>${esc(mine)}</td><td>${esc(theirs)}</td></tr>`,
      )
      .join("") +
    `</tbody></table></div></section>` +
    sections(c.sections) +
    `<section class="cp-cta"><h2>Try it</h2>` +
    `<p>Bibliome is free, has no ads and sells no data. Import your ${esc(c.other)} library as a CSV and start logging what the next book does to you.</p>` +
    `<p><a class="cp-btn" href="/">Start your Reading DNA</a></p></section>` +
    `<nav class="cp-more"><ul>` +
    COMPARISONS.filter((o) => o.slug !== c.slug)
      .map((o) => `<li><a href="${href(`/vs/${o.slug}`)}">${esc(o.title)}</a></li>`)
      .join("") +
    `<li><a href="${href('/archetypes')}">The 8 reading archetypes</a></li>` +
    `</ul></nav></article>`
  );
}

// ── Every prerendered content route, with its head tags and JSON-LD. ──
// vite.config.js and the React routes both read this list, so a new page is
// added in exactly one place.
export const CONTENT_ROUTES = [
  {
    path: "/archetypes",
    title: "The 8 Reading Archetypes — Bibliome",
    description:
      "The eight reading archetypes Bibliome can assign, from the Grief Romantic to the Emotional Archaeologist — what each one is, and the emotions that produce it.",
    html: renderArchetypeIndex,
    jsonLd: () => ({
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "The 8 reading archetypes",
      url: urlFor("/archetypes"),
      hasPart: ARCHETYPES.map((a) => ({
        "@type": "DefinedTerm",
        name: a.name,
        description: a.tagline,
        url: urlFor(`/archetypes/${a.slug}`),
        inDefinedTermSet: urlFor("/archetypes"),
      })),
    }),
  },
  ...ARCHETYPES.map((a) => ({
    path: `/archetypes/${a.slug}`,
    title: `${a.name} — Bibliome reading archetype`,
    description: a.blurb,
    html: () => renderArchetype(a),
    jsonLd: () => ({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "DefinedTerm",
          name: a.name,
          description: a.tagline,
          url: urlFor(`/archetypes/${a.slug}`),
          inDefinedTermSet: {
            "@type": "DefinedTermSet",
            name: "Bibliome reading archetypes",
            url: urlFor("/archetypes"),
          },
        },
        {
          "@type": "Article",
          headline: `${a.name} — Bibliome reading archetype`,
          description: a.blurb,
          url: urlFor(`/archetypes/${a.slug}`),
          about: { "@type": "DefinedTerm", name: a.name },
          isPartOf: { "@type": "WebSite", name: "Bibliome", url: SITE },
          publisher: { "@type": "Organization", name: "Bibliome", url: SITE },
        },
      ],
    }),
  })),
  ...COMPARISONS.map((c) => ({
    path: `/vs/${c.slug}`,
    title: `${c.title} — an honest comparison`,
    description: c.blurb,
    html: () => renderCompare(c),
    jsonLd: () => ({
      "@context": "https://schema.org",
      "@type": "Article",
      headline: c.title,
      description: c.blurb,
      url: urlFor(`/vs/${c.slug}`),
      isPartOf: { "@type": "WebSite", name: "Bibliome", url: SITE },
      publisher: { "@type": "Organization", name: "Bibliome", url: SITE },
    }),
  })),
];

export const routeByPath = (p) =>
  CONTENT_ROUTES.find((r) => r.path === p.replace(/\/+$/, "") || r.path === p);
