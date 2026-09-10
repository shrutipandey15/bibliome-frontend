#!/usr/bin/env node
// Headless-Chromium driver for the Bibliome (bookDNA) frontend.
//
// Why this exists: `playwright` proper needs Node >= 20 and this box runs 18,
// and there is no `chromium-cli`. So we drive `playwright-core` (which runs
// fine on 18) against a Chromium that is already on disk. No new npm install
// if either the VSCode copy of playwright-core or a local one is present.
//
// Usage (paths relative to repo root):
//   node .claude/skills/run-bibliome-frontend/driver.mjs smoke
//   node .claude/skills/run-bibliome-frontend/driver.mjs shot /login --out login
//   node .claude/skills/run-bibliome-frontend/driver.mjs shot / --mobile --out landing-m
//
// Assumes the dev server is already up on $BASE_URL (default http://localhost:4173).
// Screenshots land in .claude/skills/run-bibliome-frontend/screenshots/.

import { createRequire } from "node:module";
import { existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const SHOTS = join(HERE, "screenshots");
mkdirSync(SHOTS, { recursive: true });
const BASE = process.env.BASE_URL || "http://localhost:4173";

// ---- locate playwright-core without adding a dependency -------------------
function loadPlaywright() {
  const candidates = [
    join(process.cwd(), "node_modules/playwright-core"),
    "/usr/share/code/resources/app/node_modules/playwright-core", // VSCode ships it
  ];
  for (const c of candidates) {
    try {
      return createRequire(c + "/")("playwright-core");
    } catch { /* try next */ }
  }
  console.error(
    "playwright-core not found. Install it (works on Node 18):\n" +
    "  npm i -D playwright-core\n" +
    "then re-run.",
  );
  process.exit(3);
}

// ---- locate a Chromium binary ------------------------------------------------
function chromePath() {
  const home = process.env.HOME || "";
  const guesses = [
    join(home, ".cache/ms-playwright/chromium-1234/chrome-linux64/chrome"),
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];
  const hit = guesses.find((g) => existsSync(g));
  if (!hit) { console.error("No Chromium/Chrome binary found in the usual places."); process.exit(3); }
  return hit;
}

const { chromium } = loadPlaywright();

async function withPage(fn, { mobile = false } = {}) {
  const browser = await chromium.launch({
    executablePath: chromePath(),
    args: ["--no-sandbox", "--disable-gpu"],
  });
  const page = await browser.newPage();
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 });
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  try {
    return await fn(page, errors);
  } finally {
    await browser.close();
  }
}

// Vite proxies /api to a backend on :8000 that is usually not running here.
// Those failures are expected; flag only the ones that aren't /api.
const isBackendNoise = (t) =>
  /\/api\/|:8000|version\.json/i.test(t) ||
  /Failed to load resource.*status of (?:401|403|404|500|502|503)/i.test(t);

async function shot(path, { mobile = false, out = "shot" } = {}) {
  await withPage(async (page, errors) => {
    const resp = await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(400);
    const file = join(SHOTS, `${out}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(`${path}  ->  http ${resp.status()}  ->  ${file}`);
    const real = errors.filter((e) => !isBackendNoise(e));
    if (real.length) console.log("  console errors:\n   " + real.join("\n   "));
  }, { mobile });
}

async function smoke() {
  let failed = false;
  await withPage(async (page, errors) => {
    // 1. Landing renders
    const r = await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 30000 });
    console.log(`GET /            http ${r.status()}`);
    const h1 = (await page.locator("h1").first().innerText()).replace(/\s+/g, " ").trim();
    console.log(`  h1: "${h1}"`);
    if (!/fingerprint of your reading life/i.test(h1)) { failed = true; console.log("  !! unexpected h1"); }
    await page.screenshot({ path: join(SHOTS, "smoke-1-landing.png"), fullPage: true });

    // 2. Nav "Begin" -> auth page in register mode
    await page.getByRole("button", { name: /^Begin/ }).first().click();
    await page.waitForURL(/\/login/, { timeout: 10000 });
    const registerVisible = await page.getByText(/Create account/i).first().isVisible();
    console.log(`  after Begin: ${page.url()}  register-mode=${registerVisible}`);
    if (!/mode=register/.test(page.url()) || !registerVisible) { failed = true; console.log("  !! Begin did not open register mode"); }
    await page.screenshot({ path: join(SHOTS, "smoke-2-auth.png"), fullPage: true });

    // 3. Legal pages exist (footer links in the audit relied on this)
    for (const p of ["/privacy", "/terms"]) {
      const rr = await page.goto(BASE + p, { waitUntil: "networkidle" });
      const txt = (await page.locator("body").innerText()).length;
      console.log(`GET ${p.padEnd(9)}  http ${rr.status()}  ${txt} chars`);
      if (rr.status() >= 400 || txt < 200) { failed = true; console.log(`  !! ${p} looks empty`); }
    }

    // 4. Mobile landing (sticky nav + chip row)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    await page.screenshot({ path: join(SHOTS, "smoke-3-landing-mobile.png"), fullPage: true });
    console.log("GET / (390px)    screenshot saved");

    const real = errors.filter((e) => !isBackendNoise(e));
    console.log(real.length ? `\nconsole errors (non-backend):\n  ${real.join("\n  ")}` : "\nno non-backend console errors");
  });
  console.log(`\nsmoke: ${failed ? "FAIL" : "PASS"}  (screenshots in ${SHOTS})`);
  process.exit(failed ? 1 : 0);
}

// ---- arg parsing ------------------------------------------------------------
const [cmd, ...rest] = process.argv.slice(2);
const flags = new Set(rest.filter((a) => a.startsWith("--")));
const pos = rest.filter((a) => !a.startsWith("--"));
const outArg = (() => { const i = rest.indexOf("--out"); return i >= 0 ? rest[i + 1] : undefined; })();

if (cmd === "smoke") {
  await smoke();
} else if (cmd === "shot") {
  await shot(pos[0] || "/", { mobile: flags.has("--mobile"), out: outArg || "shot" });
} else {
  console.log("commands:\n  smoke                       full interaction check + screenshots\n  shot <path> [--mobile] [--out name]   screenshot one route");
  process.exit(2);
}
