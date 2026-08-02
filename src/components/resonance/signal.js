/**
 * What counts as "something new is waiting" — shared by the ambient nav mark and
 * the Resonance page so they can never disagree about it.
 *
 * Deliberately boolean. There is no count anywhere in this feature: the nav shows
 * a presence mark or nothing at all, the same way the notification bell shows a
 * dot rather than a number.
 */

const SEEN_KEY = "bibliome_resonance_seen";

/**
 * Matches that are actually waiting on the reader: a fresh suggestion, or a note
 * someone left that hasn't been answered.
 *
 * `connected` is NOT here. A live conversation is not an unread badge — new
 * messages are the notification centre's job, and surfacing them as a permanent
 * mark would turn a quiet room into an inbox.
 */
export function waitingMatchIds(matches = []) {
  return matches
    .filter((m) => m.status === "suggested" || (m.status === "pending" && m.direction === "they_reached"))
    .map((m) => m.match_id);
}

function readSeen() {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

/** True when at least one waiting match hasn't been looked at yet. */
export function hasUnseen(matches = []) {
  const seen = readSeen();
  return waitingMatchIds(matches).some((id) => !seen.has(id));
}

/**
 * True when the reader has any live connection at all — a note in flight or an
 * open conversation.
 *
 * The nav mark needs this as well as `hasUnseen`, or a reader whose matches are
 * all answered would have no way back to a conversation they're in the middle of.
 * It renders muted in that case: still no badge, still no count, just a door
 * that exists because there's a room behind it.
 */
export function hasLive(matches = []) {
  return matches.some((m) => m.status === "pending" || m.status === "connected");
}

/**
 * Called when the reader opens the page. Stores only the ids currently waiting,
 * so the set can't grow without bound and a genuinely new match brings the mark
 * back rather than being swallowed by an ever-growing "seen everything" flag.
 */
export function markSeen(matches = []) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(waitingMatchIds(matches)));
  } catch {
    /* storage unavailable — the mark just stays until the match is acted on */
  }
}
