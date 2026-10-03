// Copy for the DNA's aliveness layer: the echo after a save, the season and
// leaning lines, the shift card, the moments list. [DNA Aliveness spec · Copy]
//
// The backend decides WHAT happened (dna_signals.echo_for / dna_state); this file
// only words it. Nothing here counts toward anything, compares the reader with
// anyone else, or says how many books are left until something — the DNA tests'
// ban on "reveal", "streak" and comparisons covers every string below.
import { EMOTIONS } from "../../services/emotions";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December"];

// "The World-Diver" → "World-Diver": archetypes drop "The" inside a sentence.
export function shortName(nameOrArch) {
  const name = typeof nameOrArch === "string" ? nameOrArch : nameOrArch?.name;
  return (name || "").replace(/^The\s+/, "");
}

// "a World-Diver", "an Adrenaline Seeker".
export function withArticle(nameOrArch) {
  const s = shortName(nameOrArch);
  return `${/^[AEIOU]/i.test(s) ? "an" : "a"} ${s}`;
}

// ISO date → "August" (or "August 2025" when it isn't this year). Cut from the
// string, never through a Date: a midnight-UTC date read in local time lands on
// the day before west of Greenwich.
export function monthLabel(iso, { year = "auto", now = new Date() } = {}) {
  if (!iso) return "";
  const y = Number(iso.slice(0, 4));
  const m = MONTHS[Number(iso.slice(5, 7)) - 1] || "";
  const showYear = year === true || (year === "auto" && y !== now.getFullYear());
  return showYear ? `${m} ${y}` : m;
}

const shortMonth = (iso) => MONTHS[Number(iso.slice(5, 7)) - 1]?.slice(0, 3) || "";

// A season or an era's dates: "Aug–Oct 2026", "Nov 2025–Feb 2026", "since Aug 2026".
export function spanLabel(from, to) {
  if (!from) return "";
  const fy = from.slice(0, 4);
  if (!to) return `since ${shortMonth(from)} ${fy}`;
  const ty = to.slice(0, 4);
  if (fy === ty) {
    return shortMonth(from) === shortMonth(to)
      ? `${shortMonth(from)} ${fy}`
      : `${shortMonth(from)}–${shortMonth(to)} ${fy}`;
  }
  return `${shortMonth(from)} ${fy}–${shortMonth(to)} ${ty}`;
}

const feelingName = (slug) => {
  const n = EMOTIONS[slug]?.name || slug || "";
  return n.charAt(0).toUpperCase() + n.slice(1);
};
const feelingPhrase = (slug) => EMOTIONS[slug]?.label || slug || "";

// The echo's first line: what this book did.
export function echoLine(echo) {
  if (!echo?.book_type) return null;
  const type = shortName(echo.book_type);
  if (echo.relation === "deepened") return `Deep in ${type} territory.`;
  if (echo.relation === "pulled") return `This one pulled you toward the ${type}.`;
  return `That reads like ${withArticle(type)} book.`;
}

// The echo's one extra line, or null. The backend has already picked the one
// that matters most (shift, season, first, leaning — in that order).
export function echoExtra(echo) {
  const x = echo?.extra;
  if (!x) return null;
  switch (x.kind) {
    case "shift":
      return `And that tipped it: you're ${withArticle(x.to)} now.`;
    case "season":
      return x.home ? "Back in your element." : `Your season just turned: ${shortName(x.archetype)}.`;
    case "first":
      return `A first for you: “${feelingPhrase(x.emotion)}”.`;
    case "return":
      return `${feelingName(x.emotion)} is back, first time in ${x.gap} books.`;
    case "spectrum":
      return "That's every feeling, at least once.";
    case "leaning":
      return `You're leaning toward the ${shortName(x.archetype)}.`;
    default:
      return null;
  }
}

// Under the archetype on the DNA card.
export function seasonLine(season, opts) {
  if (!season) return null;
  const since = monthLabel(season.since, opts);
  const what = season.home ? "in your element" : `in ${withArticle(season)} season`;
  return since ? `${what} · since ${since}` : what;
}

export function leaningLine(leaning) {
  if (!leaning) return null;
  return `leaning toward the ${shortName(leaning)}`;
}

// One row of the Moments list (date and book are set beside it).
export function momentLine(m) {
  if (!m) return "";
  if (m.kind === "first") return `A first: “${feelingPhrase(m.emotion)}”`;
  if (m.kind === "return") return `${feelingName(m.emotion)} is back, first time in ${m.gap} books`;
  if (m.kind === "spectrum") return "Every feeling, at least once";
  return "";
}

// The shift card, from the payload's `eras` (newest first).
export function shiftCopy(eras) {
  const [now, before] = eras || [];
  if (!now || !before) return null;
  // The list of books only follows when there are books to list (never for
  // the Discerning Reader, which no single book points to).
  const books = (now.books_that_moved || []).length > 0;
  return {
    title: `You've become ${withArticle(now)}.`,
    body: `You read as ${withArticle(before)} from ${monthLabel(before.from, { year: true })}. ` +
      (books
        ? `Since ${monthLabel(now.from)}, these books pulled you somewhere new:`
        : `Since ${monthLabel(now.from)}, your reading has moved somewhere new.`),
    footer: `Your ${shortName(before)} era is kept under Eras.`,
  };
}
