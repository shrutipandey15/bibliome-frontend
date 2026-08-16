import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { peekCollectionInvite, joinCollection } from "../services/api";
import { stashInvite } from "../services/pendingInvite";
import "./JoinCollectionPage.css";

/**
 * What an invite link opens [#5].
 *
 * It PEEKS before it joins. Landing on a link and being silently added to
 * something you haven't seen is the wrong shape for a private reading app — the
 * page names the collection, says how many readers and books are in it, and then
 * asks. Joining is always a deliberate tap.
 */
export default function JoinCollectionPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [state, setState] = useState("loading"); // loading|ready|dead|joining|done
  const [peek, setPeek] = useState(null);
  const [error, setError] = useState(null);
  const [alreadyIn, setAlreadyIn] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      const found = await peekCollectionInvite(token);
      if (!live) return;
      if (!found) { setState("dead"); return; }
      setPeek(found);
      setAlreadyIn(found.already_member);
      setState("ready");
    })();
    return () => { live = false; };
  }, [token]);

  const join = async () => {
    setState("joining");
    try {
      const res = await joinCollection(token);
      // `joined: false` means they were already a member — not an error, and
      // not something to congratulate them for either.
      setAlreadyIn(!res.joined);
      setState("done");
      setTimeout(() => navigate("/me"), 1200);
    } catch (e) {
      setError(e.message);
      setState("dead");
    }
  };

  if (state === "loading") {
    return (
      <div className="join-page">
        <div className="join-card join-card--quiet">Checking that link…</div>
      </div>
    );
  }

  if (state === "dead") {
    return (
      <div className="join-page">
        <div className="join-card">
          <div className="join-glyph">◈</div>
          <h1 className="join-title">This link isn’t live</h1>
          <p className="join-sub">
            {error || "It may have expired, been used up, or been revoked. Ask whoever shared it for a new one."}
          </p>
          <Link to="/" className="btn ghost">Go to my shelf</Link>
        </div>
      </div>
    );
  }

  // Signed out: name the collection anyway, park the token, and send them to
  // sign in. AuthedLayout picks the token back up and returns them here, so the
  // invitation survives the round trip.
  if (!user) {
    return (
      <div className="join-page">
        <div className="join-card">
          <div className="join-kicker">You’ve been invited to</div>
          <h1 className="join-title">{peek.title}</h1>
          <p className="join-facts">
            {peek.member_count === 1 ? "1 reader" : `${peek.member_count} readers`}
            {" · "}
            {peek.book_count === 1 ? "1 book" : `${peek.book_count} books`}
          </p>
          <Link
            className="btn brass"
            to="/login"
            onClick={() => stashInvite(token)}
          >
            Sign in to join
          </Link>
          <p className="join-quiet">We’ll bring you straight back here.</p>
        </div>
      </div>
    );
  }

  if (state === "done") {
    return (
      <div className="join-page">
        <div className="join-card">
          <h1 className="join-title">{peek.title}</h1>
          <p className="join-sub">
            {alreadyIn ? "You’re already in this one." : "You’re in."}
          </p>
          <p className="join-quiet">Taking you to your collections…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="join-page">
      <div className="join-card">
        <div className="join-kicker">You’ve been invited to</div>
        <h1 className="join-title">{peek.title}</h1>
        {peek.description && <p className="join-desc">{peek.description}</p>}

        {/* Real counts, so nobody joins something blind. */}
        <p className="join-facts">
          {peek.member_count === 1 ? "1 reader" : `${peek.member_count} readers`}
          {" · "}
          {peek.book_count === 1 ? "1 book" : `${peek.book_count} books`}
        </p>

        {alreadyIn ? (
          <>
            <p className="join-sub">You’re already in this collection.</p>
            <Link to="/me" className="btn ghost">Open it</Link>
          </>
        ) : (
          <>
            <button
              className="btn brass"
              disabled={state === "joining"}
              onClick={join}
            >
              {state === "joining" ? "joining…" : "Join this collection"}
            </button>
            <p className="join-quiet">
              Joining lets you add books to it and see what everyone else added.
              Your own shelf and DNA stay private.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
