import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Always stub WebSocket in tests — we never want a real socket opening, and
// jsdom's own implementation would try to. The realtime client constructs one
// inside startRealtime(); this stand-in records instances and exposes _open /
// _emit so tests can drive the connection deterministically.
{
  class MockWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    static instances = [];
    constructor(url) {
      this.url = url;
      this.sent = [];
      this.readyState = MockWebSocket.CONNECTING;
      this.onopen = this.onclose = this.onmessage = this.onerror = null;
      MockWebSocket.instances.push(this);
    }
    send(data) { this.sent.push(data); }
    close() {
      if (this.readyState === MockWebSocket.CLOSED) return;
      this.readyState = MockWebSocket.CLOSED;
      this.onclose?.({});
    }
    // test helpers
    _open() { this.readyState = MockWebSocket.OPEN; this.onopen?.({}); }
    _emit(obj) { this.onmessage?.({ data: JSON.stringify(obj) }); }
  }
  globalThis.WebSocket = MockWebSocket;
}

// Ensure a clean DOM + storage between tests.
afterEach(() => {
  cleanup();
  localStorage.clear();
});
