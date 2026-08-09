/**
 * Read-through cache for the BOOK shelf. Not offline support — the name is a
 * leftover and the distinction matters.
 *
 * What this does: keeps the last-seen entries in localStorage so the shelf
 * paints instantly on revisit, while the server fetch runs behind it and
 * silently replaces what's here. What it does NOT do: queue writes, sync, or
 * resolve conflicts. Offline, you get a stale read and failed writes.
 *
 * (An earlier note here promised a queue "when the journal feature ships". The
 * journal has shipped and the queue hasn't, so the promise is deleted rather
 * than left to rot. If one is ever built, it must stay book-only for the same
 * reason journal pages live in React state and die with the tab: localStorage
 * outlives the session and is readable by any XSS. Book titles can take that.
 * Journal prose cannot — see contexts/PrivateJournalContext.jsx.)
 */

const ENTRIES_KEY = "bibliome_entries";

export function getCachedEntries() {
  try {
    const raw = localStorage.getItem(ENTRIES_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setCachedEntries(entries) {
  try {
    localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
  } catch (err) {
    console.warn("Failed to cache entries:", err);
  }
}

export function clearCache() {
  localStorage.removeItem(ENTRIES_KEY);
}