import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  createJournalKeyBundle,
  getJournalKeyBundle,
  rewrapJournalKeyBundle,
  changePassword as apiChangePassword,
} from "../services/api";
import {
  JournalCryptoError,
  createKeyBundle,
  generateRecoveryCode,
  rewrapForPassword,
  unlockWithPassword,
  unlockWithRecoveryCode,
} from "../services/journalCrypto";

/**
 * The data key's whole life, and nothing else.
 *
 * The DEK lives in a ref, for the lifetime of one tab, exactly like the access
 * token lives in a module variable in api.js — and for the same reason. It is
 * never in React state (state gets serialized into devtools, error reports, and
 * SSR payloads), never in localStorage or sessionStorage, and never in a URL. A
 * refresh loses it; that is not a bug to work around, it is what "we cannot read
 * your journal" costs, and the UI says so at the lock screen rather than
 * inventing somewhere to stash it.
 *
 * Status is a small state machine:
 *
 *   loading ─▶ absent    no bundle on the server — first run, needs setup
 *           ─▶ locked    a bundle exists, no key in memory (reload, or reset)
 *           ─▶ unlocked  the DEK is in this tab's memory
 *           ─▶ error     the bundle couldn't be fetched (network / server)
 *
 * `staleWrap` refines "locked": the account password changed without a re-wrap
 * (every password *reset* does this), so the password path is dead and only the
 * recovery code can open the journal. The server tells us; we don't guess.
 */

const JournalKeyContext = createContext(null);

export function useJournalKey() {
  const ctx = useContext(JournalKeyContext);
  if (!ctx) throw new Error("useJournalKey must be used inside JournalKeyProvider");
  return ctx;
}

// ── Login handoff ──
// Deriving the wrapping key needs the password, and the password exists for
// exactly one moment: the login form. It is handed off here — in memory, single
// use — and the provider consumes and clears it on mount. It is never stored,
// never sent anywhere, and if nothing consumes it within the window below it is
// dropped. The alternative is asking the user for their password a second time
// thirty seconds after they typed it, which trains people to type passwords into
// prompts.
let stagedSecret = null;
let stagedTimer = null;

export function stageJournalSecret(password) {
  stagedSecret = password || null;
  clearTimeout(stagedTimer);
  // A short leash: the provider mounts on the next render after login. If it
  // doesn't, this is dead weight holding a password.
  stagedTimer = setTimeout(() => { stagedSecret = null; }, 30_000);
}

export function clearStagedSecret() {
  stagedSecret = null;
  clearTimeout(stagedTimer);
}

function consumeStagedSecret() {
  const s = stagedSecret;
  clearStagedSecret();
  return s;
}

export function JournalKeyProvider({ children }) {
  const [status, setStatus] = useState("loading");
  const [bundle, setBundle] = useState(null);
  const [error, setError] = useState(null);
  // Set when a recovery unlock worked but the follow-up re-wrap didn't. The
  // journal is open; the password path still isn't. Surfaced in the unlocked UI
  // because by then the lock screen is gone.
  const [rewrapWarning, setRewrapWarning] = useState(null);
  // The DEK. A ref, deliberately — see the module docstring. `keyEpoch` is the
  // render-visible signal that it changed, so consumers re-run effects without
  // the key itself ever entering state.
  const dekRef = useRef(null);
  const [keyEpoch, setKeyEpoch] = useState(0);

  const setDek = useCallback((key) => {
    dekRef.current = key;
    setKeyEpoch((n) => n + 1);
  }, []);

  const staleWrap = Boolean(bundle?.password_wrap_stale);

  // Boot: fetch the wrapped key material, then try the staged password if we
  // have one. Serving the bundle to its owner's session is safe — without a
  // secret we never received, it is inert.
  useEffect(() => {
    let cancelled = false;
    const secret = consumeStagedSecret();

    (async () => {
      let fetched;
      try {
        fetched = await getJournalKeyBundle();
      } catch (err) {
        if (!cancelled) { setError(err); setStatus("error"); }
        return;
      }
      if (cancelled) return;
      setBundle(fetched);

      if (!fetched) { setStatus("absent"); return; }
      // A stale password wrap means the stored wrap no longer matches the
      // password the user just typed. Trying it would burn a second of PBKDF2 to
      // produce a failure we can already predict.
      if (!secret || fetched.password_wrap_stale) { setStatus("locked"); return; }

      try {
        const dek = await unlockWithPassword(fetched, secret);
        if (cancelled) return;
        setDek(dek);
        setStatus("unlocked");
      } catch {
        // Wrong password for the journal but right for the account: possible if
        // a password change skipped the re-wrap. The lock screen handles it.
        if (!cancelled) setStatus("locked");
      }
    })();

    return () => { cancelled = true; };
  }, [setDek]);

  // Belt and braces: drop the key when the provider goes away (logout, route
  // teardown). The tab dying does this anyway; this covers the case where it
  // doesn't.
  useEffect(() => () => { dekRef.current = null; clearStagedSecret(); }, []);

  /** First run, part one: generate the DEK and the recovery code and wrap twice,
   *  entirely locally. Nothing is sent. The caller shows the code and gets it
   *  confirmed before anything exists on the server.
   *
   *  The split is the whole point. If setup stored the bundle first and showed
   *  the code second, a user who closed the tab on that screen would own a
   *  journal whose only recovery path is a string nobody ever wrote down —
   *  broken at the exact moment we were promising it wasn't. */
  const prepareSetup = useCallback(async (password) => {
    const recoveryCode = generateRecoveryCode();
    const { bundle: newBundle, dek } = await createKeyBundle(password, recoveryCode);
    return { recoveryCode, bundle: newBundle, dek };
  }, []);

  /** Part two: the user has the code in hand. Now the journal exists. */
  const commitSetup = useCallback(async (prepared) => {
    const saved = await createJournalKeyBundle(prepared.bundle);
    setBundle(saved);
    setDek(prepared.dek);
    setStatus("unlocked");
    return saved;
  }, [setDek]);

  const unlock = useCallback(async (password) => {
    if (!bundle) throw new JournalCryptoError("malformed", "No journal key to unlock.");
    const dek = await unlockWithPassword(bundle, password);
    setDek(dek);
    setStatus("unlocked");
  }, [bundle, setDek]);

  /** Unlock with the recovery code, then immediately re-wrap under the current
   *  password so the normal path works again and the code goes back in the
   *  drawer. The re-wrap needs the account password anyway (the server gates PUT
   *  /journal/key on it), so asking for both here costs nothing extra. */
  const recoverWithCode = useCallback(async (recoveryCode, accountPassword) => {
    if (!bundle) throw new JournalCryptoError("malformed", "No journal key to unlock.");
    // A wrong code throws here, before anything else happens, and the lock
    // screen reports it. From this line on the journal IS open.
    const dek = await unlockWithRecoveryCode(bundle, recoveryCode);

    // The re-wrap is a separate concern and a separate failure. It can fail on a
    // wrong *account* password or a dead network — neither of which is a reason
    // to withhold a journal we just successfully decrypted. So it runs first,
    // its failure is recorded rather than thrown, and the unlock lands either
    // way. The warning tells the user the password path is still dead.
    let warning = null;
    try {
      const rewrapped = await rewrapForPassword(bundle, dek, accountPassword);
      setBundle(await rewrapJournalKeyBundle(rewrapped, accountPassword));
    } catch (err) {
      warning = err.message ||
        "Your journal is open, but it's still tied to your old password. Keep your recovery code.";
    }

    setRewrapWarning(warning);
    setDek(dek);
    setStatus("unlocked");
  }, [bundle, setDek]);

  /** Change the account password and move the journal with it, in one request.
   *  The server writes the password hash and the bundle in a single transaction
   *  precisely so there is no window where they disagree. If the journal is
   *  locked we cannot re-wrap — we send the change without a bundle and the
   *  caller gets `journal.rewrapped === false` to report honestly. */
  const changePasswordWithRewrap = useCallback(async (currentPassword, newPassword) => {
    let newBundle = null;
    if (bundle && dekRef.current) {
      newBundle = await rewrapForPassword(bundle, dekRef.current, newPassword);
    }
    const result = await apiChangePassword(currentPassword, newPassword, newBundle);
    if (newBundle) {
      setBundle((prev) => (prev ? { ...prev, ...newBundle, password_wrap_stale: false } : prev));
    }
    return result;
  }, [bundle]);

  const lock = useCallback(() => {
    dekRef.current = null;
    setKeyEpoch((n) => n + 1);
    if (bundle) setStatus("locked");
  }, [bundle]);

  return (
    <JournalKeyContext.Provider value={{
      status, staleWrap, error, keyEpoch, rewrapWarning,
      dismissRewrapWarning: () => setRewrapWarning(null),
      hasJournal: status !== "loading" && status !== "absent",
      // A getter, not the key itself: consumers reach for it at the moment of
      // use and never hold a copy across renders.
      getDek: () => dekRef.current,
      prepareSetup, commitSetup, unlock, recoverWithCode, changePasswordWithRewrap, lock,
    }}>
      {children}
    </JournalKeyContext.Provider>
  );
}
