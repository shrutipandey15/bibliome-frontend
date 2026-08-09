/**
 * Where a notification goes when you click it.
 *
 * Pure and separate so the mapping can be read against the backend's `notify()`
 * call sites without mounting anything. Every route below is one the app really
 * serves, and every payload field is one the API really sends:
 *
 *   echo_reply          app/routers/echo.py       → { echo_id, book_title, actors, count }
 *   resonance_reach     app/routers/resonance.py  → { match_id }
 *   resonance_connected app/routers/resonance.py  → { match_id, thread_id }
 *   resonance_message   app/routers/threads.py    → { thread_id }
 *   dna_shifted         app/services/dna_service  → { old, new }
 *   weekly_digest       app/services/digest_svc   → { period, books_this_week, memory }
 *   tier 0 (security)   app/routers/auth.py       → { message }
 *
 * Resonance lands on the page, not on a specific card: those payloads carry a
 * match/thread id but the API deliberately exposes no handle or book until both
 * readers have said yes, so a deep link would be pointing at something the room
 * itself declines to name. The page is the honest destination.
 *
 * Returns null for anything unrecognised — an unknown notification renders as
 * plain text rather than as a button that goes nowhere.
 */

// Tier 0 is security. It is the one kind that is never disableable, and the only
// useful thing to do about it is look at your account.
const TIER_SECURITY = 0;

export function notificationTarget(n) {
  if (!n) return null;
  const p = n.payload || {};

  if (n.tier === TIER_SECURITY) return "/settings?section=security";

  switch (n.kind) {
    case "echo_reply":
      // Straight into the thread that was replied to, not just the feed.
      return p.echo_id ? `/echoes?echo=${encodeURIComponent(p.echo_id)}` : "/echoes";
    case "resonance_reach":
    case "resonance_connected":
    case "resonance_message":
      return "/resonance";
    case "dna_shifted":
      return "/?view=dna";
    case "weekly_digest":
      // The digest is about the reading week, and the mirror it summarises lives
      // on the shelf.
      return "/";
    default:
      return null;
  }
}
