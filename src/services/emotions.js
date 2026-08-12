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
  // It hurt
  devastation: { Icon: Wind,      glyph: "·" },
  grief:       { Icon: Droplets,  glyph: "◦" },
  dread:       { Icon: CloudMoon, glyph: "◐" },
  rage:        { Icon: Flame,     glyph: "◉" },
  // It held me
  comfort:     { Icon: Coffee,    glyph: "○" },
  tenderness:  { Icon: Eye,       glyph: "◎" },
  joy:         { Icon: Sun,       glyph: "☀" },
  amusement:   { Icon: Laugh,     glyph: "‡" },
  // It wanted something
  longing:     { Icon: Leaf,      glyph: "❋" },
  desire:      { Icon: Heart,     glyph: "♡" },
  nostalgia:   { Icon: Hourglass, glyph: "☾" },
  // It moved me
  awe:         { Icon: Telescope, glyph: "✺" },
  recognition: { Icon: Aperture,  glyph: "◈" },
  catharsis:   { Icon: Sparkles,  glyph: "✧" },
  // It lost me
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
  // It hurt
  ["devastation", "It hurt", "devastation", "it wrecked me",        "#3D2B3D", "Complete emotional destruction — the books that ruin you"],
  ["grief",       "It hurt", "grief",       "it left a hole",       "#6B4F8E", "Loss, absence, mourning — the ache"],
  ["dread",       "It hurt", "dread",       "I couldn't relax",     "#4B6B8E", "Anxiety, foreboding, existential unease"],
  ["rage",        "It hurt", "rage",        "I was so angry",       "#C44B4B", "Fury, injustice, the urge to burn things down"],
  // It held me
  ["comfort",     "It held me", "comfort",    "it felt safe",           "#8E6B4B", "Safety, warmth, being held by a book"],
  ["tenderness",  "It held me", "tenderness", "it was gentle with me",  "#9B6B7B", "Gentle love, care, soft emotional moments"],
  ["joy",         "It held me", "joy",        "it made me happy",       "#E0A458", "Delight, gladness, the lightness a book can give"],
  ["amusement",   "It held me", "amusement",  "it made me laugh",       "#C9B24B", "Sharp humour, wit, the perfectly placed line that makes you grin"],
  // It wanted something
  ["longing",     "It wanted something", "longing",   "I ached for it",     "#5B6B8E", "Distance, wanting what you cannot have"],
  ["desire",      "It wanted something", "desire",    "the tension got me", "#9B5B8E", "Wanting, romantic tension, the pull toward"],
  ["nostalgia",   "It wanted something", "nostalgia", "it took me back",    "#B07B4B", "The ache of memory, a time you cannot return to"],
  // It moved me
  ["awe",         "It moved me", "awe",         "I had to stop and stare", "#4B7B6B", "Wonder, scale, the sublime"],
  ["recognition", "It moved me", "recognition", "how did it know",         "#4B8E8A", "Being seen — the book that knew you already"],
  ["catharsis",   "It moved me", "catharsis",   "I needed that cry",       "#C9A96E", "Release, relief, the exhale after tension"],
  // It lost me
  ["boredom",     "It lost me", "boredom",      "it bored me",           "#8A8A7A", "Flatness, the pages that wouldn't turn"],
  ["revulsion",   "It lost me", "revulsion",    "I couldn't stomach it", "#6B7A4B", "Disgust, recoil, wanting to put it down"],
  ["confusion",   "It lost me", "confusion",    "I lost the plot",       "#7B6B9B", "Lost the thread, couldn't follow, unmoored"],
  ["indifference","It lost me", "indifference", "nothing landed",        "#9A9A9A", "Nothing landed — you closed it and felt nothing"],
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
