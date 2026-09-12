import { useState } from "react";
import { isRealtimeConnected } from "../services/realtime";
import useRealtimeEvent from "./useRealtimeEvent";

/**
 * Whether the shared realtime socket is currently up. Every chat surface has
 * its own poll fallback, so a drop is never fatal — but it should never be
 * silent either.
 */
export default function useRealtimeStatus() {
  const [connected, setConnected] = useState(isRealtimeConnected);
  useRealtimeEvent(
    (ev) => ev.type === "__status",
    (ev) => setConnected(ev.connected),
  );
  return connected;
}
