import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../contexts/AuthContext";
import {
  createCollectionInvite,
  revokeCollectionInvite,
  getCollectionMembers,
  leaveCollection,
} from "../../services/api";
import "./CollectionSharing.css";

/**
 * Sharing controls for a collection [#5] — who is in it, and the link that lets
 * more people in.
 *
 * The invite token is returned by the server ONCE and never again; only its hash
 * is stored. So the link is held in local state and shown until dismissed, and
 * the copy says so. Anything that re-renders it away has lost it for good, which
 * is why nothing here refetches invites — there is nothing to refetch.
 */
export default function CollectionSharing({ collection, onLeft }) {
  // Read the viewer from auth rather than taking a prop: the profile payload
  // does not carry a user id, and threading one down through two components to
  // answer "is this me?" invites the two sources disagreeing.
  const { user } = useAuth();
  const currentUserId = user?.id;

  const [members, setMembers] = useState([]);
  const [link, setLink] = useState(null);      // { id, url } — shown once
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Ownership comes from the membership list, which is the server's own answer.
  // Until it loads nobody is treated as owner, so the invite controls appear
  // only once we actually know.
  const isOwner = members.find((m) => m.user_id === currentUserId)?.role === "owner";

  const load = useCallback(async () => {
    setMembers(await getCollectionMembers(collection.id));
  }, [collection.id]);

  useEffect(() => { load(); }, [load]);

  const mint = async () => {
    setBusy(true); setError(null); setCopied(false);
    try {
      const invite = await createCollectionInvite(collection.id);
      setLink({ id: invite.id, url: inviteUrl(invite.token) });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
    } catch {
      // Clipboard can be blocked; the input below is selectable either way.
      setError("Couldn't copy — select the link and copy it manually.");
    }
  };

  const revoke = async () => {
    setBusy(true);
    try {
      await revokeCollectionInvite(collection.id, link.id);
      setLink(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    setBusy(true);
    try {
      await leaveCollection(collection.id, currentUserId);
      onLeft?.();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <section className="col-share">
      <h4 className="col-share-title">
        Shared with
        <span className="col-share-count">
          {members.length === 1 ? "just you" : `${members.length} readers`}
        </span>
      </h4>

      <ul className="col-share-members">
        {members.map((m) => (
          <li key={m.user_id} className="col-share-member">
            <span className="col-share-handle">
              {m.handle ? `@${m.handle}` : "a reader"}
              {m.user_id === currentUserId && <em> (you)</em>}
            </span>
            {m.role === "owner" && <span className="col-share-role">owner</span>}
          </li>
        ))}
      </ul>

      {isOwner ? (
        <div className="col-share-invite">
          {link ? (
            <>
              {/* Shown once. The server stores only a hash, so this cannot be
                  read back — say so rather than letting someone assume they can
                  find it again later. */}
              <label className="col-share-label" htmlFor="col-invite-url">
                Anyone with this link can join. It won’t be shown again.
              </label>
              <div className="col-share-linkrow">
                <input
                  id="col-invite-url"
                  className="col-share-url"
                  readOnly
                  value={link.url}
                  onFocus={(e) => e.target.select()}
                />
                <button className="btn brass" onClick={copy}>
                  {copied ? "copied" : "copy"}
                </button>
              </div>
              <div className="col-share-linkfoot">
                <button className="col-share-plain" disabled={busy} onClick={revoke}>
                  revoke this link
                </button>
                <span className="col-share-hint">
                  Revoking closes the door. People who already joined stay.
                </span>
              </div>
            </>
          ) : (
            <button className="btn ghost" disabled={busy} onClick={mint}>
              + create an invite link
            </button>
          )}
        </div>
      ) : (
        <button className="col-share-plain" disabled={busy} onClick={leave}>
          leave this collection
        </button>
      )}

      {error && <p className="col-share-error" role="alert">{error}</p>}
    </section>
  );
}

// The join route lives on the same origin as the app, so a shared link opens
// Bibliome rather than the API.
export function inviteUrl(token) {
  return `${window.location.origin}/collections/join/${token}`;
}
