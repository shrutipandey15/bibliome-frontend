import { useEffect, useState } from "react";
import { previewDigests } from "../services/api";
import { DigestView } from "../pages/DigestPage";
import "../pages/DigestPage.css";

/**
 * Admin: this week's digest for the most recent readers, exactly as the digest
 * page draws it, at phone width. Built on the server and thrown away — nothing
 * is delivered or saved. Unwritten copy shows as TODO(shruti) in place.
 */
export default function DigestPreview() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    previewDigests(10).then(setData).catch((e) => setError(e.kind || "error"));
  }, []);

  if (error) return <div className="admin-section">Couldn't build the preview ({error}).</div>;
  if (!data) return <div className="admin-section">Building this week's digests…</div>;
  return (
    <div className="admin-section">
      <p className="dg-quiet">Book news (anniversaries, birthdays, views) shows only what's already been looked up; new lookups happen when digests are sent.</p>
      {data.missing_copy.length > 0 && (
        <p>{data.missing_copy.length} piece(s) of copy still unwritten in digest_copy.py — nothing is delivered until they are.</p>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
        {data.readers.map(({ username, due_at, digest }) => (
          <div key={username}>
            <div className="label-sm">{username} · due {new Date(due_at).toLocaleString()}</div>
            {digest.skipped
              ? <p className="dg-quiet">Rest week: nothing sent.</p>
              : (
                <div className="dg-preview-frame">
                  <p className="dg-quiet" style={{ marginTop: 12 }}>
                    Notification: <strong>{digest.subject}</strong> — {digest.sections[0].tease.split("\n")[0]}
                  </p>
                  <DigestView digest={digest} period={digest.period} preview />
                </div>
              )}
          </div>
        ))}
      </div>
    </div>
  );
}
