/**
 * "Haven't I already shelved this?"
 *
 * Pure, and deliberately in its own file: the matching rules are the whole of
 * this feature's risk, and they should be readable and testable without mounting
 * a modal.
 *
 * The bar is set for ASKING, not for blocking. A second entry for the same book
 * is a legitimate record — a reread five years later is a different experience
 * with different emotions, and the shelf should be able to hold both. So a false
 * positive costs one glance at a notice, while a false negative silently leaves
 * two copies of a book quietly double-counting themselves in the DNA. That
 * asymmetry is why the rules below lean generous, and why nothing here ever
 * returns "no, you may not".
 */

// Diacritics folded, punctuation dropped, whitespace collapsed. Apostrophes are
// removed rather than spaced so "Handmaid's" stays one token.
export function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Leading articles only. Subtitles are NOT stripped: "Dune" and "Dune: Messiah"
// are different books, and cutting at the colon would merge them.
export function normalizeTitle(value) {
  return normalizeText(value).replace(/^(the|a|an)\s+/, "");
}

/** Digits (and a trailing X) only, and only if it's a plausible ISBN length —
 *  a truncated or junk identifier must not become a match key. */
export function normalizeIsbn(value) {
  const s = String(value || "").toUpperCase().replace(/[^0-9X]/g, "");
  return s.length === 10 || s.length === 13 ? s : "";
}

/**
 * Subset match over name tokens, so all of these agree:
 *   "Susanna Clarke" · "Clarke, Susanna" · "Clarke" · "SUSANNA CLARKE"
 * A missing author on either side is not a match — it's handled a tier down,
 * where a title-only hit is reported as the weaker "possible".
 */
export function authorsMatch(a, b) {
  const A = new Set(normalizeText(a).split(" ").filter(Boolean));
  const B = new Set(normalizeText(b).split(" ").filter(Boolean));
  if (!A.size || !B.size) return false;
  const [small, big] = A.size <= B.size ? [A, B] : [B, A];
  for (const token of small) if (!big.has(token)) return false;
  return true;
}

// Strongest first. The caller shows the same notice either way; the tier exists
// so the copy can hedge honestly when only the title lined up.
const RANK = { isbn: 3, title_author: 2, title: 1 };

/**
 * The best match for `candidate` among `entries`, or null.
 *
 * @param entries   the shelf, as loaded (any order)
 * @param candidate { title, author, isbn } from the open form
 * @param excludeId an entry id to ignore — an entry being EDITED is not its own
 *                  duplicate, and neither is the optimistic temp row of a save
 *                  already in flight
 * @returns { entry, reason: "isbn" | "title_author" | "title" } | null
 */
export function findDuplicateEntry(entries, candidate, { excludeId = null } = {}) {
  const title = normalizeTitle(candidate?.title);
  if (!title) return null; // nothing to match on yet

  const isbn = normalizeIsbn(candidate?.isbn);
  const author = candidate?.author;
  let best = null;

  for (const entry of entries || []) {
    if (!entry || (excludeId != null && String(entry.id) === String(excludeId))) continue;
    // A save in flight renders as `temp-…`; matching it would tell the user they
    // duplicated the row they are currently creating.
    if (String(entry.id || "").startsWith("temp-")) continue;

    let reason = null;
    if (isbn && normalizeIsbn(entry.isbn) === isbn) {
      reason = "isbn";
    } else if (normalizeTitle(entry.title) === title) {
      // Same title. Whether that's the same BOOK depends on the author, and when
      // either side hasn't got one we say so rather than guessing.
      if (authorsMatch(author, entry.author)) reason = "title_author";
      else if (!normalizeText(author) || !normalizeText(entry.author)) reason = "title";
      // Same title, two different named authors → genuinely different books.
    }

    if (reason && (!best || RANK[reason] > RANK[best.reason])) {
      best = { entry, reason };
      if (reason === "isbn") break; // nothing outranks it
    }
  }

  return best;
}
