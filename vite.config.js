/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { CONTENT_ROUTES, SITE, urlFor } from "./src/data/pageHtml.js";

// One id per build. The running app carries this baked in (see __BUILD_ID__
// below); a slim /version.json carrying the same value is written into the
// build output and served in dev, so a long-lived PWA window can notice it has
// gone stale and reload itself. See src/hooks/useAppUpdate.js.
const BUILD_ID = process.env.BUILD_ID || new Date().toISOString();

function versionManifest() {
  const body = JSON.stringify({ buildId: BUILD_ID }) + "\n";
  const serveVersion = (req, res, next) => {
    if ((req.url || "").split("?")[0] !== "/version.json") return next();
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    res.end(body);
  };
  let outDir = "dist";
  return {
    name: "bibliome-version-manifest",
    configResolved(cfg) {
      outDir = cfg.build.outDir;
    },
    configureServer(server) {
      // Without this the dev-mode watcher's fetch would 404 every poll.
      server.middlewares.use(serveVersion);
    },
    configurePreviewServer(server) {
      server.middlewares.use(serveVersion);
    },
    closeBundle() {
      writeFileSync(resolve(outDir, "version.json"), body);
    },
  };
}


// ── Prerender the marketing routes ──
//
// nginx serves the same static index.html for every path (try_files $uri $uri/
// /index.html), so before this every route was a blank #root plus a hand-written
// <noscript> — fine for the landing page, useless for ten content pages. The
// answer engines this content is aimed at (GPTBot, ClaudeBot, PerplexityBot) do
// not run JavaScript, and neither do the social scrapers.
//
// So each content route gets its own dist/<route>/index.html: the built
// index.html with its head tags swapped and the page's markup already inside
// #root. try_files picks the directory up via $uri/ with no nginx change.
//
// Not SSR. The body is a plain string from src/data/pageHtml.js — the same
// string the React route renders — and React's createRoot() replaces #root
// wholesale on mount, so there is no hydration to mismatch. That is the whole
// reason this is 40 lines instead of a second build pass through react-dom/server.
//
// ponytail: static routes only. A /s/:token share card can't be baked at build
// time — that one still needs the per-request OG middleware in the backend.
function prerenderContent() {
  let outDir = "dist";

  const headFor = (route) => {
    const url = urlFor(route.path);
    return [
      `<title>${route.title}</title>`,
      `<meta name="description" content="${route.description.replace(/"/g, "&quot;")}" />`,
      `<link rel="canonical" href="${url}" />`,
      `<meta property="og:url" content="${url}" />`,
      `<meta property="og:title" content="${route.title}" />`,
      `<meta property="og:description" content="${route.description.replace(/"/g, "&quot;")}" />`,
      `<meta name="twitter:title" content="${route.title}" />`,
      `<meta name="twitter:description" content="${route.description.replace(/"/g, "&quot;")}" />`,
      `<script type="application/ld+json">${JSON.stringify(route.jsonLd())}</script>`,
    ].join("\n    ");
  };

  return {
    name: "bibliome-prerender-content",
    configResolved(cfg) {
      outDir = cfg.build.outDir;
    },
    closeBundle() {
      const shell = readFileSync(resolve(outDir, "index.html"), "utf8");
      for (const route of CONTENT_ROUTES) {
        let html = shell
          // The landing page's own title/description/canonical/og would
          // otherwise sit in every content page's head alongside the new ones.
          .replace(/<title>.*?<\/title>/s, "__HEAD__")
          .replace(/\s*<meta name="description"[^>]*>/, "")
          .replace(/\s*<link rel="canonical"[^>]*>/, "")
          .replace(/\s*<meta property="og:(url|title|description)"[^>]*>/g, "")
          .replace(/\s*<meta name="twitter:(title|description)"[^>]*>/g, "")
          // The landing page's FAQPage JSON-LD does not belong on an
          // archetype page; the route brings its own.
          .replace(/\s*<script type="application\/ld\+json">\s*\{\s*"@context"[^]*?"@type": "FAQPage"[^]*?<\/script>/, "")
          // ...nor does the landing-page <noscript> prose.
          .replace(/\s*<noscript>\s*<h1>The emotional fingerprint[^]*?<\/noscript>/, "")
          .replace("__HEAD__", headFor(route))
          .replace('<div id="root"></div>', `<div id="root">${route.html()}</div>`);

        const file = resolve(outDir, route.path.replace(/^\//, ""), "index.html");
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, html);
      }

      // A crawl path from the homepage. The in-app link to /archetypes/ is
      // rendered by React, so GPTBot, ClaudeBot and PerplexityBot — which run
      // no JS and are the whole reason these pages exist — could reach them
      // only via the sitemap. This puts real <a> tags in the landing page's
      // <noscript>, generated from the same route list so it cannot go stale.
      // Written after the loop so the content pages, which strip this
      // <noscript> and carry their own footer nav, don't inherit it.
      const crawlPath =
        "<h2>Reading archetypes and comparisons</h2><ul>" +
        CONTENT_ROUTES.map(
          (r) => `<li><a href="${r.path}/">${r.title.split(" — ")[0]}</a></li>`,
        ).join("") +
        "</ul>";
      // The LAST </noscript>: the first one closes the <noscript><style> block
      // that styles this very fallback, and String.replace takes the first match.
      const closeAt = shell.lastIndexOf("</noscript>");
      writeFileSync(
        resolve(outDir, "index.html"),
        shell.slice(0, closeAt) + crawlPath + shell.slice(closeAt),
      );

      // Sitemap, regenerated with the content routes and a real lastmod. The
      // hand-maintained public/sitemap.xml it overwrites said to do this "once
      // real pages land".
      const today = new Date().toISOString().slice(0, 10);
      const urls = [
        { loc: "/", changefreq: "weekly", priority: "1.0" },
        ...CONTENT_ROUTES.map((r) => ({
          // Slashed: that is the URL the directory actually resolves to, and
          // the one the page declares canonical.
          loc: `${r.path}/`,
          changefreq: "monthly",
          priority: r.path === "/archetypes" ? "0.9" : "0.8",
        })),
        { loc: "/login", changefreq: "monthly", priority: "0.6" },
        { loc: "/privacy", changefreq: "monthly", priority: "0.4" },
        { loc: "/terms", changefreq: "monthly", priority: "0.4" },
      ];
      writeFileSync(
        resolve(outDir, "sitemap.xml"),
        '<?xml version="1.0" encoding="UTF-8"?>\n' +
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
          urls
            .map(
              (u) =>
                `  <url>\n    <loc>${SITE}${u.loc}</loc>\n    <lastmod>${today}</lastmod>\n` +
                `    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`,
            )
            .join("\n") +
          "\n</urlset>\n",
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), versionManifest(), prerenderContent()],
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  server: {
    port: 3000,
    proxy: {
      // `ws: true` matters here: src/services/realtime.js opens
      // ws(s)://<host>/api/realtime/ws, under the same /api path as every
      // REST call. Without it, Vite's dev proxy silently never upgrades the
      // connection — no error, just an immediate close — so a local `npm run
      // dev` session always looked like it was on the polling fallback,
      // never the realtime path it's actually meant to exercise. Production
      // nginx (deploy/bibliome.nginx.conf) already has the equivalent
      // Upgrade/Connection headers on its own /api/realtime/ws location;
      // this brings local dev in line with it.
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        ws: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.js",
    css: false,
  },
});
