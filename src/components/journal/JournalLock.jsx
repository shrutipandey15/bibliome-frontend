import { useState } from "react";
import { Lock } from "lucide-react";
import { useJournalKey } from "../../contexts/JournalKeyContext";
import PasswordField from "../PasswordField";

/**
 * The lock screen. Reached two ways, and it matters which:
 *
 *   - a reload. The key lived in this tab's memory and the tab is new. Type the
 *     password; ordinary.
 *   - `password_wrap_stale`. The account password changed without a re-wrap —
 *     every password *reset* does this. The password path is dead and the
 *     recovery code is the only way in. The server tells us this; we don't infer
 *     it from a failed attempt, and we don't let the user discover it by typing
 *     a correct password three times and doubting themselves.
 */
export default function JournalLock() {
  const { staleWrap, unlock, recoverWithCode } = useJournalKey();
  const [mode, setMode] = useState(staleWrap ? "recovery" : "password");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "password") await unlock(password);
      else await recoverWithCode(code, password);
      setPassword("");
      setCode("");
    } catch (err) {
      setError(err.message || "That didn't unlock the journal.");
      setBusy(false);
    }
  };

  return (
    <form className="jr-lock" onSubmit={submit}>
      <div className="jr-setup-glyph"><Lock size={20} /></div>

      {staleWrap ? (
        <>
          <h2>Your journal is locked to your old password.</h2>
          <p>
            Your password changed without the journal moving with it — a password
            reset does this. The old wrapping is dead and we never had a copy of
            the key. Your recovery code still works, and it's the only thing that
            does.
          </p>
        </>
      ) : (
        <>
          <h2>Your journal is locked.</h2>
          <p>
            The key only ever lived in the last tab's memory. Nothing kept it —
            not this browser, not our server. That's the arrangement.
          </p>
        </>
      )}

      {mode === "recovery" && (
        <label className="jr-field">
          <span>Recovery code</span>
          <input
            className="jr-input jr-input-code"
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
      )}

      <label className="jr-field">
        <span>{mode === "recovery" ? "Current account password" : "Password"}</span>
        <PasswordField
          className="jr-input"
          autoFocus={mode === "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </label>

      {mode === "recovery" && (
        <p className="jr-fineprint">
          Unlocking with the code also re-wraps your journal under your current
          password, so next time the password is enough. Keep the code anyway.
        </p>
      )}

      {error && <div className="jr-error">{error}</div>}

      <button className="jr-primary" type="submit" disabled={busy || !password || (mode === "recovery" && !code)}>
        {busy ? "Unlocking…" : "Unlock"}
      </button>

      {!staleWrap && (
        <button
          type="button"
          className="jr-link"
          onClick={() => { setMode(mode === "password" ? "recovery" : "password"); setError(null); }}
        >
          {mode === "password" ? "Use my recovery code instead" : "Use my password instead"}
        </button>
      )}
    </form>
  );
}
