import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import DNACard from "../components/DNACard";
import { cardArchetype } from "../services/dnaCard";
import { EMOTIONS } from "../services/emotions";
import { getProfileByHandle } from "../services/api";
import "./ProfilePage.css";

/**
 * Another reader's profile — read-only. [F2.8 / §Feature 2]
 *
 * Reads the visibility + block aware `/profile/{handle}` (NOT the old
 * `/public/*` surface, which leaked private data and rendered counts). The
 * server decides what this viewer may see:
 *   - null (404)      → blocked / unknown / private-to-stranger → "not found"
 *   - { restricted }  → minimal identity card, no data
 *   - full profile    → identity + signature + Now + collections + history
 * No counts are rendered anywhere — identity through reading, not metrics.
 */
function BookCard({ book }) {
  const emo = book.dominant_emotion ? EMOTIONS[book.dominant_emotion] : null;
  return (
    <div className="pf-book" style={{ borderColor: emo?.color || "var(--rule)" }}>
      {book.cover_url ? (
        <img className="pf-book-cover" src={book.cover_url} alt="" loading="lazy" onError={(e) => { e.target.style.visibility = "hidden"; }} />
      ) : (
        <div className="pf-book-cover pf-book-cover--none" style={{ background: emo?.color || "var(--ink-quiet)" }} />
      )}
      <div className="pf-book-meta">
        <div className="pf-book-title">{book.title}</div>
        {book.author && <div className="pf-book-author">{book.author}</div>}
      </div>
    </div>
  );
}

export default function PublicProfile() {
  const { username } = useParams(); // route param; treated as a handle
  const [profile, setProfile] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | notfound | ok

  useEffect(() => {
    let alive = true;
    setStatus("loading");
    getProfileByHandle(username).then((p) => {
      if (!alive) return;
      if (!p) { setStatus("notfound"); return; }
      setProfile(p);
      setStatus("ok");
    });
    return () => { alive = false; };
  }, [username]);

  if (status === "loading") {
    return <div className="loading-screen"><div className="loading-glyph">◈</div><div className="loading-text">finding @{username}…</div></div>;
  }

  if (status === "notfound") {
    // Blocked profiles are indistinguishable from non-existent ones, by design.
    return (
      <div className="pf-page">
        <div className="empty-state" style={{ minHeight: "70vh" }}>
          <div className="empty-glyph">?</div>
          <div className="empty-title">No such profile</div>
          <div className="empty-sub">It may be private, or it may not exist.</div>
          <Link to="/" className="btn" style={{ marginTop: 16 }}>go home</Link>
        </div>
      </div>
    );
  }

  const nowReading = profile.now_reading || [];
  const recent = profile.recent || [];
  const collections = profile.collections || [];
  // Milestones now carry what's still ahead as well as what's been reached. A
  // stranger sees only the reached ones — the study is where you look at your
  // own unfinished business. (Payloads written before the flag existed have no
  // `achieved`; those were all reached.)
  const milestones = (profile.milestones || []).filter((m) => m.achieved !== false);

  return (
    <div className="pf-page">
      <div className="pf-header">
        <Link to="/" className="btn ghost" style={{ fontSize: 12 }}>← home</Link>
        <div className="label">· a reader ·</div>
      </div>

      <section className="pf-identity">
        <h1 className="pf-name">{profile.display_name || `@${profile.handle}`}</h1>
        <div className="pf-handle">@{profile.handle}</div>
        {profile.personality_type && <div className="pf-disposition">{profile.personality_type}</div>}
        {profile.bio && <p className="pf-bio-text" style={{ marginTop: 10 }}>{profile.bio}</p>}
      </section>

      {profile.restricted ? (
        <section className="pf-section">
          <div className="empty-state">
            <div className="empty-glyph">◐</div>
            <div className="empty-title">This profile is private</div>
            <div className="empty-sub">Only the reader can see what's on their shelf.</div>
          </div>
        </section>
      ) : (
        <>
          {nowReading.length > 0 && (
            <section className="pf-section">
              <div className="label pf-section-label">now reading</div>
              <div className="pf-books">{nowReading.map((b) => <BookCard key={b.entry_id} book={b} />)}</div>
            </section>
          )}

          {cardArchetype(profile.signature) && (
            <section className="pf-section">
              <div className="label pf-section-label">their signature</div>
              <div className="pf-signature">
                <DNACard profile={profile.signature} username={profile.handle} allowShare={false} />
              </div>
            </section>
          )}

          {collections.map((c) => (
            <section className="pf-section" key={c.id}>
              <div className="label pf-section-label">{c.title}</div>
              {c.description && <p className="pf-bio-text" style={{ marginBottom: 12 }}>{c.description}</p>}
              {c.books?.length > 0
                ? <div className="pf-books">{c.books.map((b) => <BookCard key={b.entry_id} book={b} />)}</div>
                : <div className="pf-bio-empty">Empty collection.</div>}
            </section>
          ))}

          {recent.length > 0 && (
            <section className="pf-section">
              <div className="label pf-section-label">recently shelved</div>
              <div className="pf-books">{recent.map((b) => <BookCard key={b.entry_id} book={b} />)}</div>
            </section>
          )}

          {milestones.length > 0 && (
            <section className="pf-section">
              <div className="label pf-section-label">milestones</div>
              <ul className="pf-milestones">
                {milestones.map((m) => (
                  <li key={m.kind} className="pf-milestone"><span className="pf-milestone-glyph" aria-hidden="true">✦</span>{m.label}</li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
