import { useEffect } from "react";

/**
 * Per-route <head> tags for a single-page app. [#2]
 *
 * index.html ships one fixed head, so every route was serving the landing
 * page's title, description and canonical — /privacy claimed to be the
 * marketing page, and every URL declared itself canonical at "/". That is the
 * thing that blocked the SEO pages, so this sets them per route instead.
 *
 * Deliberately hand-rolled rather than react-helmet: the head is a dozen tags
 * and one effect, and a dependency that ships a context provider plus its own
 * reconciler is a poor trade for that.
 *
 * KNOWN LIMIT — read before trusting this for sharing. These tags are written
 * by JavaScript after load. Google renders JS and will see them. The social
 * scrapers (Facebook, Twitter/X, Slack, iMessage, WhatsApp, LinkedIn) do NOT
 * execute JS: they read the raw HTML and therefore always see the static
 * og:image and og:title from index.html. So this fixes titles, descriptions and
 * canonicals for search, but it does NOT give a shared /s/:token link its own
 * preview card — that needs the server to render the tags, which is the
 * separate per-card OG work.
 */

// Mirrors index.html. Anything a route does not override is restored to this
// on unmount, so one route's title can't leak into the next.
const DEFAULTS = {
  title: "Bibliome — The Emotional Fingerprint of Your Reading Life",
  description:
    "Discover your unique reading personality. Bibliome maps the emotions your books triggered, the patterns you didn't know you had, and the reader you've become. Free. No ads.",
  canonical: "https://bibliome.app/",
  ogType: "website",
  ogTitle: "Bibliome — The Emotional Fingerprint of Your Reading Life",
  ogDescription:
    "Every book you've ever loved changed you. Bibliome maps how — tracking 18 emotions across your library to reveal your unique reading personality.",
  ogImage: "https://bibliome.app/og-image.png",
  robots: "index, follow",
};

const SITE = "https://bibliome.app";

/** Find-or-create a tag, so we update index.html's tags rather than duplicating them. */
function upsert(selector, create) {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  return el;
}

function setMeta(attr, name, content) {
  const el = upsert(`meta[${attr}="${name}"]`, () => {
    const m = document.createElement("meta");
    m.setAttribute(attr, name);
    return m;
  });
  el.setAttribute("content", content);
}

function apply(head) {
  const tags = { ...DEFAULTS, ...head };

  // A path is allowed as a convenience; absolute URLs pass through untouched.
  const canonical = tags.canonical.startsWith("http")
    ? tags.canonical
    : SITE + tags.canonical;

  document.title = tags.title;
  setMeta("name", "description", tags.description);
  setMeta("name", "robots", tags.robots);

  upsert('link[rel="canonical"]', () => {
    const l = document.createElement("link");
    l.setAttribute("rel", "canonical");
    return l;
  }).setAttribute("href", canonical);

  // og:title and og:description fall back to the page title/description rather
  // than to the site defaults — a route that bothers to set a title almost
  // never wants the landing page's copy in its share card.
  setMeta("property", "og:url", canonical);
  setMeta("property", "og:type", tags.ogType);
  setMeta("property", "og:title", head.ogTitle || tags.title);
  setMeta("property", "og:description", head.ogDescription || tags.description);
  setMeta("property", "og:image", tags.ogImage);
  setMeta("name", "twitter:title", head.ogTitle || tags.title);
  setMeta("name", "twitter:description", head.ogDescription || tags.description);
  setMeta("name", "twitter:image", tags.ogImage);
}

/**
 * @param {object} head - any of: title, description, canonical, ogType,
 *   ogTitle, ogDescription, ogImage, robots. Omitted keys use the site default.
 */
export function useHead(head) {
  // Serialised so a caller can pass an object literal without re-firing the
  // effect on every render.
  const key = JSON.stringify(head);

  useEffect(() => {
    apply(JSON.parse(key));
    return () => apply({});
  }, [key]);
}

export default useHead;
