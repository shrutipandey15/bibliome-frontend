import {
  Flame, CloudMoon, Heart, Coffee, Sparkles,
  Eye, Droplets, Telescope, Leaf, Wind, HelpCircle,
  Sun, Laugh, Hourglass, Aperture, Meh, Frown, Tornado, CircleOff,
} from "lucide-react";

// ── Shared emotion vocabulary [F1.5 / P2-9, P2-12] ──
// label / color / description are OWNED BY THE BACKEND and served from
// GET /emotions (B2.10). They are the single source of truth; do NOT edit them
// here to diverge from the server — that divergence is exactly the P2-9 bug
// (frontend "Melancholy" vs backend "Grief", etc.). The values below are a
// canonical SEED matching the served vocabulary so the first render is correct;
// `hydrateEmotions()` refreshes them from the server at boot.
//
// Icon + glyph are frontend PRESENTATION only (aesthetic choices, not data that
// can drift) and stay local. The server's `symbol` (emoji) is stored too, if a
// surface prefers it.
const PRESENTATION = {
  // it messed me up
  devastation: { Icon: Wind,      glyph: "·" },
  grief:       { Icon: Droplets,  glyph: "◦" },
  dread:       { Icon: CloudMoon, glyph: "◐" },
  rage:        { Icon: Flame,     glyph: "◉" },
  // it held me
  comfort:     { Icon: Coffee,    glyph: "○" },
  tenderness:  { Icon: Eye,       glyph: "◎" },
  joy:         { Icon: Sun,       glyph: "☀" },
  amusement:   { Icon: Laugh,     glyph: "‡" },
  // the yearning
  longing:     { Icon: Leaf,      glyph: "❋" },
  desire:      { Icon: Heart,     glyph: "♡" },
  nostalgia:   { Icon: Hourglass, glyph: "☾" },
  // it hit different
  awe:         { Icon: Telescope, glyph: "✺" },
  recognition: { Icon: Aperture,  glyph: "◈" },
  catharsis:   { Icon: Sparkles,  glyph: "✧" },
  // it lost me
  boredom:     { Icon: Meh,       glyph: "—" },
  revulsion:   { Icon: Frown,     glyph: "✗" },
  confusion:   { Icon: Tornado,   glyph: "✦" },
  indifference:{ Icon: CircleOff, glyph: "◌" },
};

// Canonical seed — mirrors the backend's served vocabulary. Each emotion carries
// BOTH a `phrase` (the first-person line the UI shows — "it wrecked me") and a
// `name` (the plain word — "devastation", used where a single token is wanted).
// Per VISION §4 the reader sees phrases, never the word/slug. `family`, `phrase`,
// `name`, and `color` are all OWNED BY THE BACKEND and refreshed from GET
// /emotions by hydrateEmotions() so nothing drifts. Order matters: families
// render in first-appearance order.
// Tuple: [slug, family, name(word), phrase, color, description]
const SEED = [
  // it messed me up
  ["devastation", "it messed me up", "devastation", "it wrecked me",                          "#3D2B3D", "The books that take something out of you. You finish and just sit there for a while."],
  ["grief",       "it messed me up", "grief",       "I'm still not over it",                   "#6B4F8E", "Loss and mourning. The ache that doesn't leave when the book ends."],
  ["dread",       "it messed me up", "dread",       "shoulders up by my ears the entire time", "#4B6B8E", "The low hum of something-bad-is-coming that you read the whole book with."],
  ["rage",        "it messed me up", "rage",        "I wanted to throw it across the room",    "#C44B4B", "Injustice you can't let go of. The book that makes you want to burn it all down."],
  // it held me
  ["comfort",     "it held me", "comfort",    "it felt like being tucked in",  "#8E6B4B", "The book that's a soft place to land. Safe, warm, yours."],
  ["tenderness",  "it held me", "tenderness", "handle-with-care kind of love", "#9B6B7B", "Gentle, careful love. The book that's kind to you."],
  ["joy",         "it held me", "joy",        "I closed it smiling",           "#E0A458", "Pure lightness. You put it down happier than you picked it up."],
  ["amusement",   "it held me", "amusement",  "I actually laughed out loud",   "#C9B24B", "Genuinely funny. The lines you stop to read out loud to someone."],
  // the yearning
  ["longing",     "the yearning", "longing",   "the yearning was unreal",      "#5B6B8E", "Wanting something you can't quite name, or can't have."],
  ["desire",      "the yearning", "desire",    "the tension nearly killed me", "#9B5B8E", "The pull toward. Romantic tension, want, the ache of almost."],
  ["nostalgia",   "the yearning", "nostalgia", "it smelled like a memory",     "#B07B4B", "The ache of a time you can't go back to. It puts you somewhere you used to be."],
  // it hit different
  ["awe",         "it hit different", "awe",         "I had to put it down and just sit there", "#4B7B6B", "Wonder at the sheer scale of it. You have to stop and let it land."],
  ["recognition", "it hit different", "recognition", "it read my mind",                        "#4B8E8A", "Being seen. The book that already knew you."],
  ["catharsis",   "it hit different", "catharsis",   "I cried and felt lighter after",         "#C9A96E", "The release after the tension. A cry that leaves you lighter."],
  // it lost me
  ["boredom",     "it lost me", "boredom",      "my two brain cells died",          "#8A8A7A", "The pages wouldn't turn. You kept checking how much was left."],
  ["revulsion",   "it lost me", "revulsion",    "I felt a little sick",             "#6B7A4B", "Recoil. Something in it you couldn't sit with."],
  ["confusion",   "it lost me", "confusion",    "I have no idea what happened",     "#7B6B9B", "You lost the thread and never found it again."],
  ["indifference","it lost me", "indifference", "closed it and forgot it existed", "#9A9A9A", "It closed and left nothing behind. You felt nothing either way."],
];

export const EMOTIONS = {};
for (const [slug, family, name, phrase, color, desc] of SEED) {
  // `label` is the primary display string — the phrase. `name` is the compact word.
  EMOTIONS[slug] = { family, name, label: phrase, color, desc, symbol: null, ...(PRESENTATION[slug] || {}) };
}

// EMO_LIST holds live references to the EMOTIONS objects. hydrateEmotions mutates
// those objects IN PLACE, so this array never needs rebuilding.
export const EMO_LIST = Object.entries(EMOTIONS);

// Merge the server's canonical vocabulary into EMOTIONS in place. Called once at
// boot with the GET /emotions payload. label/color/description follow the server;
// Icon/glyph stay local. Unknown slugs are added defensively.
export function hydrateEmotions(vocab) {
  for (const item of vocab?.emotions || []) {
    if (!EMOTIONS[item.slug]) {
      EMOTIONS[item.slug] = { ...(PRESENTATION[item.slug] || {}) };
      EMO_LIST.push([item.slug, EMOTIONS[item.slug]]);
    }
    // The reader-facing label is the phrase ("it wrecked me"); fall back to the
    // plain word if an older server hasn't started serving `phrase` yet. Only
    // overwrite fields the payload actually carries, so a partial vocab item
    // never clobbers a good seed value (e.g. wiping `family`) with undefined.
    const patch = {
      family: item.family,
      name: item.name,
      label: item.phrase || item.name,
      color: item.color,
      desc: item.description,
      symbol: item.symbol,
    };
    for (const [k, v] of Object.entries(patch)) {
      if (v !== undefined) EMOTIONS[item.slug][k] = v;
    }
  }
}

// Pull the server's vocabulary and merge it in. Called once from main.jsx.
//
// hydrateEmotions sat here for a while with no caller outside the tests, which
// meant the seed above and the backend's EMOTIONS list agreed only because
// someone kept them in step by hand — the exact setup that produced the
// emotion-key drift this file exists to prevent. Now it actually runs.
//
// Deliberately fire-and-forget: the seed is a complete, correct vocabulary on
// its own, so a failed fetch is a no-op rather than a broken app. Never let this
// block first paint.
export async function syncEmotions() {
  try {
    const res = await fetch(`${import.meta.env.VITE_API_URL || "/api"}/emotions`, {
      credentials: "same-origin",
    });
    if (!res.ok) return false;
    hydrateEmotions(await res.json());
    return true;
  } catch {
    return false;
  }
}

export function getEmotionFamilies() {
  const order = [];
  const byFamily = new Map();
  for (const [slug, e] of EMO_LIST) {
    if (!e.family) continue;
    if (!byFamily.has(e.family)) { byFamily.set(e.family, []); order.push(e.family); }
    byFamily.get(e.family).push([slug, e]);
  }
  return order.map((family) => ({ family, emotions: byFamily.get(family) }));
}

export function getPrimaryEmotion(entry) {
  const firstEmo = entry?.emotions?.[0];
  const id = typeof firstEmo === "string" ? firstEmo : firstEmo?.emotion_id;
  return EMOTIONS[id] || { color: "#333", Icon: HelpCircle, label: "Unknown" };
}
