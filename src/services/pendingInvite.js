// An invite link opened while signed out parks its token here, so signing in
// lands the reader back on the invitation instead of dumping them on their own
// shelf with no idea what they clicked. [#5]
//
// Its own module rather than a constant exported from App: JoinCollectionPage is
// lazy-imported BY App, and importing back from it is a cycle waiting to bite.
//
// sessionStorage, not localStorage — a half-finished invite should not outlive
// the tab. Every access is guarded: storage can be unavailable (private mode,
// blocked cookies) and an invite is never worth crashing the page over.

const KEY = "bibliome_pending_invite";

export function stashInvite(token) {
  try { sessionStorage.setItem(KEY, token); } catch { /* storage unavailable */ }
}

/** Read and clear in one step — a parked invite is consumed exactly once. */
export function takeInvite() {
  try {
    const token = sessionStorage.getItem(KEY);
    if (token) sessionStorage.removeItem(KEY);
    return token;
  } catch {
    return null;
  }
}
