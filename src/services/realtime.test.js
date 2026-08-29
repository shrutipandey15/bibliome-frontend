import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  startRealtime, stopRealtime, onRealtime, isRealtimeConnected,
  enterScope, leaveScope, sendTyping,
} from "./realtime";
import { setAccessToken } from "./api";

const sockets = () => globalThis.WebSocket.instances;

describe("realtime client [phase 1]", () => {
  beforeEach(() => {
    globalThis.WebSocket.instances = [];
    setAccessToken("test-access-token");
  });
  afterEach(() => {
    stopRealtime();
    setAccessToken(null);
  });

  it("opens one socket and sends the auth frame on connect", async () => {
    startRealtime();
    await vi.waitFor(() => expect(sockets()).toHaveLength(1));
    const ws = sockets()[0];
    expect(ws.url).toMatch(/\/realtime\/ws$/);

    ws._open();
    expect(JSON.parse(ws.sent[0])).toEqual({ type: "auth", token: "test-access-token" });
  });

  it("delivers server events to subscribers but swallows ping/ready", async () => {
    const seen = [];
    const off = onRealtime((ev) => seen.push(ev));

    startRealtime();
    await vi.waitFor(() => expect(sockets()).toHaveLength(1));
    const ws = sockets()[0];
    ws._open();

    ws._emit({ type: "ready" });
    ws._emit({ type: "ping" });
    ws._emit({ type: "notify", kind: "resonance_message" });

    expect(seen).toContainEqual({ type: "__status", connected: true });
    expect(seen).toContainEqual({ type: "notify", kind: "resonance_message" });
    expect(seen.some((e) => e.type === "ping")).toBe(false);
    expect(isRealtimeConnected()).toBe(true);
    off();
  });

  it("reconnects after the socket closes", async () => {
    startRealtime();
    await vi.waitFor(() => expect(sockets()).toHaveLength(1));
    sockets()[0]._open();
    sockets()[0].close();

    await vi.waitFor(() => expect(sockets().length).toBeGreaterThanOrEqual(2), { timeout: 3000 });
  });

  it("stopRealtime closes the socket and stops reconnecting", async () => {
    startRealtime();
    await vi.waitFor(() => expect(sockets()).toHaveLength(1));
    sockets()[0]._open();
    stopRealtime();
    expect(sockets()[0].readyState).toBe(globalThis.WebSocket.CLOSED);

    await new Promise((r) => setTimeout(r, 1200));
    expect(sockets()).toHaveLength(1); // no reconnect fired
  });

  it("sends scope_enter/leave and re-enters open scopes after a reconnect", async () => {
    startRealtime();
    await vi.waitFor(() => expect(sockets()).toHaveLength(1));
    const ws1 = sockets()[0];
    ws1._open();

    enterScope("collection:c1");
    expect(ws1.sent.map((s) => JSON.parse(s))).toContainEqual({ type: "scope_enter", scope: "collection:c1" });

    // Drop the socket; the new one must be told about the still-open scope.
    ws1.close();
    await vi.waitFor(() => expect(sockets().length).toBeGreaterThanOrEqual(2), { timeout: 3000 });
    const ws2 = sockets().at(-1);
    ws2._open();
    ws2._emit({ type: "ready" });
    expect(ws2.sent.map((s) => JSON.parse(s))).toContainEqual({ type: "scope_enter", scope: "collection:c1" });

    leaveScope("collection:c1");
    expect(ws2.sent.map((s) => JSON.parse(s))).toContainEqual({ type: "scope_leave", scope: "collection:c1" });
  });

  it("throttles typing frames", async () => {
    startRealtime();
    await vi.waitFor(() => expect(sockets()).toHaveLength(1));
    const ws = sockets()[0];
    ws._open();
    enterScope("thread:t1");

    sendTyping("thread:t1");
    sendTyping("thread:t1");
    sendTyping("thread:t1");

    const typingFrames = ws.sent.map((s) => JSON.parse(s)).filter((f) => f.type === "typing");
    expect(typingFrames).toHaveLength(1);
  });
});
