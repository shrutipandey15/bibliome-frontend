import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";

beforeAll(() => {
  if (!globalThis.crypto?.subtle) vi.stubGlobal("crypto", webcrypto);
});

const { createKeyBundle, encryptEntry, generateRecoveryCode } = await import("./journalCrypto");
const {
  createJournalEntry,
  createJournalKeyBundle,
  setJournalEntryTags,
  updateJournalEntry,
} = await import("./api");

/**
 * The reviewer's first check, automated: inspect the actual payloads.
 *
 * These tests drive the real api.js against a captured `fetch` and assert on the
 * exact bytes that would go over the wire. Reading journalCrypto.js and
 * believing it is one thing; this is the receipt. If someone later adds a
 * "helpful" plaintext field — a preview, a title, a word count, a search index —
 * these fail.
 */

const PASSWORD = "correct horse battery staple";
const PROSE = "I did not tell anyone what happened on Thursday.";

let sent;

beforeEach(() => {
  sent = [];
  vi.stubGlobal("fetch", vi.fn(async (url, opts = {}) => {
    sent.push({ url: String(url), method: opts.method || "GET", body: opts.body });
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: "entry-1", entry_date: "2026-07-30", emotions: [], key_version: 1 }),
    };
  }));
});

/** Every byte this client sent, concatenated. */
const wire = () => sent.map((r) => String(r.body || "")).join("\n");

describe("what actually leaves the browser", () => {
  it("sends no prose and no password when storing an entry", async () => {
    const { dek } = await createKeyBundle(PASSWORD, generateRecoveryCode());
    const { ciphertext, nonce } = await encryptEntry(dek, PROSE);
    await createJournalEntry({
      entry_date: "2026-07-30", ciphertext, nonce, key_version: 1, emotions: [],
    });

    expect(sent).toHaveLength(1);
    const body = JSON.parse(sent[0].body);

    // The whole claim, in four assertions.
    expect(wire()).not.toContain(PROSE);
    expect(wire()).not.toContain("Thursday");
    expect(wire()).not.toContain(PASSWORD);
    expect(body.ciphertext).toBe(ciphertext);

    // And nothing rode along that shouldn't have. A new key here is a leak
    // until proven otherwise, which is why this asserts the exact set.
    expect(Object.keys(body).sort())
      .toEqual(["ciphertext", "emotions", "entry_date", "key_version", "nonce"]);
  }, 30_000);

  it("sends a fresh nonce on every edit, never a ciphertext without one", async () => {
    const { dek } = await createKeyBundle(PASSWORD, generateRecoveryCode());
    const first = await encryptEntry(dek, PROSE);
    const second = await encryptEntry(dek, `${PROSE} Or the day after.`);

    await updateJournalEntry("entry-1", { ...first, entry_date: "2026-07-30" });
    await updateJournalEntry("entry-1", { ...second, entry_date: "2026-07-30" });

    const bodies = sent.map((r) => JSON.parse(r.body));
    expect(bodies[0].nonce).not.toBe(bodies[1].nonce);
    for (const b of bodies) {
      expect(b.ciphertext).toBeTruthy();
      expect(b.nonce).toBeTruthy();
    }
    expect(wire()).not.toContain(PROSE);
  }, 30_000);

  it("sends the key bundle wrapped, and nothing that could unwrap it", async () => {
    const code = generateRecoveryCode();
    const { bundle } = await createKeyBundle(PASSWORD, code);
    await createJournalKeyBundle(bundle);

    const w = wire();
    expect(w).not.toContain(PASSWORD);
    // The recovery code is not even hashed on the way out. The server has no
    // reason to verify it — the AEAD tag does that, on the client.
    expect(w).not.toContain(code);
    expect(w).not.toContain(code.replace(/-/g, ""));
    expect(JSON.parse(sent[0].body)).toHaveProperty("wrapped_dek");
  }, 30_000);

  it("sends tags in the clear — the deliberate half of the split", async () => {
    await setJournalEntryTags("entry-1", [{ emotion_id: "grief", strength: 7 }]);

    // This one asserts the *opposite* of the others, and it should. Tags are
    // readable by design (contract §2): the DNA runs on them and they say
    // nothing on their own. If this ever starts failing because someone
    // encrypted the tags, the journal has quietly stopped feeding the one
    // feature that justifies it living inside Bibliome.
    const body = JSON.parse(sent[0].body);
    expect(body.emotions).toEqual([{ emotion_id: "grief", strength: 7 }]);
    expect(sent[0].url).toContain("/journal/entries/entry-1/tags");
    // ...and it still carries no prose. Tagging never re-sends the writing.
    expect(body).not.toHaveProperty("ciphertext");
  });

  it("never reaches a search endpoint, because there isn't one", async () => {
    // There is no searchJournal() to call. Guarding the absence keeps a future
    // "just add ?q=" from passing review quietly.
    const api = await import("./api");
    expect(Object.keys(api).filter((k) => /journal/i.test(k) && /search/i.test(k))).toEqual([]);
  });
});
