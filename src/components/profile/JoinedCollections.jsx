import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getJoinedCollections } from "../../services/api";
import "./JoinedCollections.css";

/**
 * Collections someone else owns that you've joined [#5/#6].
 *
 * This exists because without it a member had nowhere to go. The profile lists
 * collections where `collections.user_id` is you, so accepting an invite put a
 * row in the database and changed nothing a reader could see — they had joined a
 * room with no door. The invite flow even returned them to their own study,
 * which showed them nothing.
 *
 * Renders nothing at all when you have joined none, rather than an empty state:
 * a reader who has never been invited to anything should not be told about a
 * feature by an empty box.
 */
export default function JoinedCollections() {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    let live = true;
    getJoinedCollections()
      .then((r) => { if (live) setRows(r); })
      .catch(() => { if (live) setRows([]); });
    return () => { live = false; };
  }, []);

  if (!rows || rows.length === 0) return null;

  return (
    <div className="jc">
      {rows.map((c) => (
        <div key={c.id} className="jc-card">
          <div className="jc-card-head">
            <span className="jc-title">{c.title}</span>
            {c.owner_handle && <span className="jc-owner">@{c.owner_handle}</span>}
          </div>
          {c.description && <p className="jc-desc">{c.description}</p>}
          <div className="jc-meta">
            {c.book_count === 1 ? "1 book" : `${c.book_count} books`}
            {" · "}
            {c.member_count === 1 ? "1 reader" : `${c.member_count} readers`}
          </div>
          {/* The discussion IS the way in for a member: they cannot edit someone
              else's shelf, so a link to the drawer would be a dead end. */}
          <Link
            className="jc-open"
            to={`/collections/${c.id}/discussion`}
            state={{ title: c.title }}
          >
            Open discussion →
          </Link>
        </div>
      ))}
    </div>
  );
}
