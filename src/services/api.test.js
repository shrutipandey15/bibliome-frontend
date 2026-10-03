import { describe, it, expect, beforeEach, vi } from "vitest";
import { apiFetch, login, logout, getAccessToken, setAccessToken, clearSession, getAllEntries, ApiError } from "./api";
import { setCachedEntries, getCachedEntries } from "./offline";

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

describe("apiFetch single-flight refresh [F1.1 / P2-11]", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    setAccessToken("old");
  });

  it("fires /auth/refresh exactly once when many requests 401 in parallel", async () => {
    let refreshCalls = 0;

    const fetchMock = vi.fn(async (url, opts) => {
      if (url.endsWith("/auth/refresh")) {
        refreshCalls += 1;
        // Simulate latency so all stampeding callers overlap.
        await new Promise((r) => setTimeout(r, 10));
        return jsonResponse({ access_token: "new", expires_in: 900 });
      }
      const auth = opts?.headers?.Authorization;
      // The stale access token 401s; the refreshed one succeeds.
      if (auth === "Bearer old") return jsonResponse({ detail: "expired" }, 401);
      return jsonResponse({ ok: true });
    });
    vi.stubGlobal("fetch", fetchMock);

    const results = await Promise.all(
      Array.from({ length: 5 }, () => apiFetch("/entries")),
    );

    expect(refreshCalls).toBe(1);
    expect(results.every((r) => r.status === 200)).toBe(true);
    // Refreshed access token is held in memory for subsequent requests.
    expect(getAccessToken()).toBe("new");
  });

  it("sends the refresh request with credentials and no body (cookie is the credential)", async () => {
    const fetchMock = vi.fn(async (url) => {
      if (url.endsWith("/auth/refresh")) return jsonResponse({ access_token: "new", expires_in: 900 });
      return jsonResponse({ detail: "expired" }, 401);
    });
    vi.stubGlobal("fetch", fetchMock);

    // First call 401s (only once because _retried short-circuits), triggers refresh.
    await apiFetch("/entries");
    const refreshCall = fetchMock.mock.calls.find(([u]) => u.endsWith("/auth/refresh"));
    expect(refreshCall).toBeDefined();
    expect(refreshCall[1].credentials).toBe("same-origin");
    expect(refreshCall[1].body).toBeUndefined();
  });

  it("clears the session and does not loop when refresh fails", async () => {
    setCachedEntries([{ id: 1 }]);
    const fetchMock = vi.fn(async (url) => {
      if (url.endsWith("/auth/refresh")) return jsonResponse({ detail: "revoked" }, 401);
      return jsonResponse({ detail: "expired" }, 401);
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await apiFetch("/entries");
    expect(res.status).toBe(401);
    expect(getAccessToken()).toBeNull();
    // Session end wipes the per-account cache. [F1.4 / P5-3]
    expect(getCachedEntries()).toBeNull();
  });
});

describe("access token is never persisted to localStorage [B1.10 / P1-1]", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    clearSession();
  });

  it("login keeps the access token in memory only", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ access_token: "mem", expires_in: 900, user: { id: "u1" } })),
    );

    const data = await login("a@b.com", "pw");

    expect(data.user.id).toBe("u1");
    expect(getAccessToken()).toBe("mem");
    // No token anywhere in localStorage.
    expect(localStorage.getItem("bookdna_tokens")).toBeNull();
    expect(JSON.stringify(localStorage)).not.toContain("mem");
  });

  it("logout revokes server-side and wipes local session + cache", async () => {
    setAccessToken("mem");
    setCachedEntries([{ id: 1, title: "Previous user's book" }]);
    const fetchMock = vi.fn(async () => jsonResponse({}));
    vi.stubGlobal("fetch", fetchMock);

    await logout();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/auth/logout"),
      expect.objectContaining({ method: "POST", credentials: "same-origin" }),
    );
    expect(getAccessToken()).toBeNull();
    expect(getCachedEntries()).toBeNull();
  });
});

describe("getAllEntries walks the keyset cursor [F1.8 / B1.4]", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    setAccessToken("tok");
  });

  it("follows next_cursor across pages and concatenates all entries", async () => {
    const seenCursors = [];
    const fetchMock = vi.fn(async (url) => {
      const u = new URL(url, "http://x");
      seenCursors.push(u.searchParams.get("cursor"));
      // Page 1: two entries + a cursor; page 2: one entry, no more.
      if (!u.searchParams.get("cursor")) {
        return jsonResponse({ entries: [{ id: 1 }, { id: 2 }], total: 3, next_cursor: "c2", has_more: true });
      }
      return jsonResponse({ entries: [{ id: 3 }], total: 3, next_cursor: null, has_more: false });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { entries, total } = await getAllEntries({ pageSize: 2 });

    expect(entries.map((e) => e.id)).toEqual([1, 2, 3]);
    expect(total).toBe(3);
    // First request has no cursor; second carries the page-1 next_cursor.
    expect(seenCursors).toEqual([null, "c2"]);
  });

  it("stops after one page when has_more is false", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ entries: [{ id: 1 }], total: 1, next_cursor: null, has_more: false }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { entries } = await getAllEntries();
    expect(entries).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws a typed ApiError on a rejected (400) cursor", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ detail: "Invalid pagination cursor." }, 400)));
    await expect(getAllEntries()).rejects.toBeInstanceOf(ApiError);
  });
});

describe("the share card's calls", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    setAccessToken("tok");
  });

  it("sends the 'card' marker on sign-up from Find yours, and nothing else", async () => {
    const { register } = await import("./api");
    const fetchMock = vi.fn(async () => jsonResponse({ access_token: "a", expires_in: 900, user: {} }, 201));
    vi.stubGlobal("fetch", fetchMock);
    await register("a@b.co", "reader", "hunter2pass", "", { via: "card" });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).via).toBe("card");
    await register("a@b.co", "reader", "hunter2pass", "", { via: "somebody-else" });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).not.toHaveProperty("via");
    await register("a@b.co", "reader", "hunter2pass");
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).not.toHaveProperty("via");
  });

  it("counts a share by format and never lets a failed count fail the share", async () => {
    const { countShare } = await import("./api");
    const fetchMock = vi.fn(async () => { throw new Error("offline"); });
    vi.stubGlobal("fetch", fetchMock);
    expect(() => countShare("story")).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/card\/shares$/);
    expect(JSON.parse(opts.body)).toEqual({ format: "story" });
  });

  it("reads the card link without making one", async () => {
    const { getShareToken } = await import("./api");
    const fetchMock = vi.fn(async () => jsonResponse({ share_token: null }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await getShareToken()).toEqual({ share_token: null });
    expect(fetchMock.mock.calls[0][1]?.method ?? "GET").toBe("GET");
  });
});
