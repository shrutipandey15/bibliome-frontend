---
name: run-bibliome-frontend
description: Build, run, and drive the Bibliome (bookDNA) frontend — a Vite + React SPA. Use to run or start the app, launch the dev server, take a screenshot, click through the landing/auth flow, or verify a UI change in a real browser (not just vitest).
---

# Run: bibliome-frontend

Vite 5 + React 18 SPA (`react-router-dom`, no backend in this repo — `/api` is
proxied to a separate service on `:8000` that is normally **not** running here).

Driven headless with **`driver.mjs`** (playwright-core + system Chromium — the
full `playwright` package needs Node ≥ 20 and this box is on 18, and there's no
`chromium-cli`). All paths below are relative to the repo root
(`bookDNA-frontend/`).

## Prerequisites

Already present on this machine and used by the driver:

- `node` 18, `npm` 9
- `/usr/bin/google-chrome` (Chrome 152) **and** a Playwright Chromium at
  `~/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome` — the driver picks
  whichever exists.
- `playwright-core` resolved from `/usr/share/code/resources/app/node_modules`
  (VSCode ships it). If that path is gone: `npm i -D playwright-core` and the
  driver finds the local copy.

No `apt-get` was needed — the app is a plain web bundle and Chrome was
pre-installed.

## Build / install

```bash
npm install
npm run build        # vite build -> dist/, ~3s, currently clean
npx vitest run       # 328 pass / 4 skipped
```

## Run — agent path (driver)

Start the dev server on a fixed port, wait for it, then drive it:

```bash
lsof -ti:4173 -sTCP:LISTEN | xargs -r kill
nohup npm run dev -- --port 4173 --strictPort > /tmp/vite.log 2>&1 &
timeout 20 bash -c 'until curl -sf http://localhost:4173/ >/dev/null; do sleep 1; done'
```

Then:

```bash
# full interaction check: landing renders, nav "Begin" -> /login?mode=register,
# /privacy + /terms load, mobile viewport. Writes 4 screenshots, exits non-zero on failure.
node .claude/skills/run-bibliome-frontend/driver.mjs smoke

# one route to one screenshot (fullPage)
node .claude/skills/run-bibliome-frontend/driver.mjs shot /login --out login
node .claude/skills/run-bibliome-frontend/driver.mjs shot / --mobile --out landing-m
```

Screenshots land in `.claude/skills/run-bibliome-frontend/screenshots/`
(git-ignored). `BASE_URL` env overrides `http://localhost:4173`.

Last verified `smoke` output:

```
GET /            http 200
  h1: "The emotional fingerprint of your reading life."
  after Begin: http://localhost:4173/login?mode=register  register-mode=true
GET /privacy   http 200  6539 chars
GET /terms     http 200  3364 chars
GET / (390px)    screenshot saved
no non-backend console errors
smoke: PASS
```

Stop the server:

```bash
lsof -ti:4173 -sTCP:LISTEN | xargs -r kill
```

### Driving something else

`driver.mjs` is small — `withPage(fn, {mobile})` gives a Playwright `page` and a
captured console-error array. Add a function next to `smoke()` for a new flow
(fill a form, assert DOM), or edit `smoke()` directly. React controlled inputs:
use `page.fill()` / `page.getByRole()`, not `el.value =`.

## Run — human path

```bash
npm run dev          # serves on :3000 (falls back to :3001+ if taken)
```

Opens nothing on its own; useless headless. Ctrl-C to stop. `npm run preview`
serves the built `dist/` the same way.

## Gotchas

- **No backend.** `vite.config.js` proxies `/api` → `127.0.0.1:8000`. Nothing
  runs there in this repo, so anything past the auth form (login, data, DNA)
  fails with 401/timeout. The driver's `smoke` filters those out as expected
  noise; a real login flow needs that service up.
- **Port 3000 sticks.** `npm run dev` defaults to 3000 and silently falls back to
  3001/3002 if a stale `vite` is holding it — then your screenshot URL is wrong.
  Always launch with `--port 4173 --strictPort` and kill the listener first.
  `npm`'s `$!` is the wrapper PID, not vite — kill by port, not by `$!`.
- **`npm run dev -- --port` needs the `--`** or the flag goes to npm, not vite.
- **Node 18 + Playwright.** `npx playwright` refuses ("requires Node 20"). The
  driver sidesteps it via `playwright-core` + `executablePath`. Don't "fix" it by
  installing `playwright`.
- **`getComputedStyle` mid-transition lies.** If you add code that toggles a
  class and immediately reads a computed style, `wait` first — a CSS `transition`
  will hand you an interpolated value. (This cost real debugging time; the
  landing nav's transparent→solid scroll effect was removed partly because of
  it.)
- **jsdom (vitest) has no `IntersectionObserver`.** The landing page's scroll-spy
  nav marker is guarded for that and simply doesn't activate under test — not a
  failure.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `playwright-core not found` | `npm i -D playwright-core` |
| driver: `No Chromium/Chrome binary found` | install Chrome, or point the driver's `chromePath()` guesses at your binary |
| `shot`/`smoke` hangs on first `nav` | Vite compiles routes on demand; first hit can take ~10s. The driver's 30s `networkidle` timeout covers it — just wait. |
| screenshot is the wrong page | stale dev server on another port — `lsof -ti:4173 \| xargs kill`, relaunch with `--strictPort` |
