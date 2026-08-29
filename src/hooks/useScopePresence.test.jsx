import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";

let emit = null;
const enterScope = vi.fn();
const leaveScope = vi.fn();
const sendTyping = vi.fn();

vi.mock("../services/realtime", () => ({
  onRealtime: (fn) => { emit = fn; return () => { emit = null; }; },
  enterScope: (...a) => enterScope(...a),
  leaveScope: (...a) => leaveScope(...a),
  sendTyping: (...a) => sendTyping(...a),
}));

import useScopePresence from "./useScopePresence";

describe("useScopePresence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    emit = null;
  });

  it("enters on mount and leaves on unmount", () => {
    const { unmount } = renderHook(() => useScopePresence("collection:c1"));
    expect(enterScope).toHaveBeenCalledWith("collection:c1");
    unmount();
    expect(leaveScope).toHaveBeenCalledWith("collection:c1");
  });

  it("tracks a presence roster and per-user enter/leave, ignoring other scopes", () => {
    const { result } = renderHook(() => useScopePresence("collection:c1"));

    act(() => emit({ type: "presence_roster", scope: "collection:c1", present: ["mara"] }));
    expect([...result.current.present]).toEqual(["mara"]);

    act(() => emit({ type: "presence", scope: "collection:c1", user: "priya", present: true }));
    expect(new Set(result.current.present)).toEqual(new Set(["mara", "priya"]));

    act(() => emit({ type: "presence", scope: "other:x", user: "zed", present: true }));
    expect(result.current.present.has("zed")).toBe(false);

    act(() => emit({ type: "presence", scope: "collection:c1", user: "mara", present: false }));
    expect([...result.current.present]).toEqual(["priya"]);
  });

  it("shows a typing user then clears them after the timeout", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useScopePresence("thread:t1"));

    act(() => emit({ type: "typing", scope: "thread:t1", user: "quiet_reader" }));
    expect(result.current.typing.has("quiet_reader")).toBe(true);

    act(() => vi.advanceTimersByTime(7000));
    expect(result.current.typing.has("quiet_reader")).toBe(false);
  });

  it("notifyTyping forwards to the service for the current scope", () => {
    const { result } = renderHook(() => useScopePresence("thread:t1"));
    act(() => result.current.notifyTyping());
    expect(sendTyping).toHaveBeenCalledWith("thread:t1");
  });
});
