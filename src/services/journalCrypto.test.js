import { beforeAll, describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";

// jsdom ships a `crypto` with getRandomValues and no `subtle`. Node's WebCrypto
// is the same API the browser runs, so the code under test is unmodified — we're
// only supplying the implementation jsdom omits.
beforeAll(() => {
  if (!globalThis.crypto?.subtle) vi.stubGlobal("crypto", webcrypto);
});

const {
  JournalCryptoError,
  createKeyBundle,
  decryptEntry,
  encryptEntry,
  fromB64,
  generateRecoveryCode,
  normalizeRecoveryCode,
  rewrapForPassword,
  unlockWithPassword,
  unlockWithRecoveryCode,
} = await import("./journalCrypto");

// PBKDF2 at 600k iterations is ~1s per derivation and several tests derive more
// than once.
const SLOW = 30_000;

const PASSWORD = "correct horse battery staple";

describe("key bundle", () => {
  it("wraps one key two ways, and both open it", async () => {
    const code = generateRecoveryCode();
    const { bundle } = await createKeyBundle(PASSWORD, code);

    // The real test isn't that both unwrap — it's that both yield the SAME key,
    // which is what makes the recovery path a second door rather than a second
    // journal. Prove it by crossing them: seal with one, open with the other.
    const viaPassword = await unlockWithPassword(bundle, PASSWORD);
    const viaCode = await unlockWithRecoveryCode(bundle, code);

    const sealed = await encryptEntry(viaPassword, "the same key or it's nothing");
    expect(await decryptEntry(viaCode, sealed.ciphertext, sealed.nonce))
      .toBe("the same key or it's nothing");
  }, SLOW);

  it("carries no plaintext and no key material on the wire", async () => {
    const { bundle } = await createKeyBundle(PASSWORD, generateRecoveryCode());
    const wire = JSON.stringify(bundle);

    // Nothing in the bundle is the password, or derived from it in any form the
    // server could reverse. This is the assertion a reviewer should read first.
    expect(wire).not.toContain(PASSWORD);
    expect(Object.keys(bundle).sort()).toEqual([
      "cipher", "kdf", "kdf_params", "key_version",
      "password_salt", "recovery_salt",
      "wrapped_dek", "wrapped_dek_nonce",
      "wrapped_dek_recovery", "wrapped_dek_recovery_nonce",
    ].sort());
  }, SLOW);

  it("uses independent salts for the two wrappings", async () => {
    // The server rejects equal salts too, but a client that produced them would
    // be making the recovery path no stronger than the password path against
    // precomputation. Catch it here.
    const { bundle } = await createKeyBundle(PASSWORD, generateRecoveryCode());
    expect(bundle.password_salt).not.toBe(bundle.recovery_salt);
    expect(fromB64(bundle.password_salt).length).toBeGreaterThanOrEqual(16);
    expect(fromB64(bundle.recovery_salt).length).toBeGreaterThanOrEqual(16);
  }, SLOW);

  it("fits the server's byte bounds", async () => {
    const { bundle } = await createKeyBundle(PASSWORD, generateRecoveryCode());
    for (const f of ["wrapped_dek", "wrapped_dek_recovery"]) {
      const n = fromB64(bundle[f]).length;
      expect(n).toBeGreaterThanOrEqual(32); // schemas/journal.py MIN_WRAPPED_BYTES
      expect(n).toBeLessThanOrEqual(160);   // MAX_WRAPPED_BYTES
    }
    for (const f of ["wrapped_dek_nonce", "wrapped_dek_recovery_nonce"]) {
      const n = fromB64(bundle[f]).length;
      expect(n).toBeGreaterThanOrEqual(8);
      expect(n).toBeLessThanOrEqual(32);
    }
  }, SLOW);

  it("refuses the wrong password with a typed error", async () => {
    const { bundle } = await createKeyBundle(PASSWORD, generateRecoveryCode());
    await expect(unlockWithPassword(bundle, "not the password"))
      .rejects.toMatchObject({ name: "JournalCryptoError", code: "wrong_secret" });
  }, SLOW);

  it("refuses the wrong recovery code", async () => {
    const { bundle } = await createKeyBundle(PASSWORD, generateRecoveryCode());
    await expect(unlockWithRecoveryCode(bundle, generateRecoveryCode()))
      .rejects.toBeInstanceOf(JournalCryptoError);
  }, SLOW);
});

describe("re-wrap", () => {
  it("moves the journal to a new password without touching the recovery path or the entries", async () => {
    const code = generateRecoveryCode();
    const { bundle } = await createKeyBundle(PASSWORD, code);
    const dek = await unlockWithPassword(bundle, PASSWORD);
    const sealed = await encryptEntry(dek, "written under the old password");

    const next = await rewrapForPassword(bundle, dek, "a whole new password");

    // Old password is dead, new one works, and the entry sealed before the
    // change still opens — because the DEK never changed. That is the reason
    // the DEK is random rather than derived: a derived key would have meant
    // re-encrypting every entry on every password change.
    await expect(unlockWithPassword(next, PASSWORD)).rejects.toBeInstanceOf(JournalCryptoError);
    const newDek = await unlockWithPassword(next, "a whole new password");
    expect(await decryptEntry(newDek, sealed.ciphertext, sealed.nonce))
      .toBe("written under the old password");

    // The recovery wrapping is passed through byte-for-byte and still works.
    expect(next.wrapped_dek_recovery).toBe(bundle.wrapped_dek_recovery);
    expect(next.recovery_salt).toBe(bundle.recovery_salt);
    await expect(unlockWithRecoveryCode(next, code)).resolves.toBeDefined();

    // Fresh password salt: never reuse one across two passwords.
    expect(next.password_salt).not.toBe(bundle.password_salt);
  }, SLOW);
});

describe("entries", () => {
  it("round-trips, and never repeats a nonce", async () => {
    const { dek } = await createKeyBundle(PASSWORD, generateRecoveryCode());
    const text = "Some days the book reads you.\n\nAnd then it stops.";

    const seen = new Set();
    for (let i = 0; i < 25; i++) {
      const { ciphertext, nonce } = await encryptEntry(dek, text);
      // Nonce reuse under one AES-GCM key leaks the XOR of the plaintexts and
      // voids the tag. It is the single fatal mistake available here.
      expect(seen.has(nonce)).toBe(false);
      seen.add(nonce);
      // Same plaintext, different ciphertext every time — the fresh nonce means
      // the server can't even tell two days say the same thing.
      expect(await decryptEntry(dek, ciphertext, nonce)).toBe(text);
    }
    expect(seen.size).toBe(25);
  }, SLOW);

  it("emits nothing recognisable as the plaintext", async () => {
    const { dek } = await createKeyBundle(PASSWORD, generateRecoveryCode());
    const secret = "the incriminating part";
    const { ciphertext } = await encryptEntry(dek, secret);
    expect(ciphertext).not.toContain(secret);
    expect(atob(ciphertext)).not.toContain(secret);
    // Ciphertext is longer than the plaintext by exactly the 16-byte GCM tag.
    expect(fromB64(ciphertext).length).toBe(new TextEncoder().encode(secret).length + 16);
  }, SLOW);

  it("rejects a tampered ciphertext rather than returning garbage", async () => {
    const { dek } = await createKeyBundle(PASSWORD, generateRecoveryCode());
    const { ciphertext, nonce } = await encryptEntry(dek, "unaltered");
    const bytes = fromB64(ciphertext);
    bytes[0] ^= 0xff;
    const tampered = btoa(String.fromCharCode(...bytes));
    await expect(decryptEntry(dek, tampered, nonce)).rejects.toBeInstanceOf(JournalCryptoError);
  }, SLOW);

  it("won't open one key's entry with another key", async () => {
    const [a, b] = await Promise.all([
      createKeyBundle(PASSWORD, generateRecoveryCode()),
      createKeyBundle(PASSWORD, generateRecoveryCode()),
    ]);
    const { ciphertext, nonce } = await encryptEntry(a.dek, "mine");
    await expect(decryptEntry(b.dek, ciphertext, nonce)).rejects.toBeInstanceOf(JournalCryptoError);
  }, SLOW);

  it("survives unicode", async () => {
    const { dek } = await createKeyBundle(PASSWORD, generateRecoveryCode());
    const text = "मैंने आज कुछ नहीं लिखा — 🕯️ ";
    const { ciphertext, nonce } = await encryptEntry(dek, text);
    expect(await decryptEntry(dek, ciphertext, nonce)).toBe(text);
  }, SLOW);
});

describe("recovery code", () => {
  it("is 120 bits of Crockford base32, in groups of four", () => {
    const code = generateRecoveryCode();
    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){5}$/);
    // No I, L, O, or U — the characters people mistype off paper.
    expect(code).not.toMatch(/[ILOU]/);
  });

  it("doesn't repeat", () => {
    const codes = new Set(Array.from({ length: 200 }, generateRecoveryCode));
    expect(codes.size).toBe(200);
  });

  it("forgives the ways a code gets retyped", async () => {
    const code = generateRecoveryCode();
    const { bundle } = await createKeyBundle(PASSWORD, code);

    // Lowercase, spaces instead of dashes, and the Crockford aliases all have to
    // land on the same derived key — a user reading this off paper at the worst
    // moment of their week gets exactly one thing to get right, and it isn't
    // punctuation.
    const messy = code.toLowerCase().replace(/-/g, " ");
    await expect(unlockWithRecoveryCode(bundle, messy)).resolves.toBeDefined();
    expect(normalizeRecoveryCode("il0-O1L")).toBe("110011");
  }, SLOW);
});
