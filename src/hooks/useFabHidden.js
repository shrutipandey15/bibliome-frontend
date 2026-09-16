import { useState, useEffect } from "react";

/**
 * The FAB gets out of the way while you're reading down the page and comes
 * back the moment you scroll up. Most of what it floats over is prose, and a
 * button parked over the middle of a sentence is worse than one you have to
 * flick to recover.
 *
 * Extracted out of App.jsx so every page's FAB (Shelf, Echo, ...) shares the
 * exact same scroll behaviour rather than each page re-deriving its own —
 * that drift is exactly how Echo's FAB ended up not hiding at all.
 */
export default function useFabHidden() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let last = window.scrollY;
    let queued = false;
    let idleTimer;
    // A finger lifted mid-page leaves the FAB hidden with no more scroll events
    // coming to bring it back — scrolling up is the only documented way out, and
    // on a long page a reader can sit still without ever doing that. So idling
    // after a downward scroll counts as "done reading past it" too.
    //
    // The timer restarts on every scroll frame, so it only begins once momentum
    // has actually stopped — which is why it can be short. It was 900ms, and on
    // top of the button's own .24s slide that left more than a second of empty
    // corner after the page came to rest: long enough to read as broken rather
    // than as deference. This is the pause before it returns, not the return.
    const IDLE_REVEAL_MS = 300;
    const scheduleIdleReveal = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => setHidden(false), IDLE_REVEAL_MS);
    };
    const onScroll = () => {
      if (queued) return;
      queued = true;
      // rAF-coalesced: scroll fires far faster than we can usefully react to.
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const dy = y - last;
        // Near the top there is nothing to read past yet, so the button stays.
        // The 6px threshold ignores jitter and iOS rubber-banding, which would
        // otherwise flicker the FAB at the ends of the page.
        if (y <= 120) setHidden(false);
        else if (Math.abs(dy) > 6) setHidden(dy > 0);
        last = y;
        queued = false;
        scheduleIdleReveal();
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      clearTimeout(idleTimer);
    };
  }, []);

  return hidden;
}
