import { useState } from "react";
import { Check, Copy, Download, KeyRound, Lock } from "lucide-react";
import { useJournalKey } from "../../contexts/JournalKeyContext";
import PasswordField from "../PasswordField";
import { normalizeRecoveryCode } from "../../services/journalCrypto";

/**
 * First run — the gap the prototype left, and the only part of the journal that
 * is deliberately a wall.
 *
 * Three beats, in this order, for reasons:
 *
 *   1. what this is    — the claim, and its cost, before any secret is typed
 *   2. your password   — derives the wrapping key; nothing is sent yet
 *   3. the code        — shown once, confirmed by retyping, THEN committed
 *
 * Beat 3 is non-skippable and has no close button. Everywhere else in this
 * journal, friction is the enemy; here it is the product. A user who dismisses
 * this screen owns an encrypted journal with one live key and no backup, and
 * they'd find out months later, from a password reset, which is the worst
 * possible time to learn it.
 */
export default function JournalSetup({ onDone }) {
  const { prepareSetup, commitSetup } = useJournalKey();
  const [step, setStep] = useState("intro"); // intro | password | code
  const [password, setPassword] = useState("");
  const [prepared, setPrepared] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const derive = async (e) => {
    e.preventDefault();
    if (!password) return;
    setBusy(true);
    setError(null);
    try {
      // ~1s of PBKDF2. Deliberately not tuned down.
      setPrepared(await prepareSetup(password));
      setStep("code");
    } catch (err) {
      setError(err.message || "Couldn't set up the journal.");
    } finally {
      setBusy(false);
      setPassword("");
    }
  };

  if (step === "intro") {
    return (
      <div className="jr-setup">
        <div className="jr-setup-glyph"><Lock size={22} /></div>
        <h2>Your journal is encrypted before it leaves this device.</h2>
        <p>
          The words are sealed in your browser. What reaches our server is a blob
          we have no key for — not "we promise not to look," but no mechanism to.
        </p>
        <p>
          The emotions you tag a day with are <em>not</em> encrypted. That's the
          one deliberate exception: tags are what your DNA is built from, and
          they say nothing on their own.
        </p>
        <p className="jr-setup-cost">
          The cost is real: if you forget your password and lose your recovery
          code, the journal is gone. We can't recover it. Nobody can.
        </p>
        <button className="jr-primary" onClick={() => setStep("password")}>
          Set up the journal
        </button>
      </div>
    );
  }

  if (step === "password") {
    return (
      <form className="jr-setup" onSubmit={derive}>
        <div className="jr-setup-glyph"><KeyRound size={22} /></div>
        <h2>Your account password.</h2>
        <p>
          It never leaves this page — it's used here to derive the key that wraps
          your journal's key. We already have your password's hash for logging
          in; this is a different thing, computed locally, and not sent.
        </p>
        <PasswordField
          autoFocus
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="jr-input"
        />
        {error && <div className="jr-error">{error}</div>}
        <button className="jr-primary" type="submit" disabled={busy || !password}>
          {busy ? "Generating your key…" : "Continue"}
        </button>
      </form>
    );
  }

  return <RecoveryCodeStep prepared={prepared} onCommit={commitSetup} onDone={onDone} />;
}

/** Screen 4. Shown exactly once, in the only moment it can be shown at all. */
function RecoveryCodeStep({ prepared, onCommit, onDone }) {
  const code = prepared?.recoveryCode || "";
  const lastGroup = code.split("-").slice(-1)[0];
  const [copied, setCopied] = useState(false);
  const [typed, setTyped] = useState("");
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const typedOk = normalizeRecoveryCode(typed) === normalizeRecoveryCode(lastGroup);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't reach the clipboard — write it down instead.");
    }
  };

  const download = () => {
    // A Blob URL, built and revoked here. The code never touches the network.
    const body = `Bibliome journal recovery code\n\n${code}\n\n` +
      `This is the only backup key for your journal.\n` +
      `Anyone holding it can read your journal. We do not have a copy.\n`;
    const url = URL.createObjectURL(new Blob([body], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "bibliome-recovery-code.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const finish = async () => {
    setBusy(true);
    setError(null);
    try {
      await onCommit(prepared);
      onDone?.();
    } catch (err) {
      setError(err.message || "Couldn't finish setup.");
      setBusy(false);
    }
  };

  return (
    <div className="jr-setup jr-setup-code">
      <h2>This is the only other key.</h2>
      <p>
        If you ever reset your password, this code is the single thing that can
        open your journal again. There is no second copy — not on our server, not
        in a backup, not with support.
      </p>

      <div className="jr-code" role="figure" aria-label="Your recovery code">{code}</div>

      <div className="jr-code-actions">
        <button type="button" className="jr-ghost" onClick={copy}>
          {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Copied" : "Copy"}
        </button>
        <button type="button" className="jr-ghost" onClick={download}>
          <Download size={15} /> Download
        </button>
      </div>

      <label className="jr-confirm">
        <span>Type the last group to confirm you have it:</span>
        <input
          className="jr-input jr-input-code"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={"•".repeat(lastGroup.length)}
          maxLength={8}
          autoComplete="off"
          spellCheck={false}
        />
      </label>

      <label className="jr-ack">
        <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
        <span>
          I've saved this code somewhere I'll still have it in a year. I understand
          that without it, a password reset destroys my journal permanently.
        </span>
      </label>

      {error && <div className="jr-error">{error}</div>}

      <button className="jr-primary" onClick={finish} disabled={!typedOk || !ack || busy}>
        {busy ? "Creating your journal…" : "Open the journal"}
      </button>
      <p className="jr-fineprint">
        Your journal doesn't exist yet. It's created when you press this — after
        you have the code, not before.
      </p>
    </div>
  );
}
