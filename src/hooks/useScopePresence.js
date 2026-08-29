import { useEffect, useRef, useState, useCallback } from "react";
import { onRealtime, enterScope, leaveScope, sendTyping } from "../services/realtime";

const TYPING_CLEAR_MS = 6000; // drop a "typing" handle this long after the last signal

/**
 * Presence and typing for one conversation scope ("collection:<id>" or
 * "thread:<id>").
 *
 * Enters the scope on mount, leaves on unmount. Returns:
 *   present     Set<handle> — other people currently viewing this scope
 *   typing      Set<handle> — other people typing right now (auto-expires)
 *   notifyTyping()          — call on every keystroke; throttled downstream
 *
 * The server never echoes your own handle back, so both sets are "other people"
 * only. Everything degrades to empty sets when the socket is down.
 */
export default function useScopePresence(scope) {
  const [present, setPresent] = useState(() => new Set());
  const [typing, setTyping] = useState(() => new Set());
  const typingTimers = useRef(new Map());

  useEffect(() => {
    if (!scope) return undefined;

    const timers = typingTimers.current;
    enterScope(scope);

    const off = onRealtime((ev) => {
      if (ev.scope !== scope) return;

      if (ev.type === "presence_roster") {
        setPresent(new Set(ev.present || []));
      } else if (ev.type === "presence") {
        setPresent((prev) => {
          const next = new Set(prev);
          if (ev.present) next.add(ev.user);
          else next.delete(ev.user);
          return next;
        });
      } else if (ev.type === "typing" && ev.user) {
        setTyping((prev) => (prev.has(ev.user) ? prev : new Set(prev).add(ev.user)));
        clearTimeout(timers.get(ev.user));
        timers.set(ev.user, setTimeout(() => {
          setTyping((prev) => {
            const next = new Set(prev);
            next.delete(ev.user);
            return next;
          });
          timers.delete(ev.user);
        }, TYPING_CLEAR_MS));
      }
    });

    return () => {
      off();
      leaveScope(scope);
      timers.forEach(clearTimeout);
      timers.clear();
      setPresent(new Set());
      setTyping(new Set());
    };
  }, [scope]);

  const notifyTyping = useCallback(() => { if (scope) sendTyping(scope); }, [scope]);

  return { present, typing, notifyTyping };
}
