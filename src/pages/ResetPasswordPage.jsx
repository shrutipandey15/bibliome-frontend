import { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import "./ResetPassword.css";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

const STEPS = [
  { n: "01", t: "Find you",       d: "Tell us the email tied to your shelf." },
  { n: "02", t: "Check your mail", d: "We'll send a single-use link. Valid for one hour." },
  { n: "03", t: "Write a new key", d: "Choose a password worth the shelf it opens." },
];

function Wordmark() {
  return <div className="rp-wordmark">Biblio<em>me</em></div>;
}

function Triptych({ activeIdx, children }) {
  return (
    <div className="rp-page">
      <div className="rp-card">
        <div className="rp-card-head">
          <Wordmark />
          <div className="label">· reset password ·</div>
        </div>
        <div className="rule-dbl" style={{ marginBottom: 28 }} />
        <div className="rp-triptych">
          {STEPS.map((s, i) => (
            <div key={s.n} className={`rp-col ${i === activeIdx ? "active" : "dim"}`}>
              <div className="rp-col-num">{s.n}</div>
              <h3 className="rp-col-t">{s.t}</h3>
              <p className="rp-col-d">{s.d}</p>
              {i === activeIdx && <div className="rp-col-body">{children}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token");
  return token ? <ResetForm token={token} /> : <ForgotForm />;
}

function ForgotForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) setSent(true);
      else {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || "Something went wrong.");
      }
    } catch { setError("Could not reach the server."); }
    setLoading(false);
  };

  if (sent) {
    return (
      <Triptych activeIdx={1}>
        <div className="rp-success-glyph">✦</div>
        <p className="rp-success-text">
          If that email is in our ledger, a reset link is on its way.
        </p>
        <Link to="/" className="btn ghost rp-back">back to login</Link>
      </Triptych>
    );
  }

  return (
    <Triptych activeIdx={0}>
      <form onSubmit={handleSubmit}>
        <div className="label-sm rp-field-label">email</div>
        <input
          className="rp-input"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        {error && <div className="rp-error">{error}</div>}
        <button type="submit" disabled={loading} className="btn brass rp-submit">
          <span style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 16 }}>
            {loading ? "Sending" : "Send"}
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.18em" }}>RESET LINK</span>
        </button>
        <Link to="/" className="rp-link-italic">← back to login</Link>
      </form>
    </Triptych>
  );
}

function ResetForm({ token }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // What the server says about the journal once the reset lands. Shape:
  // { locked, recoverable_with_recovery_code, message } — present only if this
  // account had a journal. [journalCryptoContract.md §5]
  const [journal, setJournal] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords don't match."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: password }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setJournal(data.journal || null);
        setDone(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || "Reset failed.");
      }
    } catch { setError("Could not reach the server."); }
    setLoading(false);
  };

  if (done) {
    return (
      <Triptych activeIdx={2}>
        <div className="rp-success-glyph">◈</div>
        <p className="rp-success-text">Password rewritten. The shelf is yours again.</p>
        {/* The shelf came back; the journal did not, and saying so here is the
            whole point of the trade. The reset token proved control of an inbox,
            not knowledge of the old password — and the old password is what the
            journal's key was wrapped under. We never had a copy to restore. */}
        {journal?.locked && (
          <p className="rp-journal-warning">
            {journal.message || "Your journal was encrypted with your old password."}
            {journal.recoverable_with_recovery_code
              ? " Your recovery code still opens it — nothing else does."
              : " Without your recovery code it cannot be opened again."}
          </p>
        )}
        <Link to="/" className="btn brass rp-submit">
          <span style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 16 }}>Sign</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.18em" }}>IN</span>
        </Link>
      </Triptych>
    );
  }

  return (
    <Triptych activeIdx={2}>
      <form onSubmit={handleSubmit}>
        <div className="label-sm rp-field-label">new password</div>
        <input
          className="rp-input"
          type="password"
          placeholder="min 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required minLength={8}
          autoComplete="new-password"
        />
        <div className="label-sm rp-field-label" style={{ marginTop: 14 }}>confirm</div>
        <input
          className="rp-input"
          type="password"
          placeholder="and again"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required autoComplete="new-password"
        />
        {/* Said BEFORE the button, not after the fact. This page is
            unauthenticated, so we can't know whether this account has a journal
            without leaking that it does — hence the conditional phrasing. The
            consequence is unconditional and irreversible, so it goes above the
            action that causes it. */}
        <p className="rp-journal-warning">
          If you set up an encrypted journal, this will lock it. Its key was
          wrapped with your old password and we never held a copy — after this,
          only your recovery code can open it. There is no third path.
        </p>
        {error && <div className="rp-error">{error}</div>}
        <button type="submit" disabled={loading} className="btn brass rp-submit">
          <span style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 16 }}>
            {loading ? "Writing" : "Write"}
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.18em" }}>NEW KEY</span>
        </button>
      </form>
    </Triptych>
  );
}
