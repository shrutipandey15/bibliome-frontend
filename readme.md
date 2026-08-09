# Bibliome — frontend

I built a book app for people who don't want to give books stars.

You log what you read, and instead of a rating you record what it *did* to you — which emotions it pulled, how hard, where in the book they hit, whether you'd go back. Do that for five books and the app starts reading you back: the patterns in your shelf, the emotions you reach for, the ones you have never once reached for. Everything is private by default. There is one small public room and one encrypted journal, and both are anchored to the same thing: books.

This repo is the web client. The API is a separate repo — [shrutipandey15/bibliome](https://github.com/shrutipandey15/bibliome) (FastAPI). Nothing here works without it running.

---

## A note on the name

This was **Book DNA** and is now **Bibliome** — the domain, both repos, the package and the deployment all moved, and the wordmarks have now caught up: landing nav, auth, password reset, the reading-room header and the shared-profile header all render `Biblio*me*`. **DNA** survives as the name of the feature, which is what it always was.

One deliberate leftover: `localStorage` keys are still a mix of `bibliome_*`, `bd-theme`, and `bookdna_tokens`. Renaming them is not cosmetic — it would silently reset every existing user's theme, onboarding and read-for state, so they stay until there's a migration worth writing. `bookdna_tokens` in particular must stay: it's a legacy key the app only ever *deletes*.

---

## The core: one book, recorded honestly

Everything else in this app is computed from this one object, so it's the part I spent the most on. Logging a book ([EntryModal.jsx](src/components/EntryModal.jsx)) captures:

- **The book.** Title with live search autocomplete — debounced 600ms, keyboard-navigable, filling author, cover and ISBN from the backend's catalog search. Or type it yourself; the search never blocks the save.
- **The emotions it pulled**, from a shared vocabulary of **18**, grouped into five families you open one at a time: *It hurt · It held me · It wanted something · It moved me · It lost me*. Recognition, not recall — you're picking from a wall of feelings, not inventing tags.
- **A strength per emotion, 1–10.** Tapping an emotion gives it a default of 6 immediately, so tagging stays fast; you adjust only the ones where the difference matters.
- **An overall intensity**, labelled in words rather than numbers — *barely · lingered · felt it · obsessed · wrecked*.
- **Status** (want to read / reading / finished), **start and finish dates**, **private notes**, and **the line you couldn't forget**.
- **Two optional disambiguating axes.** *Would you read it again?* (yes / no / not sure) — because "wrecked me" and "never again" are different books. And, only when a book was abandoned, *why*: bored, too much, badly written, wrong time, lost me, just drifted. Both are one tap, both clear on a second tap, neither ever gates a save.

### The Finish Flow

The signature interaction, and the reason this isn't a tracker. A book doesn't land as one feeling — it moves. So finishing one isn't a checkbox, it's three beats:

> *the beginning* — How did it feel when you started?
> *the middle* — And in the thick of it?
> *the last page* — How did it leave you?

Then a short closing thought (120 characters — deliberately too small for a review) and a final intensity. That arc is stored per book and is what makes the aggregate say something a star rating can't.

### Check-ins

Mid-book, you can log the weather without finishing: an emotion, an optional 80-character note, and a running timeline of how the book has felt so far. This is the beat that makes it a daily thing rather than a thing you do once per book.

### When you've already shelved it

Type a title you've logged before and the form says so, in the margin next to the field: *Piranesi is already on your shelf — finished 12 Jan 2026 · tagged awe*, with a link to open that entry instead. Matching is local (the library is already in memory) and runs on ISBN first, then title + author — tolerant of case, accents, leading articles and `Clarke, Susanna`, but never merging two different books that share a title. If one side has no author it still asks, and says plainly that it might be a different book.

It does **not** block the save. A reread five years later is a different experience with different emotions, and the shelf should hold both records; the primary button just stops pretending it's the first copy and reads *shelve it again*. No confirm dialog, no disabled state.

### Getting your shelf in

CSV import from Goodreads or StoryGraph, so you aren't staring at an empty room on day one. It reports what it parsed, imported, skipped, and what errored.

### Living in it

The whole library pages into memory over a keyset cursor, so search by title/author, filter by feeling, and sort by recent/intensity/alphabetical all run instantly client-side with no round trip per keystroke. Two views: covers, or spines on a shelf. The filter chips show only the emotions actually present on your shelf, each with its own count.

---

## What it gives back

### DNA — the portrait, after five books

Below five books, nothing is computed and nothing is invented — you get a progress bar and an honest count. Above it: ranked insights, each carrying the number of books it's based on, all of them **hand-templated on the backend and filled with your real figures**. There is no LLM anywhere in this frontend; I render `insight.text` and never author it. An insight you can't check against your own shelf is a horoscope.

The portrait lists **every** emotion in the vocabulary — including the ones you have never once reached for, which render as a blank. The blank *is* the blind spot, and omitting those rows would hide the most interesting thing on the page. The figures are book counts, not percentages of a decayed vector, specifically so you can go and verify them on your own shelf.

The archetype — one of **8** — is deliberately demoted to shorthand at the bottom, under the facts. It exports as a PNG card (html2canvas) and can be shared behind a revocable link.

Alongside it: an emotion heatmap, stats, and *what's changed* — who you've been versus who you've been lately, with the drift between them. Patterns render from book one, deliberately outside the DNA gate, so a new reader still gets their own real numbers instead of an empty tab.

### The mirror

A weekly insight and a resurfaced memory — *three months ago, this wrecked you*. Both can come back null, and when they do the card says so rather than filling the space.

### Your profile

Identity, what you're reading now, your emotional signature, **collections** (curated shelves you can build and reorder from the keyboard), reading history, and milestones based on substance rather than volume.

---

## The other three rooms

### Echo — the one public surface

Book-anchored, pseudonymous, and built so it cannot become social media. Chronological, keyset-paginated, and it **ends** — an explicit "you're caught up", no infinite scroll. It renders **no counts of any kind**: no followers, no likes, no trending, no totals. Replies appear before any reaction affordance, and reactions are private to the author. Report, block, mute, a handle you control, no path from the feed to anyone's other content, and a supportive crisis interstitial when the backend's classifier flags self-harm content.

### Resonance — one reader at a time

Someone else finished the same book feeling what you felt. You get the book, the shared emotions, a strength, and the choice to leave one note — never a name, a face, or a shelf, until you've both said yes. At most three suggestions at a time. You cannot browse for people; you can only answer what surfaces. A decline is silent and final to both sides — the card is simply gone, and neither of you is told. Its only entry point is an ambient mark in the header that renders *nothing at all* if you've never matched.

### Journal — a private page, encrypted

One feature among several, but the one with the unusual engineering, so it gets its own section below. Today / Read / Search, autosave, batch-tagging days with the same emotion vocabulary the books use.

---

## About the journal encryption

The server stores journal pages it cannot read. All of the crypto is in one file — [src/services/journalCrypto.js](src/services/journalCrypto.js), no React and no network in it — so the claim is checkable by reading one module.

```
password      ──PBKDF2(password_salt)──▶ password key ──wrap──┐
                                                              ├─▶ DEK (random 256-bit)
recovery code ──PBKDF2(recovery_salt)──▶ recovery key ──wrap──┘
                                                                    │
                                                                    ▼
                                                    AES-GCM over every entry
```

- **The DEK is random, never derived from the password**, so changing your password is a 48-byte re-wrap rather than re-encrypting the whole journal — done in the same server transaction as the password change, so the two can't disagree.
- **Two wrappings, two independent salts.** You don't need your recovery code to change your password. The code is 120 bits of Crockford base32 (no I, L, O, U — it survives paper), shown exactly once, and nothing is stored server-side until you've confirmed you have it.
- **PBKDF2-SHA256 @ 600k, not Argon2id.** Argon2 is the better KDF, but it isn't in WebCrypto — shipping it means shipping a WASM blob, i.e. *more delivered JavaScript to trust* in a design whose weak point is exactly the delivered JavaScript. The params travel with each bundle and unlock uses the params it was sealed with, so raising the cost later is a per-user re-wrap, not a migration.
- **The key lives in a ref for the life of one tab** — not React state (which gets serialized into devtools and error reports), not localStorage, not a URL. A refresh loses it. That's not an unfinished bit; it's what "we cannot read your journal" costs, and the lock screen says so rather than inventing somewhere to stash it.
- **There is no `searchJournal()`.** The server can't search blobs it can't read, so that endpoint takes no query and never will — search is client-side over what's decrypted in memory. The missing function is the feature working.
- Decrypted pages are never cached to disk, and pages that won't decrypt are surfaced rather than silently dropped.

A throwaway [Capacitor spike](spike/README.md) exists to test whether this survives a mobile WebView. Measured: `crypto.subtle` passes all eight steps on iOS Safari, PBKDF2 @600k lands ~113ms median there and ~130ms in desktop Chrome. The Android WebView and iOS WKWebView tiers were **not** run — no Android SDK, no Mac here — so I'm not reporting numbers I didn't measure.

---

## Auth

- The **access token lives in a module variable, in memory only.** Never localStorage — an XSS there is account takeover; the worst it can do here is steal a 15-minute token.
- The **refresh token is an httpOnly cookie** the browser manages and JS never sees. On boot, one `/auth/refresh` gives a silent login.
- Every concurrent refresh funnels through **one shared promise**. Without it a parallel-401 stampede has several requests each redeeming a rotating refresh token, all but the first fail, the backend revokes the session, and users get logged out at random. That bug is why `refreshOnce()` exists.

---

## Rules the code actually enforces

Not aspirations in a doc — constraints visible in the source, several of them as comments explaining what got deleted to satisfy them.

- **No comparative metrics.** Nothing that lets you rank yourself against anyone else.
- **Feeds end.**
- **Honest states or nothing.** The shelf hero used to assert a mood that was hardcoded and equally true of every reader; it now prints a countable fact or a plain invitation. A books-per-month stat was removed rather than shown, because dividing by a near-zero date span rendered as `57387453.9`.
- **Presence, not counts.** The notification bell is a dot. The Resonance mark is a glyph or nothing. `reaches_left_today` is the one number that feature exposes, it's your own budget, and it only appears once you've spent it.
- **The backend owns the emotion vocabulary.** Labels, phrases, colours and families hydrate from `GET /emotions` at boot over a canonical local seed; only icons and glyphs are frontend presentation. Frontend/backend vocabulary drift was a real bug and this is the fix.
- **Phrases where you're tagging, words where you're reading.** You pick "it wrecked me"; the analytics say "devastation".

On accessibility, concretely: [Modal.jsx](src/components/Modal.jsx) is the shared dialog baseline and gives every modal `role="dialog"` + `aria-modal`, focus moved in and **trapped**, Esc to close, focus restored to the trigger, backdrop-click to close — covered by tests. `aria-live` appears in 11 files, and `prefers-reduced-motion` is honoured in the global stylesheet, `App.css`, and the Resonance mark. I have not run a full WCAG 2.2 AA audit, so I won't claim a pass.

---

## Stack

| What | How |
|---|---|
| Framework | React 18 + React Router 6 (route-level `lazy` + `Suspense`) |
| Build | Vite 5 |
| Styling | Vanilla CSS with custom properties. No component library, no Tailwind. |
| Themes | Two — **Vellum** (light) and **Lamplight** (dark). A tiny inline script in `index.html` sets `data-theme` *before first paint*; `ThemeContext` owns every frame after. Follows your OS until you pick for yourself, then stops. |
| Icons | lucide-react |
| Export | html2canvas, for the DNA card PNG |
| Crypto | WebCrypto (`crypto.subtle`) only — no crypto dependency |
| Tests | Vitest + Testing Library + jsdom |
| CI | GitHub Actions — `npm ci`, `npm test`, `npm run build` on push to main and every PR |

Five runtime dependencies. That's the entire list in `package.json`.

---

## Routes

| Route | What happens |
|---|---|
| `/` | The reading room — shelf, hero, stat strip, mirror card, filters, stacks. Tabs are URL-driven (`?view=`) so they're deep-linkable and Back works. |
| `/?view=dna` | DNA — insights, portrait, what's changed, archetype, patterns |
| `/echoes` | Echo — the chronological feed that ends, plus the composer |
| `/journal` | The encrypted journal (Today · Read · Search) |
| `/resonance` | Resonance — surfaced matches, notes, open letters |
| `/me` | Your profile: identity, now reading, signature, collections, history |
| `/settings` | Profile, visibility, handle, notification prefs, security |
| `/admin` | Admin dashboard (lazy-loaded) |
| `/login`, `/reset-password` | Auth |
| `/u/:username` | A public profile card, visibility-gated |
| `/s/:token` | A shared DNA card behind a revocable capability link |

Everything under `/` sits inside an authed layout mounting `JournalProvider → JournalKeyProvider → PrivateJournalProvider`. The key providers mount there rather than on `/journal` so the password captured at login can unwrap the data key while it still exists in memory; both are inert and fetch nothing until the journal is unlocked.

---

## Layout

```
src/
├── App.jsx                     Reading room, routing, tabs, shelf composition
├── main.jsx                    Root render + emotion vocab sync
├── contexts/
│   ├── AuthContext.jsx         Silent login on boot; stages the journal secret
│   ├── JournalContext.jsx      Book entries, analytics, honest empty/error states
│   ├── ThemeContext.jsx        Vellum / Lamplight, above the router
│   ├── JournalKeyContext.jsx   The DEK's whole life. A state machine, and a ref.
│   └── PrivateJournalContext.jsx  Decrypted pages, autosave, batch tagging
├── services/
│   ├── api.js                  apiFetch, single-flight refresh, typed ApiError,
│   │                           every endpoint annotated with its contract
│   ├── emotions.js             The 18-emotion vocabulary (seed + hydrate)
│   ├── journalCrypto.js        All of the crypto. No React, no network.
│   └── offline.js              localStorage cache — book entries only
├── components/
│   ├── EntryModal.jsx          Log/edit a book — the core form, incl. the
│   │                           "already on your shelf" notice
│   ├── FinishFlow.jsx          The three-beat arc
│   ├── CheckinPanel.jsx        Mid-book check-ins
│   ├── ImportModal.jsx         Goodreads / StoryGraph CSV
│   ├── Shelf / BookCard        Spines and covers
│   ├── MirrorCard.jsx          Weekly insight + resurfaced memory (honest-empty)
│   ├── Modal.jsx               The accessible dialog baseline
│   ├── dna/                    DNAView, gate, insights, portrait, evolution
│   ├── echo/                   Composer, card, thread, report, crisis interstitial
│   ├── journal/                Setup, lock, blank page, continuous read, search, tags
│   ├── resonance/              MatchCard, note composer, thread, ambient mark
│   ├── notifications/          Notification centre
│   └── profile/                Collections editor (keyboard-reorderable)
├── pages/                      Landing, auth, echoes, journal, resonance,
│                               profile, public profile, settings, admin, reset
├── utils/
│   ├── findDuplicate.js        "Have I shelved this already?" — pure, tested
│   └── cardUtils.js            DNA card → PNG
└── styles/global.css           Theme tokens, palette, book-spine styling
```

---

## Running it

```bash
npm install
npm run dev        # → localhost:3000
```

Vite proxies `/api` → `http://127.0.0.1:8000`. Same-origin isn't a convenience here — the cookie auth depends on it. Start the [backend](https://github.com/shrutipandey15/bibliome) first.

```bash
npm test           # one pass
npm run test:watch
npm run build      # → dist/
```

For production, `VITE_API_URL=/api` (already in `.env.production`) and serve `dist/` behind a proxy forwarding `/api/*` to the backend on the same origin. The inline theme script and the JSON-LD block in `index.html` need `script-src 'unsafe-inline'` in the nginx CSP.

**Verified on 2026-08-09:** `npm test` → 28 files, 181 passing and 4 skipped (the Echo "your echoes" suite, gated on a backend param that doesn't exist yet — see below). `npm run build` → clean, 3.01s.

---

## What's rough, honestly

- **Echo's "your echoes" view is withheld, not built.** The backend doesn't honour `?mine=true`, and an ignored param returns the everyone-feed — a feed labelled "yours" that isn't is the one lie this surface can't afford. The toggle is behind `MINE_FILTER_SUPPORTED` in [EchoesPage.jsx](src/pages/EchoesPage.jsx); the UI and its four tests are written and gated on the same flag, so it's a one-line flip once the API lands.
- **`offline.js` is a read cache, not offline support.** Book entries only, so the shelf paints instantly on revisit. No write queue, no sync, no conflict resolution — offline you get a stale read and failed writes.
- **The governing docs (`ROADMAP.md`, `blueprint.md`, `audit.md`, and the auth/crypto contracts) are not in this repo.** `docs/` is gitignored here; the canonical copies live in the backend repo. The previous README linked them as if they were here.
- **There is no LICENSE file.** The previous README said MIT, but nothing in the repo backs that, so as it stands this is all-rights-reserved by default. Pick one and commit it.
- **Mobile is a spike, not a plan.** Two of its four go/no-go questions are unanswered for want of hardware.

---

*Every book you've ever loved changed you in ways you can't articulate.*

*This tries.*
