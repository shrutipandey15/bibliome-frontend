# 📖 BookDNA — Frontend

**A private mirror for your reading life.**

BookDNA is where you keep an honest record of what books *did* to you — not ratings, the actual weather they left behind — and watch the patterns add up to a portrait of who you are as a reader. Everything is private by default. The one public surface is **Echo**: a pseudonymous, book-anchored place to put the raw thing a book did to you and read others doing the same.

⚙️ **Backend repo:** [bookDNA](https://github.com/shrutipandey15/bookDNA) (FastAPI)

This repo is one of a three-document set that governs the work:
- [`ROADMAP.md`](./ROADMAP.md) — the phased task list (what's built, what's next)
- `blueprint.md` — the product vision and reasoning
- `audit.md` — the canonical problem list

---

## The product, in one paragraph

BookDNA is a private journal for readers. You log a book, tag what it did to you from a shared vocabulary of **18 emotions**, and — after **5 books** — the app reflects a **reading DNA** back at you: one of **8 archetypes** drawn from the geometry of your shelf, plus resurfaced memories ("three months ago, *this* wrecked you"). The single public surface, **Echo**, is built to be structurally incapable of becoming social media: chronological, it **ends**, and it renders **no counts of any kind** — no followers, no likes, no karma, ever.

---

## What you can do

**Keep the private mirror.**
- Log a book with the full picture — reading status, start/finish dates, private notes, the line that hit hardest.
- Run the **Finish Flow**: a three-beat emotional arc (start → middle → end) plus a closing thought — the signature interaction.
- Drop a **check-in** while you're mid-book: "how's it feeling now?"
- **Import** a whole library from a Goodreads / StoryGraph CSV so you're not staring at an empty shelf.
- Search and filter your own shelf by title, author, or feeling.

**See yourself in the data.**
- Generate your **reading DNA** after a few books — a shareable personality card (PNG export).
- An emotional **signature**, heatmap, and stats — described by *how* you read, never *how much*.
- **Mirror** insights + a resurfaced memory, surfaced honestly (nothing is shown until there's enough to say).

**Echo — the one public room.**
- A minimal composer: a book/emotion anchor + the reflection, with a friction line — *say the true thing, not the clever thing.*
- A **chronological feed that ends** ("you're caught up"), filterable by feeling. No trending, no ranking, no counts.
- Replies (shown before any reaction), private reactions (no public tallies).
- One-tap **report** (categorized), silent **block** and **mute**.
- A supportive **crisis interstitial** when the backend flags self-harm content — care, not punishment.
- A pseudonymous **handle** you control; no path from the feed to a person's other content.

**Calm notifications.**
- An in-app notification center (a presence dot, not a guilt-count), batched — "three readers replied," not three pings.
- A weekly "your reading week" digest.
- Full control: reply/digest switches, quiet hours, timezone, one-tap "fewer notifications."

---

## Design rules (enforced, not aspirational)

Every screen is checked against these — they're acceptance criteria:

- **No comparative metrics.** No counts that let users rank themselves against others.
- **Feeds end.** No infinite scroll — an explicit "you're caught up."
- **Honest states.** Real data or an honest "not enough yet." Never fabricated.
- **Recognition over recall** — pickers, not free-text taxonomies.
- **One primary action per screen**; progressive disclosure; calm by default.
- **WCAG 2.2 AA is definition-of-done** — focus-trapped modals, `Esc` to close, `aria-live` for async, full keyboard parity, reduced-motion honored.

---

## Stack

| What | How |
|------|-----|
| Framework | React 18 + React Router 6 |
| Build | Vite 5 |
| Styling | Vanilla CSS with custom properties (Newsreader / Cormorant Garamond serif) |
| Icons | lucide-react |
| Export | html2canvas (DNA card PNG) |
| Tests | Vitest + Testing Library + jsdom; GitHub Actions CI |

No component library. No Tailwind. Every pixel is intentional.

---

## Authentication

Auth follows [`authCookieContract.md`](./authCookieContract.md):

- The **access token lives in memory only** (never `localStorage` — an XSS there would be account takeover).
- The **refresh token is an httpOnly cookie** the browser manages; JS never sees it.
- On boot the app calls `/auth/refresh` once for a **silent login**; a single-flight refresh promise prevents the parallel-401 stampede that used to log users out at random.

---

## Routes

| Route | What happens |
|-------|-------------|
| `/` | Your shelf — log books, DNA, heatmap, stats, mirror insights |
| `/echoes` | Echo — the chronological, countless public feed + composer |
| `/settings` | Profile, visibility & share links, handle, notification preferences, security |
| `/login` | Auth with password-strength meter, lockout countdown |
| `/u/:username` | A public profile card (visibility-gated) |
| `/s/:token` | A shared profile card via a revocable capability link |
| `/reset-password` | Password reset |
| `/admin` | Dashboard, users, catalog, DB health (admin only) |

---

## Project structure

```
src/
├── App.jsx                       Shelf, routing, tabs, main shell
├── contexts/
│   ├── AuthContext.jsx           Silent-login-on-boot, login/register/logout
│   └── JournalContext.jsx        Entries, analytics, honest error/empty state
├── services/
│   ├── api.js                    apiFetch (cookie auth + single-flight refresh),
│   │                             ApiError, entries/DNA/echo/social/notifications
│   ├── offline.js                Per-account localStorage entry cache
│   └── emotions.js               18-emotion vocab (seeded, hydrated from /emotions)
├── components/
│   ├── Modal.jsx                 Accessible modal baseline (focus trap, Esc, restore)
│   ├── EntryModal.jsx            Log/edit a book — full fields + search autocomplete
│   ├── FinishFlow.jsx            The three-beat emotional arc
│   ├── CheckinPanel.jsx          Currently-reading check-ins
│   ├── ImportModal.jsx           Goodreads / StoryGraph CSV import
│   ├── MirrorCard.jsx            Weekly insight + resurfaced memory (honest-empty)
│   ├── DNACard.jsx               Personality card + PNG export
│   ├── WelcomeModal.jsx          First-run: "begin with one book"
│   ├── ShelfError.jsx            Honest error state (429 / 500 / offline)
│   ├── echo/                     Echo: Composer, Card, Thread, ReportModal, Crisis
│   ├── notifications/            NotificationCenter (bell + panel + digest card)
│   └── profile/                  CollectionsEditor (curated shelves, keyboard-reorder)
├── pages/
│   ├── EchoesPage.jsx            The Echo feed
│   ├── ProfilePage.jsx           The /me self-view (identity, Now, signature, collections)
│   ├── SettingsPage.jsx          Visibility, handle, notification prefs, security
│   ├── AuthPage.jsx              Login / register
│   └── AdminPage.jsx             Admin dashboard
└── styles/
    └── global.css                Theme variables, palette, book-spine styles
```

---

## Run locally

```bash
npm install
npm run dev        # → localhost:3000
```

Vite proxies `/api` to `localhost:8000` (same-origin, which the cookie auth relies on).
Make sure the [backend](https://github.com/shrutipandey15/bookDNA) is running.

```bash
npm test           # run the suite once
npm run test:watch # watch mode
npm run build      # → dist/
```

Set `VITE_API_URL=/api` in `.env.production` and serve `dist/` behind a proxy that
forwards `/api/*` to the backend on the same origin.

---

## What's next

See [`ROADMAP.md`](./ROADMAP.md). Phases 1–4 (Foundation, the Private Mirror, Echo, and
Calm Notifications) are built — including the **Profile** self-view (`/me`): identity strip,
Now reading, emotional signature, curated **collections** (create, add books, keyboard-reorder),
reading history, and substance-only milestones. **Twin** (reader-matching) and **Chat** are
deliberately parked until Echo proves itself.

---

## License

MIT

---

*Every book you've ever loved changed you in ways you can't articulate.*

*This tries.*
