// Clip a screenshot to one selector. node clip.mjs <path> <selector> <out> [--mobile] [--dark]
import { createRequire } from "node:module";
import { existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const HERE = dirname(fileURLToPath(import.meta.url));
const SHOTS = join(HERE, "screenshots"); mkdirSync(SHOTS, { recursive: true });
const BASE = process.env.BASE_URL || "http://localhost:4173";
const req = (() => {
  for (const c of [join(process.cwd(), "node_modules/playwright-core"),
    "/usr/share/code/resources/app/node_modules/playwright-core"]) {
    try { return createRequire(c + "/")("playwright-core"); } catch {}
  }
  process.exit(3);
})();
const chrome = [join(process.env.HOME || "", ".cache/ms-playwright/chromium-1234/chrome-linux64/chrome"),
  "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
const [path, selector, out, ...f] = process.argv.slice(2);
const mobile = f.includes("--mobile"), dark = f.includes("--dark");
const b = await req.chromium.launch({ executablePath: chrome, args: ["--no-sandbox", "--disable-gpu"] });
const p = await b.newPage();
await p.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 });
if (dark) await p.emulateMedia({ colorScheme: "dark" });
await p.goto(BASE + path, { waitUntil: "networkidle", timeout: 30000 });
await p.waitForTimeout(500);
const el = p.locator(selector).first();
await el.scrollIntoViewIfNeeded();
await el.screenshot({ path: join(SHOTS, out + ".png") });
console.log("saved", out);
await b.close();
