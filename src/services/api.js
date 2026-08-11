import { clearCache } from "./offline";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

// Typed error so callers can tell *why* a fetch failed (rate-limited vs. server
// error vs. offline) instead of collapsing every failure into an empty result.
// `kind` is a stable, UI-friendly discriminant. [F1.2 / P5-2]
export class ApiError extends Error {
  constructor(status, kind, message) {
    super(message || kind);
    this.name = "ApiError";
    this.status = status;
    this.kind = kind; // "rate_limited" | "server" | "offline" | "client"
  }
}

export function errorKind(status) {
  if (status === 429) return "rate_limited";
  if (status >= 500) return "server";
  if (status >= 400) return "client";
  return "server";
}

// Wrap apiFetch and reject with a typed ApiError on failure. Network failures
// (fetch throws) become an "offline" ApiError.
async function apiGet(path) {
  let res;
  try {
    res = await apiFetch(path);
  } catch {
    throw new ApiError(0, "offline", "Network request failed");
  }
  if (!res.ok) throw new ApiError(res.status, errorKind(res.status));
  return res.json();
}

// ── Token management (authCookieContract.md / B1.10 / P1-1) ──
// The access token lives in MEMORY ONLY — never localStorage. An XSS can read
// localStorage, so a refresh token stored there = account takeover. The refresh
// token instead lives in an httpOnly cookie the browser manages and JS cannot
// see; the worst an XSS can do is steal a 15-minute access token.
let accessToken = null;

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token) {
  accessToken = token || null;
}

// End the session locally: drop the in-memory token and wipe the per-account
// cache so the next user never sees the previous user's shelf. [F1.4 / P5-3]
// (The httpOnly cookie is cleared server-side by POST /auth/logout.)
export function clearSession() {
  accessToken = null;
  clearCache();
}

// One-time cutover: older builds stored tokens in localStorage. They're no longer
// valid; remove them so nothing stale lingers. [authCookieContract.md §Cutover]
// The key deliberately keeps its pre-rename `bookdna_` name — it is the historical
// key we are clearing, not a current one. Do not "fix" it to bibliome_.
try {
  localStorage.removeItem("bookdna_tokens");
} catch {
  // ignore — storage may be unavailable
}

// ── Single-flight token refresh ──
// A rotating refresh token can only be redeemed once. If several requests 401 at
// the same time and each POSTs /auth/refresh, all but the first redeem a stale
// token, the backend revokes the session, and the user is logged out at random.
// We funnel every concurrent refresh through one shared promise so exactly one
// /auth/refresh fires per stampede. [F1.1 / P2-11]
let refreshPromise = null;

async function doRefresh() {
  // Empty body — the httpOnly cookie IS the credential. Must send credentials so
  // the browser attaches the cookie.
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    credentials: "same-origin",
  });
  if (!res.ok) throw new Error("refresh_failed");
  const data = await res.json();
  setAccessToken(data.access_token);
  return data;
}

// Exposed so the app can attempt a silent login on boot (access token is gone
// from memory after a reload; the cookie survives). Single-flight guarded.
export function refreshOnce() {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

// ── Core fetch wrapper with auto-refresh ──
export async function apiFetch(path, opts = {}) {
  const headers = { "Content-Type": "application/json", ...opts.headers };
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  // Handle blob responses (don't set Content-Type if body is FormData, etc.)
  if (opts.body instanceof FormData) {
    delete headers["Content-Type"];
  }

  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "same-origin",
    ...opts,
    headers,
  });

  // Auto-refresh on 401 (single-flight; retry once with the fresh token).
  if (res.status === 401 && !opts._retried) {
    try {
      await refreshOnce();
    } catch {
      clearSession();
      return res;
    }
    return apiFetch(path, { ...opts, _retried: true });
  }

  return res;
}

// ── Auth ──
// login/register return { access_token, expires_in, user } and set the refresh
// cookie via Set-Cookie. No refresh token ever appears in the body.
export async function register(email, username, password, displayName) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      username,
      password,
      display_name: displayName || username,
    }),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.detail || "Registration failed");
  }
  const data = await res.json();
  setAccessToken(data.access_token);
  return data;
}

export async function login(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.detail || "Login failed");
  }
  const data = await res.json();
  setAccessToken(data.access_token);
  return data;
}

// Revoke server-side (clears the httpOnly cookie) then drop local state. Best
// effort — even if the network call fails, the local session is cleared.
export async function logout() {
  try {
    await fetch(`${API_BASE}/auth/logout`, {
      method: "POST",
      credentials: "same-origin",
    });
  } catch {
    // ignore — clear locally regardless
  }
  clearSession();
}

export async function getMe() {
  const res = await apiFetch("/auth/me");
  if (!res.ok) return null;
  return res.json();
}

// ── Entries ──
// One page of entries in keyset (cursor) mode — the preferred contract [B1.4].
// Pass `cursor` from the previous page's `next_cursor`; omit it for the first
// page. Returns { entries, total, next_cursor, has_more }. Throws ApiError on
// failure (incl. 400 for a malformed cursor) so an empty shelf is never confused
// with an error. [F1.2 / P5-2]
export async function getEntries({ cursor = null, limit = 100 } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set("cursor", cursor);
  return apiGet(`/entries?${params.toString()}`);
}

// Walk the keyset cursor to the end and return the whole library. The shelf, DNA,
// stats and filters all work over the full set in memory; this also fixes the old
// per_page=100 truncation that hid books past the 100th. [F1.8 / B1.4]
// `maxPages` is a safety valve against a backend that never flips has_more.
export async function getAllEntries({ pageSize = 100, maxPages = 200 } = {}) {
  const all = [];
  let cursor = null;
  let total = 0;
  for (let i = 0; i < maxPages; i++) {
    const data = await getEntries({ cursor, limit: pageSize });
    all.push(...(data.entries || []));
    total = typeof data.total === "number" ? data.total : all.length;
    if (!data.has_more || !data.next_cursor) break;
    cursor = data.next_cursor;
  }
  return { entries: all, total };
}

// Import a Goodreads / StoryGraph CSV export. [F2.6 / B2.7]
// Multipart upload; apiFetch strips Content-Type for FormData so the browser sets
// the multipart boundary. Returns { parsed, imported, skipped, errors: [] }.
export async function importLibrary(file) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await apiFetch("/entries/import", { method: "POST", body: fd });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.detail || "Import failed");
  }
  return res.json();
}

export async function createEntry(data) {
  const res = await apiFetch("/entries", {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create entry");
  return res.json();
}

export async function updateEntry(id, data) {
  const res = await apiFetch(`/entries/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update entry");
  return res.json();
}

// Finish Flow — the three-beat emotional arc. [F2.2 / B2.2]
// data: { start_emotion_slug, middle_emotion_slug, end_emotion_slug, thought, intensity }
export async function finishEntry(id, data) {
  const res = await apiFetch(`/entries/${id}/finish`, {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.detail || "Failed to finish book");
  }
  return res.json();
}

// Currently-reading check-ins — the "how's it feeling now?" beat. [F2.3 / B2.3]
export async function getCheckins(id) {
  const res = await apiFetch(`/entries/${id}/checkins`);
  if (!res.ok) return [];
  return res.json();
}

export async function createCheckin(id, data) {
  const res = await apiFetch(`/entries/${id}/checkins`, {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.detail || "Failed to save check-in");
  }
  return res.json();
}

export async function deleteEntry(id) {
  const res = await apiFetch(`/entries/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const err = new Error("Failed to delete entry");
    err.status = res.status;
    throw err;
  }
}

// ── DNA / Insight [Phase 7 — real backend contract, app/services/dna_insights.build_dna] ──
// GET /dna/profile returns the owner's private "v2" mirror. ALL prose is hand-templated
// on the BACKEND and filled with hard data — the frontend NEVER generates insight copy
// (no LLM), it only renders `insight.text`. [F7.5] The mirror AUTO-COMPUTES on read
// (no manual generate needed). Shape:
// The gate counts books CARRYING A FEELING, not books: five untagged imports are
// five titles nobody has said anything about.
//   Below the gate:  { enough: false, book_count, tagged_count, needed, message }
//   Above the gate:  {
//     enough: true,
//     book_count, tagged_count,
//     // DEMOTED — and NULLABLE. The engine abstains when the tally has no clear
//     // favourite, so `enough: true` with `archetype: null` is a valid payload
//     // and every consumer must handle it. Do NOT use it as a proxy for `enough`.
//     archetype: { id, name, description, color, glyph, blind_spots, comfort_tropes } | null,
//     archetype_scores: { type_id: number },                  // all 8, for the margin
//     margin: number,          // how far the leader cleared the runner-up, 0..1 of its own score
//     runner_up: string | null,// the name it was nearly instead; only sent when margin < 0.10
//     basis: { counts: [{ emotion, books, of }], top_rated_emotions: string[] } | null,
//     insights: [{ category, variant, text, n, surprise }],  // ranked by surprise; basis = n [F7.2]
//     locked:   [{ category, unlocks_at, reason }],           // "not yet", real reason [F7.4]
//     // `current_books` is books ALONE; the other two span the journal. Only
//     // `current_books` is ever served to a public surface.
//     profiles: { enduring: {...}, current: {...}, current_books: {...} }, // slug: weight
//     drift: number,                                          // 0..1 magnitude of the shift [F7.3]
//     reads_for: string[] | null,                             // stated emotion slugs [F7.7]
//   }
export async function getDNAProfile() {
  const res = await apiFetch("/dna/profile");
  if (!res.ok) return null;
  return res.json();
}

// "What do you read for" is a stated preference stored on the user as 1–2 canonical
// EMOTION slugs; it lives on PATCH /user/settings (it dirties the DNA cache so the
// stated-vs-revealed insight recomputes). [F7.7 / B7.1]
export async function setReadFor(values) {
  return updateSettings({ reads_for: values && values.length ? values : null });
}

export async function generateDNA() {
  const res = await apiFetch("/dna/generate", { method: "POST" });
  if (!res.ok) {
    const d = await res.json();
    throw new Error(d.detail || "Failed to generate DNA");
  }
  return res.json();
}

// One point per DNA snapshot, oldest first (B7.4) — the full evolution timeline.
// NOT needed for the "what's changed" section any more: /dna/profile now carries
// `snapshot_count`/`has_two_snapshots` directly, so distinguishing "no history"
// from "steady" costs no extra request. Kept for a timeline view of the snapshots
// themselves. Returns [] on failure — a missing history is quiet, never an error.
export async function getDNAEvolution() {
  const res = await apiFetch("/dna/evolution");
  if (!res.ok) return [];
  return res.json();
}

export async function getHeatmap() {
  const res = await apiFetch("/dna/heatmap");
  if (!res.ok) return null;
  return res.json();
}

export async function getStats() {
  const res = await apiFetch("/dna/stats");
  if (!res.ok) return null;
  return res.json();
}

// Stats + heatmap in one round trip, backing the merged Patterns view. [F5.2 / B5.4]
export async function getPatterns() {
  const res = await apiFetch("/dna/patterns");
  if (!res.ok) return null;
  return res.json(); // { stats, heatmap }
}


export async function generateShareToken() {
  const res = await apiFetch("/user/share-token", { method: "POST" });
  if (!res.ok) throw new Error("Failed to generate share link");
  return res.json();
}

// Revoke ALL of the caller's active share links (204 No Content). [B2.1]
export async function revokeShareTokens() {
  const res = await apiFetch("/user/share-token", { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to revoke share links");
}

// The share card. Served from the OWNER'S CACHE, by the same engine their own DNA
// tab renders — it used to recompute a second, older engine live, which could name
// a different archetype than the app had shown them. Never recomputed here, so a
// card can lag a just-added book until the owner's DNA is recomputed.
//   { handle, share_token, archetype, archetype_scores, margin, basis, book_count,
//     top_emotions: [{ emotion_id, weight }] }   // weight is a 0..1 SHARE, not a count
// 404 → null: the token is dead, OR the reader has no DNA yet (the card refuses to
// exist for a reader the app itself is telling to keep reading). The old
// `personality` / `stats` keys are gone.
export async function getSharedDNA(token) {
  const res = await apiFetch(`/public/shared/${token}`);
  if (!res.ok) return null;
  return res.json();
}

// ── User ──
export async function getSettings() {
  const res = await apiFetch("/user/settings");
  if (!res.ok) return null;
  return res.json();
}

export async function updateSettings(data) {
  const res = await apiFetch("/user/settings", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.detail || "Failed to update settings");
  }
  return res.json();
}

// `journalKeyBundle` re-wraps the journal's data key under the new password in
// the SAME transaction as the password change. The server cannot do this re-wrap
// (it has neither key), so omitting the bundle is not neutral: the password is
// changed, the password-wrapped key is orphaned, and the response comes back
// with journal.rewrapped=false and password_wrap_stale set. Only omit it when
// the journal is locked and we genuinely have no DEK to re-wrap.
// [journalCryptoContract.md §5]
export async function changePassword(currentPassword, newPassword, journalKeyBundle = null) {
  const res = await apiFetch("/user/change-password", {
    method: "POST",
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
      ...(journalKeyBundle ? { journal_key_bundle: journalKeyBundle } : {}),
    }),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.detail || "Failed to change password");
  }
  return res.json();
}

// ── Profile — the private mirror as a place [F2.8 / B2.1 §Feature 2] ──
// Composed dict: { restricted, handle, display_name, bio, profile_visibility,
// personality_type, member_since, is_self, signature, now_reading[], collections[],
// milestones[], book_count, registers_felt, avg_intensity, set_down, recent[],
// margins[] }.
//
// Everything countable is counted server-side from real entries, and a figure the
// shelf can't support comes back null rather than 0 (`avg_intensity` on an empty
// shelf) — the study omits the tile instead of printing a fabricated number.
//   milestones[] — now { kind, label, achieved, achieved_at }, and includes the
//     ones NOT yet reached so the study can show what's ahead. Other people's
//     profiles must filter to `achieved !== false`.
//   margins[]    — the line you kept per book (`entry.quote`, first one wins when
//     a book was read twice). OWNER ONLY: [] for every other viewer, because the
//     quote is written alongside the private notes.
//   now_reading[].last_checkin — { emotion, note, at } | null, owner-only too.
export async function getMyProfile() {
  const res = await apiFetch("/me/profile");
  if (!res.ok) return null;
  return res.json();
}

export async function getProfileByHandle(handle) {
  const res = await apiFetch(`/profile/${encodeURIComponent(handle)}`);
  if (!res.ok) return null; // 404 = blocked / unknown / private-to-stranger
  return res.json();
}

export async function updateMyProfile(data) {
  const res = await apiFetch("/me/profile", { method: "PATCH", body: JSON.stringify(data) });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.detail || "Couldn't update profile");
  }
  return res.json();
}

// ── Collections (curated shelves) ──
export async function createCollection(data) {
  const res = await apiFetch("/collections", { method: "POST", body: JSON.stringify(data) });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.detail || "Couldn't create collection");
  }
  return res.json();
}

export async function updateCollection(id, data) {
  const res = await apiFetch(`/collections/${id}`, { method: "PATCH", body: JSON.stringify(data) });
  if (!res.ok) throw new Error("Couldn't update collection");
  return res.json();
}

export async function deleteCollection(id) {
  const res = await apiFetch(`/collections/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Couldn't delete collection");
}

export async function addCollectionItem(id, entryId) {
  const res = await apiFetch(`/collections/${id}/items`, { method: "POST", body: JSON.stringify({ entry_id: entryId }) });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.detail || "Couldn't add book");
  }
}

export async function removeCollectionItem(id, entryId) {
  const res = await apiFetch(`/collections/${id}/items/${entryId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Couldn't remove book");
}

export async function reorderCollection(id, entryIds) {
  const res = await apiFetch(`/collections/${id}/reorder`, { method: "PATCH", body: JSON.stringify({ entry_ids: entryIds }) });
  if (!res.ok) throw new Error("Couldn't reorder");
}

// ── Mirror: insights + resurfaced memories [F2.5 / B2.6] ──
// Both return null-able content — a genuine "not enough yet", never fabricated.
export async function getInsight() {
  const res = await apiFetch("/mirror/insight");
  if (!res.ok) return null;
  return res.json();
}

export async function getWeeklyMemory() {
  const res = await apiFetch("/mirror/weekly-memory");
  if (!res.ok) return null;
  return res.json();
}

// ── Shared emotion vocabulary (B2.10 / P2-9) ──
// The canonical vocabulary, served so the client never diverges from the server.
// Public + unauthenticated; safe to call before login.
export async function getEmotionVocab() {
  return apiGet("/emotions");
}

// ── Book Search ──
export async function searchBooks(query) {
  if (!query || query.length < 2) return [];
  const res = await apiFetch(`/books/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.results || [];
}

// ── Echo — the single public surface [Phase 3 / B3.x] ──
// Design rules enforced by this contract: the feed is chronological, ENDS
// (caught_up), and carries NO counts of any kind. Never render a count/ranking.

// Chronological feed that ends. Optional anchors: a book (title[+author]) or an
// emotion. Returns { echoes, next_cursor, caught_up }. [F3.3 / B3.3]
// `mine` backs the "your echoes" view. [needs BE] GET /echoes/feed does not accept
// it yet (app/routers/echo.py takes cursor/limit/book_title/book_author/emotion/
// prompt_id) — a server that ignores the param returns the everyone-feed, so the
// caller must not present the view as filtered until the backend lands.
export async function getEchoFeed({ cursor = null, limit = 20, bookTitle = null, bookAuthor = null, emotion = null, mine = false } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set("cursor", cursor);
  if (bookTitle) params.set("book_title", bookTitle);
  if (bookAuthor) params.set("book_author", bookAuthor);
  if (emotion) params.set("emotion", emotion);
  if (mine) params.set("mine", "true");
  return apiGet(`/echoes/feed?${params.toString()}`);
}

// Publish an echo. Returns { echo, held_for_review, crisis }. `crisis` is the
// supportive interstitial payload when the self-harm classifier fires. [F3.2/F3.6]
export async function postEcho(data) {
  const res = await apiFetch("/echoes", { method: "POST", body: JSON.stringify(data) });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    const err = new Error(d.detail || "Couldn't post your echo");
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// An echo + its replies (replies come before any reaction affordance). [F3.4]
export async function getEchoThread(id) {
  const res = await apiFetch(`/echoes/${id}`);
  if (!res.ok) return null;
  return res.json();
}

export async function deleteEcho(id) {
  const res = await apiFetch(`/echoes/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Couldn't remove echo");
}

export async function postReply(echoId, body) {
  const res = await apiFetch(`/echoes/${echoId}/replies`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.detail || "Couldn't post your reply");
  }
  return res.json();
}

// Private reaction — the author's aggregate is never exposed in the feed. [B3.5]
export async function reactToEcho(echoId, kind, on = true) {
  const res = await apiFetch(`/echoes/${echoId}/react`, {
    method: "POST",
    body: JSON.stringify({ kind, on }),
  });
  if (!res.ok) throw new Error("Couldn't react");
}

export async function reportEcho(echoId, category) {
  const res = await apiFetch(`/echoes/${echoId}/report`, {
    method: "POST",
    body: JSON.stringify({ category }),
  });
  if (!res.ok) throw new Error("Couldn't submit report");
  return res.json().catch(() => ({}));
}

export async function reportReply(echoId, replyId, category) {
  const res = await apiFetch(`/echoes/${echoId}/replies/${replyId}/report`, {
    method: "POST",
    body: JSON.stringify({ category }),
  });
  if (!res.ok) throw new Error("Couldn't submit report");
  return res.json().catch(() => ({}));
}

// ── Social: block / mute (bidirectional, cross-surface, silent) [F3.5 / B3.6-7] ──
export async function blockHandle(handle) {
  const res = await apiFetch("/social/blocks", { method: "POST", body: JSON.stringify({ handle }) });
  if (!res.ok) throw new Error("Couldn't block");
}
export async function unblockHandle(handle) {
  const res = await apiFetch(`/social/blocks/${encodeURIComponent(handle)}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Couldn't unblock");
}
export async function muteHandle(handle) {
  const res = await apiFetch("/social/mutes", { method: "POST", body: JSON.stringify({ handle }) });
  if (!res.ok) throw new Error("Couldn't mute");
}
export async function unmuteHandle(handle) {
  const res = await apiFetch(`/social/mutes/${encodeURIComponent(handle)}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Couldn't unmute");
}

// Change the pseudonymous handle (rate-limited; old handle enters a grace window). [F3.1 / B3.1]
export async function changeHandle(handle) {
  const res = await apiFetch("/user/handle", { method: "PATCH", body: JSON.stringify({ handle }) });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.detail || "Couldn't change handle");
  }
  return res.json().catch(() => ({}));
}

// ── Journal — sealed blobs in, sealed blobs out [journalCryptoContract.md] ──
// Every function below moves ciphertext it cannot read. Nothing here encrypts,
// decrypts, or derives: that is journalCrypto.js, and the separation is the
// point — a reviewer can read this section and confirm that no plaintext and no
// key is ever an argument to a fetch.
//
// Note the shape of what's missing: there is no searchJournal(). The server
// cannot search blobs it cannot read, so `GET /journal/entries` has no `q` and
// never will. Search is client-side, over what's already decrypted in memory.

// The wrapped key material. 404 = this account has no journal yet, which is a
// first-run state and not an error. Returns null so callers can branch on it.
export async function getJournalKeyBundle() {
  const res = await apiFetch("/journal/key");
  if (res.status === 404) return null;
  if (!res.ok) throw new ApiError(res.status, errorKind(res.status), "Couldn't load journal key");
  return res.json();
}

// One-time setup. 409 means a bundle already exists — the server refuses to
// overwrite because doing so would orphan every entry sealed under the old key.
export async function createJournalKeyBundle(bundle) {
  const res = await apiFetch("/journal/key", { method: "POST", body: JSON.stringify(bundle) });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new ApiError(res.status, errorKind(res.status), d.detail || "Couldn't set up the journal");
  }
  return res.json();
}

// Replace the bundle with a re-wrap of the same key — the path back after a
// password reset. Gated on the account password server-side so a stolen session
// alone cannot overwrite the bundle and lock the owner out of their own journal.
export async function rewrapJournalKeyBundle(bundle, currentPassword) {
  const res = await apiFetch("/journal/key", {
    method: "PUT",
    body: JSON.stringify({ ...bundle, current_password: currentPassword }),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new ApiError(res.status, errorKind(res.status), d.detail || "Couldn't re-wrap the journal key");
  }
  return res.json();
}

// One page of sealed entries, newest day first.
export async function getJournalEntries({ cursor = null, limit = 50, dateFrom = null, dateTo = null, emotion = null, untagged = null } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set("cursor", cursor);
  if (dateFrom) params.set("date_from", dateFrom);
  if (dateTo) params.set("date_to", dateTo);
  if (emotion) params.set("emotion", emotion);
  if (untagged !== null) params.set("untagged", String(untagged));
  return apiGet(`/journal/entries?${params.toString()}`);
}

// Walk the cursor to the end. Client-side search has no other option: filtering
// happens after decryption, so the client needs the pages it intends to search.
export async function getAllJournalEntries({ pageSize = 100, maxPages = 200 } = {}) {
  const all = [];
  let cursor = null;
  let total = 0;
  for (let i = 0; i < maxPages; i++) {
    const data = await getJournalEntries({ cursor, limit: pageSize });
    all.push(...(data.entries || []));
    total = typeof data.total === "number" ? data.total : all.length;
    if (!data.has_more || !data.next_cursor) break;
    cursor = data.next_cursor;
  }
  return { entries: all, total };
}

// `data` is { entry_date, ciphertext, nonce, key_version, emotions } — the only
// readable fields are the date and the tags, and both are readable by design
// (contract §2).
export async function createJournalEntry(data) {
  const res = await apiFetch("/journal/entries", { method: "POST", body: JSON.stringify(data) });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new ApiError(res.status, errorKind(res.status), d.detail || "Couldn't save this page");
  }
  return res.json();
}

// ciphertext and nonce travel together or not at all — re-encrypting always
// produces a new nonce, and the schema rejects a half-update that would let a
// client walk itself into nonce reuse.
export async function updateJournalEntry(id, data) {
  const res = await apiFetch(`/journal/entries/${id}`, { method: "PUT", body: JSON.stringify(data) });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new ApiError(res.status, errorKind(res.status), d.detail || "Couldn't save this page");
  }
  return res.json();
}

// Name a day without touching its ciphertext — no decrypt/re-encrypt round trip
// to tag a page, which is what makes batch-tagging-later cheap enough to offer.
export async function setJournalEntryTags(id, emotions) {
  const res = await apiFetch(`/journal/entries/${id}/tags`, {
    method: "PUT",
    body: JSON.stringify({ emotions }),
  });
  if (!res.ok) throw new ApiError(res.status, errorKind(res.status), "Couldn't save these tags");
  return res.json();
}

export async function deleteJournalEntry(id) {
  const res = await apiFetch(`/journal/entries/${id}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) {
    throw new ApiError(res.status, errorKind(res.status), "Couldn't delete this page");
  }
}

// ── Notifications — calm, batched, digest-default [Phase 4 / B4.x] ──
// GET → { notifications: [{ id, tier, kind, payload, read, created_at }], unread_count }.
// Tiers: 0 security · 1 direct-batched (e.g. echo_reply) · 2 weekly digest.
export async function getNotifications() {
  const res = await apiFetch("/notifications");
  if (!res.ok) return { notifications: [], unread_count: 0 };
  return res.json();
}

// Mark read in bulk. Pass an array of ids, or null/omit to mark ALL read.
export async function markNotificationsRead(ids = null) {
  const res = await apiFetch("/notifications/read", {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) throw new Error("Couldn't update notifications");
}

export async function getNotificationPrefs() {
  const res = await apiFetch("/notifications/preferences");
  if (!res.ok) return null;
  return res.json();
}

export async function updateNotificationPrefs(data) {
  const res = await apiFetch("/notifications/preferences", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.detail || "Couldn't update preferences");
  }
  return res.json();
}

// ── Resonance — the quiet one-to-one surface [app/routers/resonance.py] ──
//
// Every payload here is anonymised by the server: a match is a book, some shared
// emotions, and a strength. There is no user_id field, and `handle` stays null
// until BOTH sides have said yes. Nothing in this section counts anything about
// anyone else — `reaches_left_today` is the reader's own daily budget and is the
// single number the whole feature exposes.
//
// Do not add a "how many people matched this book" call here. The backend has no
// such endpoint on purpose (app/models/resonance.py).

// → { matches: [MatchResponse], reaches_left_today }
// Declined/expired matches are already gone server-side, so an absent card is
// the only signal a decline ever produces — neither side is told.
export async function getResonanceMatches() {
  return apiGet("/resonance/matches");
}

// Leave the opening note. `suggested` → `pending` (or straight to `connected`
// if the other reader had already reached out — a mutual reach IS the accept).
// The note is sealed: they cannot read it until they answer.
export async function reachOut(matchId, note) {
  const res = await apiFetch(`/resonance/${matchId}/reach`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new ApiError(res.status, errorKind(res.status), d.detail || "Couldn't leave your note");
  }
  return res.json();
}

// Answer a note (accept, with an optional note of your own) or let it pass.
// Declining is silent and final — the server never tells the other side, so the
// UI must not either.
export async function respondToMatch(matchId, accept, note = null) {
  const res = await apiFetch(`/resonance/${matchId}/respond`, {
    method: "POST",
    body: JSON.stringify({ accept, note }),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new ApiError(res.status, errorKind(res.status), d.detail || "Couldn't send that");
  }
  return res.json();
}

// ── Threads — the conversation that exists once both readers said yes ──
// Plain messaging. No read receipts, no typing state, no presence: the backend
// serves none of it and this feature is meant to read like letters.

// A page of the transcript, oldest-first. → { messages, next_before }.
// `before` pages BACKWARD from a timestamp (keyset, not offset).
export async function getThreadMessages(threadId, { before = null, limit = 50 } = {}) {
  const params = new URLSearchParams();
  if (before) params.set("before", before);
  params.set("limit", String(limit));
  return apiGet(`/threads/${threadId}/messages?${params.toString()}`);
}

export async function sendThreadMessage(threadId, body) {
  const res = await apiFetch(`/threads/${threadId}/messages`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new ApiError(res.status, errorKind(res.status), d.detail || "Couldn't send that");
  }
  return res.json();
}

// Block: closes the conversation, declines the match, and hides both readers
// from each other everywhere else too. Silent — 204, no body.
export async function blockThread(threadId) {
  const res = await apiFetch(`/threads/${threadId}/block`, { method: "POST" });
  if (!res.ok) throw new ApiError(res.status, errorKind(res.status), "Couldn't block");
}

// Report the whole thread (no message id needed), blocking by default.
export async function reportThread(threadId, category, block = true) {
  const res = await apiFetch(`/threads/${threadId}/report`, {
    method: "POST",
    body: JSON.stringify({ category, block }),
  });
  if (!res.ok) throw new ApiError(res.status, errorKind(res.status), "Couldn't file that report");
  return res.json().catch(() => ({ status: "received" }));
}

// ── Admin: moderation ──
// Only the moderation calls live here. The rest of AdminPage builds its URLs
// inline; that's pre-existing and not worth churning, but these two carry a
// request shape worth having one definition of.

// Open reports grouped by target, most-reported first. Each row carries a body
// preview and the target's live status — threads carry participants and a
// message count instead, never the transcript.
export async function getModerationQueue() {
  return apiGet("/admin/moderation/queue");
}

// action: "remove" takes the target down · "dismiss" clears the reports and
// restores a held item · "clear" closes reports whose target is already gone.
export async function resolveReport(targetType, targetId, action) {
  const res = await apiFetch("/admin/moderation/resolve", {
    method: "POST",
    body: JSON.stringify({ target_type: targetType, target_id: targetId, action }),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new ApiError(res.status, errorKind(res.status), d.detail || "Couldn't resolve that report");
  }
  return res.json();
}
