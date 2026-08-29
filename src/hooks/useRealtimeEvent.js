import { useEffect, useRef } from "react";
import { onRealtime } from "../services/realtime";

/**
 * Run `handler` when a realtime event matches `filter`.
 *
 * `filter` is a kind/type string, an array of them, or a predicate `(ev) => bool`.
 * The handler is read through a ref, so it can change identity every render
 * without re-subscribing.
 *
 * Internal `__status` events (connect/disconnect) are never matched by a string
 * or array filter — pass a predicate if you want them.
 */
export default function useRealtimeEvent(filter, handler) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  const key = typeof filter === "function"
    ? "fn"
    : (Array.isArray(filter) ? filter.join(",") : String(filter));

  useEffect(() => {
    const matches = (ev) => {
      if (typeof filter === "function") return filter(ev);
      if (ev.type === "__status") return false;
      const wanted = Array.isArray(filter) ? filter : [filter];
      return wanted.includes(ev.type) || wanted.includes(ev.kind);
    };
    return onRealtime((ev) => {
      if (matches(ev)) handlerRef.current(ev);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
