import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { startRealtime, stopRealtime, onRealtime, isRealtimeConnected } from "./realtime";
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
});
