import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getResonanceMatches } from "../../services/api";
import { hasUnseen, hasLive } from "./signal";
import "./ResonanceMark.css";

/**
 * The entry point to Resonance: a small brass mark in the header that is simply
 * ABSENT until something is waiting. [F: quiet entry point]
 *
 * Not a badge. It carries no number, no colour escalation, no animation loop —
 * it fades in once and sits there. A reader who has nothing waiting has no idea
 * this control exists, which is the intended amount of pressure: none.
 *
 * Rendering nothing (rather than a greyed-out mark) is load-bearing. A permanent
 * affordance that lights up is a notification badge with extra steps, and it
 * teaches the reader to check.
 */
export default function ResonanceMark() {
  const navigate = useNavigate();
  // null = nothing to show at all · "new" = something is waiting · "live" = no
  // news, but there's an open conversation to get back to.
  const [state, setState] = useState(null);

  useEffect(() => {
    let alive = true;
    // Best-effort and silent: if this fails the mark simply doesn't appear.
    // Failing to surface a suggestion is a much smaller harm than an error toast
    // about a feature the reader didn't ask about.
    getResonanceMatches()
      .then((data) => {
        if (!alive) return;
        const matches = data?.matches || [];
        setState(hasUnseen(matches) ? "new" : hasLive(matches) ? "live" : null);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (!state) return null;

  const isNew = state === "new";
  return (
    <button
      className={`res-mark ${isNew ? "is-new" : "is-live"}`}
      onClick={() => navigate("/resonance")}
      title={isNew ? "Someone read it the way you did" : "Your open letters"}
      aria-label={isNew ? "Resonance — someone read it the way you did" : "Resonance — your open letters"}
    >
      <span className="res-mark-glyph" aria-hidden="true">❋</span>
    </button>
  );
}
