/**
 * The share card's words and rules, in one place (DNA card spec).
 *
 * The card payload (`card`) comes from the backend's dna_card.card_payload_from:
 * archetype (with `article`, `share_line`, `red_flag`), `palette`, `bloom`
 * (petal path data + the top three), `tagged_count`, `year`, `leaning`,
 * `season` and `red_flag` (null when switched off), and, on the owner's own
 * copy only, `choices` — the reader's two switches. Everything here is pure so
 * the canvas renderer, the in-app card and the share sheet say the same thing.
 */

export const SITE = "bibliome.app";

/** "The Grief Romantic" → "Grief Romantic": the card says "I'm a" above it. */
export function displayName(name = "") {
  return name.startsWith("The ") ? name.slice(4) : name;
}

/** "Grief Romantic" → ["Grief", "Romantic."]; "World-Diver" → ["World-Diver."].
 *  The last line is the italic, accent-coloured one. */
export function nameLines(name, suffix = ".") {
  const words = displayName(name).split(" ");
  if (words.length === 1) return [words[0] + suffix];
  return [words[0], words.slice(1).join(" ") + suffix];
}

export function article(a) {
  return a?.article || "a";
}

/** The reader's switches applied to their own full card. Strangers' payloads
 *  arrive with them already applied, so this is a no-op for those. */
export function applyChoices(card, choices) {
  if (!card) return null;
  const c = choices || card.choices || { season: true, red_flag: true };
  return {
    ...card,
    season: c.season ? card.season : null,
    red_flag: c.red_flag ? card.red_flag : null,
  };
}

/** The image formats this card can be made in. The season story only exists
 *  while a season is on the card and isn't the reader's own archetype. */
export function imageFormats(card) {
  const out = ["story", "square"];
  if (card?.season && !card.season.home) out.splice(1, 0, "season");
  return out;
}

export const FORMAT_LABELS = {
  story: "Story",
  season: "Season story",
  square: "Square",
  link: "Link",
};

export function cardUrl(token) {
  return token ? `https://${SITE}/s/${token}` : null;
}

/**
 * What goes with the image: "I'm a Grief Romantic. What's yours? bibliome.app/s/…".
 * Stories and the Web Share API can't carry alt text, so the words travel here.
 */
export function shareText(card, token, format = "story") {
  const link = token ? `${SITE}/s/${token}` : SITE;
  if (format === "season" && card?.season) {
    return `Lately, I'm in ${article(card.season)} ${displayName(card.season.name)} season. What's yours? ${link}`;
  }
  const a = card?.archetype;
  return `I'm ${article(a)} ${displayName(a?.name)}. What's yours? ${link}`;
}

export function fileName(card, format) {
  const slug = (card?.archetype?.id || "card").replace(/_/g, "-");
  return `bibliome-${slug}-${format}.png`;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December"];

/** "2026-08-02" → "SINCE AUGUST" (with the year if it isn't this one). */
export function sinceLabel(since, now = new Date()) {
  if (!since) return "LATELY";
  const [y, m] = since.split("-").map(Number);
  const month = MONTHS[(m || 1) - 1].toUpperCase();
  return y && y !== now.getFullYear() ? `SINCE ${month} ${y}` : `SINCE ${month}`;
}

export function booksLabel(n) {
  return `${n} ${n === 1 ? "BOOK" : "BOOKS"}`;
}

export function leaningLine(card) {
  const name = card?.leaning?.name || card?.runner_up;
  return name ? `leaning toward the ${displayName(name)}` : null;
}

/** "A bloom of petals, one per feeling, longest for heartbreak, catharsis and haunted." */
export function bloomAlt(bloom, lead = "A bloom of petals, one per feeling") {
  const names = (bloom?.top || []).map((t) => t.label);
  if (!names.length) return `${lead}.`;
  const most = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  return `${lead}, longest for ${most}.`;
}

/** Whether the season TURNED recently enough for the DNA page to say so. A
 *  reader's first season is not a turn (`seasons` is the payload's own list,
 *  newest first), and neither is coming home to their own archetype. */
export function seasonJustTurned(card, seasons, now = new Date(), days = 14) {
  const s = card?.season;
  if (!s || s.home || !s.since || (seasons || []).length < 2) return false;
  const since = new Date(`${s.since}T00:00:00Z`);
  return now - since <= days * 86400000;
}
