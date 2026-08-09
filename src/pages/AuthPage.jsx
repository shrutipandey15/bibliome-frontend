import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import PasswordField from "../components/PasswordField";
import "./AuthPage.css";

function passwordStrength(pw) {
  if (!pw) return { score: 0, label: "", color: "" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  const levels = [
    { label: "", color: "var(--rule)" },
    { label: "kindling", color: "var(--oxblood)" },
    { label: "fair", color: "#c47a3a" },
    { label: "good", color: "var(--brass)" },
    { label: "solid as oak", color: "var(--moss)" },
    { label: "ironwood", color: "#5a8b6f" },
  ];
  return { score, ...levels[score] };
}

export default function AuthPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef(null);

  const startCooldown = (seconds) => {
    setCooldown(seconds);
    clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) { clearInterval(cooldownRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const validate = () => {
    if (mode === "register") {
      if (!username.trim() || username.length < 3) return "Username must be at least 3 characters";
      if (!/^[a-zA-Z0-9_-]+$/.test(username)) return "Username: letters, numbers, _ and - only";
      if (password.length < 8) return "Password must be at least 8 characters";
      const s = passwordStrength(password);
      if (s.score < 2) return "Password is too weak. Add uppercase, numbers, or symbols.";
    }
    if (!email.includes("@") || !email.includes(".")) return "Please enter a valid email";
    return null;
  };

  const submit = async (e) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    setError("");
    setLoading(true);
    try {
      // register auto-logs-in (returns tokens + user, sets the refresh cookie),
      // so we never need a second login round-trip. [authCookieContract.md]
      if (mode === "register") {
        await register(email.toLowerCase().trim(), username.trim(), password, displayName.trim() || undefined);
      } else {
        await login(email.toLowerCase().trim(), password);
      }
    } catch (err) {
      const msg = err.message || "Something went wrong";
      setError(msg);
      const minuteMatch = msg.match(/(\d+)\s*minute/);
      if (minuteMatch) startCooldown(parseInt(minuteMatch[1]) * 60);
      else if (msg.includes("Too many")) startCooldown(60);
    } finally {
      setLoading(false);
    }
  };

  const strength = mode === "register" ? passwordStrength(password) : null;
  const isDisabled = loading || cooldown > 0;
  const isLogin = mode === "login";

  return (
    <div className="auth-rr">
      <div className="auth-rr-left">
        <div className="auth-rr-brand">
          Biblio<em>me</em>
        </div>
        <div>
          <h1 className="auth-rr-h1">
            {isLogin ? <>Welcome back<br /><em>to your shelf.</em></> : <>Begin your<br /><em>private shelf.</em></>}
          </h1>
          <p className="auth-rr-dek">
            {isLogin
              ? "Your shelf is where you left it — a private record of what books did to you, and the portrait they add up to."
              : "A slow, small ritual. Log what books did to you — not ratings, but the actual weather. We'll map the patterns into a portrait of who you've become as a reader."}
          </p>

          <div className="auth-rr-echo">
            <div className="auth-rr-echo-label">ECHO OF THE DAY</div>
            <div className="auth-rr-echo-quote">
              “Read this entire book on a train and missed my stop twice.”
            </div>
            <div className="label-sm auth-rr-echo-by">— @arun.d · Tomorrow ×3</div>
          </div>
        </div>
        <div className="auth-rr-foot">BIBLIOME · ESTD. 2024 · A PRIVATE READER'S LEDGER</div>
      </div>

      <div className="auth-rr-right">
        <div className="auth-rr-form">
          <div className="label auth-rr-eyebrow">{isLogin ? "· return to your shelf ·" : "· begin your shelf ·"}</div>
          <h2 className="auth-rr-h2">
            {isLogin ? <>Sign <em>in</em>.</> : <>Create <em>account</em>.</>}
          </h2>

          <form onSubmit={submit}>
            {!isLogin && (
              <>
                <div className="auth-rr-field">
                  <div className="label-sm auth-rr-fl">username</div>
                  <input
                    className="auth-rr-input"
                    type="text"
                    placeholder="letters, numbers, _ and -"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
                    required minLength={3} maxLength={50}
                    autoComplete="username"
                  />
                </div>
                <div className="auth-rr-field">
                  <div className="label-sm auth-rr-fl">display name <span style={{ fontStyle: "italic" }}>(optional)</span></div>
                  <input
                    className="auth-rr-input"
                    type="text"
                    placeholder="how the world sees you"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    maxLength={100}
                  />
                </div>
              </>
            )}

            <div className="auth-rr-field">
              <div className="label-sm auth-rr-fl">email</div>
              <input
                className="auth-rr-input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required autoComplete="email"
              />
            </div>

            <div className="auth-rr-field">
              <div className="label-sm auth-rr-fl">password</div>
              <PasswordField
                className="auth-rr-input"
                placeholder={isLogin ? "your key" : "min 8 chars"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required minLength={isLogin ? 1 : 8}
                autoComplete={isLogin ? "current-password" : "new-password"}
              />
              {strength && password.length > 0 && (
                <div className="auth-rr-strength">
                  <div className="auth-rr-strength-segs">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className="auth-rr-strength-seg"
                        style={{ background: i <= strength.score ? strength.color : "var(--rule-soft)" }}
                      />
                    ))}
                  </div>
                  <div className="label-sm auth-rr-strength-label" style={{ color: strength.color }}>
                    strength · {strength.label || "—"}
                  </div>
                </div>
              )}
            </div>

            {error && <div className="auth-rr-error">{error}</div>}
            {cooldown > 0 && (
              <div className="auth-rr-cooldown">
                Locked out. Try again in {Math.ceil(cooldown / 60)}:{String(cooldown % 60).padStart(2, "0")}
              </div>
            )}

            <button type="submit" className="btn brass auth-rr-submit" disabled={isDisabled}>
              <span style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 17 }}>
                {loading ? "Reading" : cooldown > 0 ? "Locked" : isLogin ? "Enter" : "Begin"}
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.2em" }}>YOUR SHELF</span>
            </button>
          </form>

          <div className="auth-rr-links">
            <Link to="/reset-password" className="auth-rr-link-italic">forgot password →</Link>
            <a
              className="auth-rr-link-italic"
              role="button"
              onClick={() => {
                setMode(isLogin ? "register" : "login");
                setError("");
                setPassword("");
              }}
            >
              {isLogin ? "new here? create account →" : "have an account? sign in →"}
            </a>
          </div>

          <div className="auth-rr-trust">
            <div className="auth-rr-trust-dot">✦</div>
            <div className="auth-rr-trust-text">No ads, no tracking, no feeds. Your shelf is yours.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
