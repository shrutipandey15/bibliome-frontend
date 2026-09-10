// Log in, then screenshot routes. node authshot.mjs <email> <pw> <route> <out> [--mobile] [--dark] [route out ...]
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const HERE = dirname(fileURLToPath(import.meta.url));
const SHOTS = join(HERE, "screenshots");
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

const [email, pw, ...rest] = process.argv.slice(2);
const mobile = rest.includes("--mobile"), dark = rest.includes("--dark");
const pairs = rest.filter((a) => !a.startsWith("--"));

const b = await req.chromium.launch({ executablePath: chrome, args: ["--no-sandbox", "--disable-gpu"] });
const p = await b.newPage();
await p.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
const errs = [];
p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });

await p.goto(BASE + "/login", { waitUntil: "networkidle" });
await p.fill('input[type="email"]', email);
await p.fill('input[type="password"]', pw);
await p.getByRole("button", { name: /sign in/i }).click();
await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15000 });
await p.waitForTimeout(1500);

if (dark) {
  await p.evaluate(() => { try { localStorage.setItem("bd-theme", "dark"); } catch {} });
}

for (let i = 0; i < pairs.length; i += 2) {
  const route = pairs[i], out = pairs[i + 1];
  await p.goto(BASE + route, { waitUntil: "networkidle" });
  if (dark) await p.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  await p.waitForTimeout(1800);
  await p.screenshot({ path: join(SHOTS, out + ".png"), fullPage: true });
  console.log("shot", route, "->", out);
}
const real = errs.filter((e) => !/\/api\/|:8000|version\.json|401|403|404/.test(e));
if (real.length) console.log("console errors:\n " + real.join("\n "));
await b.close();
