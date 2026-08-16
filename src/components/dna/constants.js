// Phase 7 — DNA / Insight presentation.

// Default gate. The server is the source of truth (profile.needed / profile.enough);
// this is only the fallback before the profile has loaded. Below this, DNA is not
// computed and NO insight is ever fabricated. [F7.1]
export const MIN_BOOKS = 5;

// "What do you read for?" is a STATED preference stored as 1–2 canonical emotion
// slugs (B7.1) — the backend compares it against the emotions your shelf actually
// reveals ("you said comfort; your shelf says devastation"). The options are
// therefore the shared emotion vocabulary itself, not a bespoke list.
export const MAX_READ_FOR = 2;

// How many archetypes the engine can actually return. Mirrors PERSONALITY_TYPES
// in the backend's app/services/dna_engine.py — the two must agree. Referenced
// rather than retyped into copy: this number was wrong ("twelve") in three
// separate places at once before it was pinned here.
export const ARCHETYPE_COUNT = 8;

// Statuses that represent a book the reader actually opened. Mirrors
// OPENED_STATUSES in the backend's app/services/dna_signals.py — the two must
// agree, because this decides which books count toward the DNA gate and the
// backend decides which books DNA is actually computed from. A `want_to_read`
// is a shelved intention, not a reading; counting it here would show "DNA
// ready" over a pile of books nobody has opened. [B2.2]
export const OPENED_STATUSES = ["reading", "finished", "abandoned", "paused", "reread"];

export function openedBooks(entries) {
  return (entries || []).filter((e) => OPENED_STATUSES.includes(e.status ?? "finished"));
}
