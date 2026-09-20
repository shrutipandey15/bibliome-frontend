/**
 * The service worker's click handler, run for real.
 *
 * public/sw.js is not importable — it is a worker script that talks to a global
 * `self` the app never has. So it is loaded as source and evaluated against a
 * stub, which is enough to hold the one behaviour that kept breaking: a click
 * has to END UP on the notification's page, whatever the browser does with the
 * tabs on the way there.
 */
import { readFileSync } from "node:fs";
import { describe, it, expect, beforeEach } from "vitest";

const SOURCE = readFileSync("public/sw.js", "utf8");
const ORIGIN = "https://bibliome.app";

function loadWorker(clients) {
  const handlers = {};
  const opened = [];
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type, fn) => { handlers[type] = fn; },
    skipWaiting: () => {},
    registration: { showNotification: () => {} },
    clients: {
      matchAll: async () => clients,
      claim: async () => {},
      openWindow: async (url) => { opened.push(url); return { url }; },
    },
  };
  // eslint-disable-next-line no-new-func
  new Function("self", SOURCE)(self);

  /** Fire a notification click and wait for the handler to settle. */
  const click = async (url) => {
    let waited;
    handlers.notificationclick({
      notification: { close: () => {}, data: { url } },
      waitUntil: (p) => { waited = p; },
    });
    return waited;
  };
  return { click, opened };
}

const tab = (url, { controlled = true } = {}) => {
  const client = {
    url: `${ORIGIN}${url}`,
    focused: false,
    navigatedTo: null,
    focus() { this.focused = true; return this; },
    async navigate(to) {
      if (!controlled) throw new TypeError("Cannot navigate a client that is not controlled");
      this.navigatedTo = to;
      this.url = to;
      return this;
    },
  };
  return client;
};

describe("notification click", () => {
  let target;
  beforeEach(() => { target = "/collections/c1/discussion/b1"; });

  it("steers an open tab to the notification's page", async () => {
    const home = tab("/");
    const { click, opened } = loadWorker([home]);

    await click(target);

    expect(home.navigatedTo).toBe(`${ORIGIN}${target}`);
    expect(home.focused).toBe(true);
    expect(opened).toEqual([]);
  });

  it("opens a window when the tab cannot be navigated", async () => {
    // The regression: a tab opened before this worker activated is not
    // controlled, navigate() rejects, and the old handler swallowed it — the
    // tab came forward still sitting on the home page.
    const home = tab("/", { controlled: false });
    const { click, opened } = loadWorker([home]);

    await click(target);

    expect(opened).toEqual([`${ORIGIN}${target}`]);
    expect(home.focused).toBe(false);
  });

  it("just focuses a tab already on the page", async () => {
    const already = tab(target);
    const { click, opened } = loadWorker([already]);

    await click(target);

    expect(already.focused).toBe(true);
    expect(already.navigatedTo).toBe(null);
    expect(opened).toEqual([]);
  });

  it("opens a window when nothing is open", async () => {
    const { click, opened } = loadWorker([]);
    await click(target);
    expect(opened).toEqual([`${ORIGIN}${target}`]);
  });

  it("falls back to the shelf when a push carries no url", async () => {
    const { click, opened } = loadWorker([]);
    await click(undefined);
    expect(opened).toEqual([`${ORIGIN}/`]);
  });
});
