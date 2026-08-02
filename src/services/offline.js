/**
 * Local cache for Bibliome.
 *
 * Caches entries in localStorage so the shelf loads instantly on revisit.
 * Server fetch runs in the background and silently replaces cached data.
 *
 * Full offline queue/sync will be added when journal feature ships.
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