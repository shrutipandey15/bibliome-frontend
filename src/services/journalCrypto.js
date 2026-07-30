/**
 * Journal crypto — the whole of it, in one file, with no React and no network.
 *
 * Everything that touches a key or a plaintext lives here so a reviewer can read
 * one file and know the claim holds. Nothing in this module fetches, stores, or
 * logs: it takes secrets and bytes, returns base64, and forgets. The wire shape
 * it produces is `journalCryptoContract.md` §1 verbatim.
 *
 * The key hierarchy:
 *
 *   password      ──PBKDF2(password_salt)──▶ password key ──wrap──┐
 *                                                                 ├─▶ DEK (random 256-bit)
 *   recovery code ──PBKDF2(recovery_salt)──▶ recovery key ──wrap──┘
 *                                                                       │
 *                                                                       ▼
 *                                                       AES-GCM over every entry
 *
 * The DEK is generated here, once, at setup. It is random — never derived from
 * the password — which is what makes a password *change* a re-wrap instead of a
 * re-encryption of the entire journal. It is wrapped twice, under independent
 * salts, giving two unlock paths that share no secret.
 *
 * ## Why PBKDF2 and not Argon2
 *
 * Argon2id is the better KDF and the contract allows it. It is not in WebCrypto,
 * so shipping it means shipping a WASM blob — more delivered JavaScript to trust
 * in a design whose stated weak point (contract §6) is exactly the delivered
 * JavaScript. PBKDF2-SHA256 at 600k iterations is on the server's allowlist, is
 * native, and is auditable in the browser's own source. `kdf` and `kdf_params`
 * ride along with every bundle, so switching later is a per-user re-wrap, not a
 * migration: unlock always uses the params the bundle was *sealed* with, never
 * the constants below.
 *
 * ## What never happens here
 *
 * No key or plaintext is written to localStorage, sessionStorage, IndexedDB, a
 * cookie, or the URL. No key or plaintext is passed to console.*. The DEK exists
 * as a CryptoKey held by JournalKeyContext for the life of the tab and dies with
 * it. It is `extractable: true` for exactly one reason — `wrapKey` requires it,
 * and re-wrapping under a new password is the whole point of the design.
 */

// ── Algorithm constants (defaults for NEW bundles only) ──
export const CIPHER = "AES-GCM";
export const KDF = "pbkdf2-sha256";
export const PBKDF2_ITERATIONS = 600_000;
export const PBKDF2_HASH = "SHA-256";

const SALT_BYTES = 16; // server floor is 16
const NONCE_BYTES = 12; // AES-GCM's native IV size
const DEK_BITS = 256;
const RECOVERY_ENTROPY_BYTES = 15; // 120 bits → 24 base32 chars

/** Typed so the UI can tell "you typed the wrong password" (recoverable, say so
 *  gently) from "this browser can't do this" (terminal, say so loudly). */
export class JournalCryptoError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = "JournalCryptoError";
    this.code = code; // "unsupported" | "wrong_secret" | "malformed"
  }
}

function subtle() {
  const c = globalThis.crypto;
  if (!c || !c.subtle) {
    // Non-secure origins get no crypto.subtle. Failing loudly here is the only
    // honest option: a "journal" that silently stored plaintext would be a lie.
    throw new JournalCryptoError(
      "unsupported",
      "Your browser can't encrypt here. The journal needs a secure (https) connection."
    );
  }
  return c.subtle;
}

function randomBytes(n) {
  const b = new Uint8Array(n);
  globalThis.crypto.getRandomValues(b);
  return b;
}

// ── base64 ⇄ bytes ──
// The wire format is base64 (contract §3 validates decodability and length on
// every field). btoa/atob are byte-oriented, which is what we want: these only
// ever see ciphertext and salts, never text.
export function toB64(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s);
}

export function fromB64(b64) {
  let bin;
  try {
    bin = atob(b64);
  } catch {
    throw new JournalCryptoError("malformed", "Expected base64");
  }
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ── Recovery code ──
// Crockford base32: no I, L, O, or U — so the alphabet survives being written on
// paper and typed back by a human who is, by definition, having a bad day.
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** 120 bits, formatted in six groups of four. Shown exactly once, at setup. */
export function generateRecoveryCode() {
  const bytes = randomBytes(RECOVERY_ENTROPY_BYTES);
  let bits = 0;
  let acc = 0;
  let out = "";
  for (const b of bytes) {
    acc = (acc << 8) | b;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += CROCKFORD[(acc >> bits) & 31];
    }
  }
  return out.match(/.{1,4}/g).join("-");
}

/** Fold the ways a human retypes a code back onto the canonical string: case,
 *  spaces, dashes, and the visual aliases Crockford defines (I/L→1, O→0). The
 *  KDF input is the normalized form, so all of these unlock the same journal. */
export function normalizeRecoveryCode(input) {
  return String(input || "")
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .replace(/[IL]/g, "1")
    .replace(/O/g, "0");
}

// ── Key derivation ──

/** Stretch a human secret (password or recovery code) into a wrapping key.
 *
 *  `params` comes from the bundle on every unlock path — never from the module
 *  constants — so a bundle sealed at 600k iterations still opens after we raise
 *  the default to 1M.
 */
async function deriveWrappingKey(secret, saltBytes, params = {}) {
  const material = await subtle().importKey(
    "raw",
    new TextEncoder().encode(secret),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return subtle().deriveKey(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations: params.iterations || PBKDF2_ITERATIONS,
      hash: params.hash || PBKDF2_HASH,
    },
    material,
    { name: CIPHER, length: DEK_BITS },
    false, // the wrapping key itself is never extractable — nothing needs its bytes
    ["wrapKey", "unwrapKey"]
  );
}

async function wrapDek(dek, wrappingKey) {
  const nonce = randomBytes(NONCE_BYTES);
  const wrapped = await subtle().wrapKey("raw", dek, wrappingKey, {
    name: CIPHER,
    iv: nonce,
  });
  return { wrapped: toB64(wrapped), nonce: toB64(nonce) };
}

async function unwrapDek(wrappedB64, nonceB64, wrappingKey) {
  try {
    return await subtle().unwrapKey(
      "raw",
      fromB64(wrappedB64),
      wrappingKey,
      { name: CIPHER, iv: fromB64(nonceB64) },
      { name: CIPHER, length: DEK_BITS },
      true, // extractable: re-wrapping under a new password needs wrapKey
      ["encrypt", "decrypt"]
    );
  } catch (err) {
    if (err instanceof JournalCryptoError) throw err;
    // AES-GCM's tag check failed. There is no other information to give: the
    // server never verified this secret and could not have.
    throw new JournalCryptoError("wrong_secret", "That didn't unlock the journal.");
  }
}

// ── Bundles ──

/** First-run setup. Generates the DEK and both wrappings in one shot.
 *
 *  Returns `{ bundle, dek }` — the bundle goes to POST /journal/key, the dek
 *  stays in memory and is never returned to any other layer in raw form.
 */
export async function createKeyBundle(password, recoveryCode) {
  const dek = await subtle().generateKey({ name: CIPHER, length: DEK_BITS }, true, [
    "encrypt",
    "decrypt",
  ]);

  const passwordSalt = randomBytes(SALT_BYTES);
  const recoverySalt = randomBytes(SALT_BYTES);
  const params = { iterations: PBKDF2_ITERATIONS, hash: PBKDF2_HASH };

  const [passwordKey, recoveryKey] = await Promise.all([
    deriveWrappingKey(password, passwordSalt, params),
    deriveWrappingKey(normalizeRecoveryCode(recoveryCode), recoverySalt, params),
  ]);
  const [byPassword, byRecovery] = await Promise.all([
    wrapDek(dek, passwordKey),
    wrapDek(dek, recoveryKey),
  ]);

  return {
    dek,
    bundle: {
      cipher: CIPHER,
      kdf: KDF,
      kdf_params: params,
      password_salt: toB64(passwordSalt),
      wrapped_dek: byPassword.wrapped,
      wrapped_dek_nonce: byPassword.nonce,
      recovery_salt: toB64(recoverySalt),
      wrapped_dek_recovery: byRecovery.wrapped,
      wrapped_dek_recovery_nonce: byRecovery.nonce,
      key_version: 1,
    },
  };
}

export async function unlockWithPassword(bundle, password) {
  const key = await deriveWrappingKey(
    password,
    fromB64(bundle.password_salt),
    bundle.kdf_params
  );
  return unwrapDek(bundle.wrapped_dek, bundle.wrapped_dek_nonce, key);
}

export async function unlockWithRecoveryCode(bundle, recoveryCode) {
  const key = await deriveWrappingKey(
    normalizeRecoveryCode(recoveryCode),
    fromB64(bundle.recovery_salt),
    bundle.kdf_params
  );
  return unwrapDek(
    bundle.wrapped_dek_recovery,
    bundle.wrapped_dek_recovery_nonce,
    key
  );
}

/** Re-wrap the *same* DEK under a new password, leaving the recovery wrapping
 *  byte-for-byte alone.
 *
 *  Two consequences worth stating. The recovery wrap never depended on the
 *  password, so it stays valid and the user does not need their recovery code to
 *  change their password — which is good, because they won't have it to hand.
 *  And because the DEK is unchanged, no entry needs re-encrypting: this is a
 *  48-byte write, not a migration.
 *
 *  Fresh salt on the password side regardless — reusing it across passwords
 *  would let an attacker who captured both bundles attack one salt twice.
 */
export async function rewrapForPassword(bundle, dek, newPassword) {
  const params = bundle.kdf_params && Object.keys(bundle.kdf_params).length
    ? bundle.kdf_params
    : { iterations: PBKDF2_ITERATIONS, hash: PBKDF2_HASH };
  const passwordSalt = randomBytes(SALT_BYTES);
  const passwordKey = await deriveWrappingKey(newPassword, passwordSalt, params);
  const byPassword = await wrapDek(dek, passwordKey);

  return {
    cipher: bundle.cipher,
    kdf: bundle.kdf,
    kdf_params: params,
    password_salt: toB64(passwordSalt),
    wrapped_dek: byPassword.wrapped,
    wrapped_dek_nonce: byPassword.nonce,
    // Untouched. The server compares nothing here; we simply hand back what it
    // already holds so the recovery path survives the write.
    recovery_salt: bundle.recovery_salt,
    wrapped_dek_recovery: bundle.wrapped_dek_recovery,
    wrapped_dek_recovery_nonce: bundle.wrapped_dek_recovery_nonce,
    key_version: bundle.key_version || 1,
  };
}

// ── Entries ──

/** Seal one entry. A fresh nonce every time, without exception — reusing a nonce
 *  under the same AES-GCM key leaks the XOR of two plaintexts and voids the
 *  authentication tag's guarantee. The API enforces the same rule from its side
 *  by refusing a ciphertext update that arrives without a nonce. */
export async function encryptEntry(dek, plaintext) {
  const nonce = randomBytes(NONCE_BYTES);
  const ciphertext = await subtle().encrypt(
    { name: CIPHER, iv: nonce },
    dek,
    new TextEncoder().encode(plaintext)
  );
  return { ciphertext: toB64(ciphertext), nonce: toB64(nonce) };
}

export async function decryptEntry(dek, ciphertextB64, nonceB64) {
  try {
    const plain = await subtle().decrypt(
      { name: CIPHER, iv: fromB64(nonceB64) },
      dek,
      fromB64(ciphertextB64)
    );
    return new TextDecoder().decode(plain);
  } catch (err) {
    if (err instanceof JournalCryptoError) throw err;
    // Sealed under a different key version, or the blob is damaged. Either way
    // the client cannot open it and no server call can help.
    throw new JournalCryptoError("wrong_secret", "This entry could not be opened.");
  }
}
