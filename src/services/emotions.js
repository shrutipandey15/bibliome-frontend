import {
  Flame, CloudMoon, Heart, Coffee, Sparkles,
  Aperture, Droplets, Telescope, Leaf, HelpCircle,
  Sun, Laugh, Hourglass, Meh, Frown, Tornado, CircleOff,
  Ghost, Zap, CloudLightning, Users, Sprout, Flower2, Rose, Lightbulb, Feather,
} from "lucide-react";

// ── Shared emotion vocabulary [F1.5 / P2-9, P2-12] — v3, 21 feelings ──
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
  // it broke me
  grief:       { Icon: Droplets,       glyph: "◦" },
  catharsis:   { Icon: Sparkles,       glyph: "✧" },
  haunted:     { Icon: Ghost,          glyph: "◍" },
  // it hooked me
  thrill:      { Icon: Zap,            glyph: "»" },
  dread:       { Icon: CloudMoon,      glyph: "◐" },
  shock:       { Icon: CloudLightning, glyph: "!" },
  rage:        { Icon: Flame,          glyph: "◉" },
  // it held me
  comfort:     { Icon: Coffee,         glyph: "○" },
  attachment:  { Icon: Users,          glyph: "∞" },
  nostalgia:   { Icon: Hourglass,      glyph: "☾" },
  // it lit me up
  joy:         { Icon: Sun,            glyph: "☀" },
  amusement:   { Icon: Laugh,          glyph: "‡" },
  hope:        { Icon: Sprout,         glyph: "❀" },
  // it got my heart
  swoon:       { Icon: Flower2,        glyph: "❦" },
  desire:      { Icon: Heart,          glyph: "♡" },
  longing:     { Icon: Leaf,           glyph: "❋" },
  conflicted:  { Icon: Rose,           glyph: "⚘" },
  // it opened my eyes
  awe:         { Icon: Telescope,      glyph: "✺" },
  recognition: { Icon: Aperture,       glyph: "◈" },
  insight:     { Icon: Lightbulb,      glyph: "✳" },
  beauty:      { Icon: Feather,        glyph: "✒" },
  // retired "it lost me" tags — display only, never offered (see RETIRED below)
  boredom:     { Icon: Meh,            glyph: "—" },
  revulsion:   { Icon: Frown,          glyph: "✗" },
  confusion:   { Icon: Tornado,        glyph: "✦" },
  indifference:{ Icon: CircleOff,      glyph: "◌" },
};

// Canonical seed — mirrors the backend's served vocabulary. Each emotion carries
// BOTH a `phrase` (the first-person line the UI shows — "it broke my heart") and a
// `name` (the plain word — "heartbreak", used where a single token is wanted).
// Per VISION §4 the reader sees phrases, never the word/slug. `family`, `phrase`,
// `name`, and `color` are all OWNED BY THE BACKEND and refreshed from GET
// /emotions by hydrateEmotions() so nothing drifts. Order matters: families
// render in first-appearance order.
//
// Every phrase must carry its whole meaning alone: the picker shows the family
// and the phrase, never the description. These lines were chosen in a blind
// reader test (Emotion & DNA rework, Stage 2); change them there, not here.
// Tuple: [slug, family, name(word), phrase, color, description]
const SEED = [
  // it broke me
  ["grief",       "it broke me", "heartbreak", "it broke my heart",               "#6B4F8E", "Sorrow over a loss in the story that stays with you after the last page."],
  ["catharsis",   "it broke me", "catharsis",  "I cried and felt lighter",        "#C9A96E", "The release after the tension. A cry that leaves you lighter."],
  ["haunted",     "it broke me", "haunted",    "a scene keeps coming back to me", "#3D2B3D", "An image or scene that keeps returning, often eerie, long after you finish."],
  // it hooked me
  ["thrill",      "it hooked me", "page-turner", "I read it in one sitting",      "#D08A3C", "Pull and momentum. One more chapter until it's 3am — fast plot or quietly absorbing."],
  ["dread",       "it hooked me", "tension",     "it had me scared or on edge",   "#4B6B8E", "Fear, suspense and unease while reading — or real-world worry it leaves behind."],
  ["shock",       "it hooked me", "shock",       "I did NOT see that coming",     "#8E4B6B", "The twist, the reveal, the turn that rearranged everything."],
  ["rage",        "it hooked me", "anger",       "what happened made me furious", "#C44B4B", "Anger at an injustice inside the story — not anger at the book itself."],
  // it held me
  ["comfort",     "it held me", "comfort",    "like a hug on a rainy day",       "#8E6B4B", "Soothing: safe, warm and gentle, or calm and still. A soft place to land."],
  ["attachment",  "it held me", "attachment", "they felt like my friends",       "#9B6B7B", "Loving the characters like real people, and missing them when it ends."],
  ["nostalgia",   "it held me", "nostalgia",  "it took me back to a younger me", "#B07B4B", "It brings back your own past — a time, a place, an earlier you."],
  // it lit me up
  ["joy",         "it lit me up", "joy",      "it made me so happy",            "#E0A458", "Pure lightness. You put it down happier than you picked it up."],
  ["amusement",   "it lit me up", "laughter", "it made me laugh",               "#C9B24B", "Genuinely funny — out loud or quietly, dry or silly."],
  ["hope",        "it lit me up", "hope",     "I closed it feeling inspired",   "#7BA05B", "Hopeful, uplifted, proud or motivated. Believing in people, or yourself, again."],
  // it got my heart
  ["swoon",       "it got my heart", "swoon",      "it gave me butterflies",            "#D47A9B", "Giddy romantic delight. Kicking your feet over a love story."],
  ["desire",      "it got my heart", "desire",     "the chemistry nearly killed me",    "#9B5B8E", "Romantic or sexual tension between characters. The slow burn, the almost."],
  ["longing",     "it got my heart", "longing",    "a soft ache for what I can't have", "#5B6B8E", "Your own ache for something you can't have or can't quite name."],
  ["conflicted",  "it got my heart", "conflicted", "I shouldn't love this but I do",    "#6B3A4D", "Loving what you feel you shouldn't — a villain, a dark story. Guilty pleasure."],
  // it opened my eyes
  ["awe",         "it opened my eyes", "awe",         "so vast it made me go quiet",  "#4B7B6B", "Wonder at something vast or grand. You feel small, and go quiet."],
  ["recognition", "it opened my eyes", "recognition", "it knew me",                   "#4B8E8A", "Being seen. The book that already knew you."],
  ["insight",     "it opened my eyes", "insight",     "it changed how I think",       "#5A7A9A", "Ideas that engaged your mind. You learned something, or now see it differently."],
  ["beauty",      "it opened my eyes", "beauty",      "the writing was so beautiful", "#A08BB8", "Delight in the writing itself — sentences you read twice."],
];

// Retired "it lost me" tags. Older entries still carry them, so they stay
// displayable, but they are verdicts now (the "How did it land?" step), never
// offered in a picker and never counted as feelings. No `family`, so
// getEmotionFamilies skips them; not in EMO_LIST, so no picker lists them.
// Tuple: [slug, name, phrase, color]
const RETIRED = [
  ["boredom",      "boredom",      "my two brain cells died",         "#8A8A7A"],
  ["revulsion",    "revulsion",    "I felt a little sick",            "#6B7A4B"],
  ["confusion",    "confusion",    "I have no idea what happened",    "#7B6B9B"],
  ["indifference", "indifference", "closed it and forgot it existed", "#9A9A9A"],
];

export const EMOTIONS = {};
for (const [slug, family, name, phrase, color, desc] of SEED) {
  // `label` is the primary display string — the phrase. `name` is the compact word.
  EMOTIONS[slug] = { family, name, label: phrase, color, desc, symbol: null, ...(PRESENTATION[slug] || {}) };
}

// EMO_LIST holds live references to the EMOTIONS objects. hydrateEmotions mutates
// those objects IN PLACE, so this array never needs rebuilding. Built BEFORE the
// retired tags are added below, so no picker ever offers them.
export const EMO_LIST = Object.entries(EMOTIONS);

export const RETIRED_EMOTIONS = new Set(RETIRED.map(([slug]) => slug));
for (const [slug, name, phrase, color] of RETIRED) {
  EMOTIONS[slug] = { name, label: phrase, color, desc: "", symbol: null, retired: true, ...(PRESENTATION[slug] || {}) };
}

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
