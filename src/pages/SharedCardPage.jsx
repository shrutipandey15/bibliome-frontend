import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getSharedDNA } from "../services/api";
import { useHead } from "../hooks/useHead";
import DNACard from "../components/DNACard";
import { displayName } from "../components/card/cardModel";
import "./SharedCardPage.css";

/**
 * /s/:token — someone's reading DNA card, opened from a link they shared.
 *
 * Shows the card with the reader's own switches applied (the backend applies
 * them) and one action, "Find yours", which carries a `via=card` marker into
 * sign-up. The marker is counted into a daily total and never tied to the
 * reader who shared the card. Nothing else of their profile is here.
 *
 * The link-preview tags for this URL are written by the backend before React
 * runs (app/routers/og.py); this page only sets the tab title and noindex.
 */
export default function SharedCardPage() {
  const { token } = useParams();
  const { user } = useAuth();
  const [card, setCard] = useState(undefined);

  // A share link is for the people it was sent to, not for search. robots.txt
  // already disallows /s/; noindex keeps out any crawler that fetches anyway.
  const name = card?.archetype?.name;
  useHead({
    robots: "noindex, nofollow",
    title: name ? `${card.handle ? `@${card.handle}` : "A reader"} reads like ${card.archetype.article || "a"} ${displayName(name)} — Bibliome` : "A reader's DNA — Bibliome",
  });

  useEffect(() => {
    let alive = true;
    setCard(undefined);
    getSharedDNA(token)
      .then((data) => alive && setCard(data))
      .catch(() => alive && setCard(null));
    return () => { alive = false; };
  }, [token]);

  if (card === undefined) {
    return (
      <div className="loading-screen">
        <div className="loading-glyph">◈</div>
        <div className="loading-text">Opening the card…</div>
      </div>
    );
  }

  return (
    <div className="shared-page">
      <header className="shared-head">
        <Link to="/" className="shared-brand"><span className="rr-logo">Biblio<em>me</em></span></Link>
      </header>
      <main className="shared-main">
        {card?.archetype ? (
          <>
            <p className="shared-lead">
              {card.handle ? `@${card.handle}` : "A reader"} shared their reading DNA.
            </p>
            <DNACard card={card} headingLevel={1} />
            <div className="shared-cta">
              <p>What does your reading say about you?</p>
              {user ? (
                <Link className="shared-find" to="/">See yours</Link>
              ) : (
                <Link className="shared-find" to="/login?mode=register&via=card">Find yours</Link>
              )}
            </div>
          </>
        ) : (
          // Two different nulls behind one screen: a link that was turned off (or
          // whose reader left), and a live link whose reader's DNA isn't ready.
          <div className="shared-gone">
            <h1>This card isn't available</h1>
            <p>The link was turned off, or this reader's DNA isn't ready yet.</p>
            <Link className="shared-find" to={user ? "/" : "/login?mode=register&via=card"}>
              {user ? "Back to your shelf" : "Find yours"}
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
