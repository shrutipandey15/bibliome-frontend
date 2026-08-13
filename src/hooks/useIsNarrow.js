import { useEffect, useState } from "react";

/**
 * True below the phone breakpoint.
 *
 * For the cases CSS genuinely cannot reach — where mobile needs DIFFERENT DOM
 * rather than different styling. Reach for a media query first; this exists for
 * things like the heatmap, which transposes its axes on a phone and so cannot be
 * the same elements restyled.
 *
 * The 640 here is the phone tier from the breakpoint scale documented at the top
 * of styles/global.css. It is duplicated into JS on purpose — a media query
 * condition cannot read a CSS variable — so the two have to be changed together.
 *
 * jsdom does not implement `matchMedia` at all, so without the guard this throws
 * the moment any test renders a component that calls it, and the failure reads
 * like a broken harness rather than this line. Absent, we report "wide", which
 * is the safe answer: nothing gets a mobile-only substitution, and no content is
 * hidden from a test or from a browser too old to answer.
 */
const QUERY = "(max-width: 640px)";

function mediaQuery() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(QUERY)
    : null;
}

export default function useIsNarrow() {
  const [narrow, setNarrow] = useState(() => mediaQuery()?.matches ?? false);

  useEffect(() => {
    const mq = mediaQuery();
    if (!mq) return;
    // Re-read on mount as well as on change: between the initial render and the
    // effect the viewport may already have moved (rotation during load).
    setNarrow(mq.matches);
    const sync = (e) => setNarrow(e.matches);
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return narrow;
}
