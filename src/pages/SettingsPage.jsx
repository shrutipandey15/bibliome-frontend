import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getSettings, updateSettings, generateShareToken, revokeShareTokens, changeHandle, getNotificationPrefs, updateNotificationPrefs, setReadFor } from "../services/api";
import { useJournalKey } from "../contexts/JournalKeyContext";
import ReadForQuestion from "../components/dna/ReadForQuestion";
import "./SettingsPage.css";

const SECTIONS = [
  { id: "profile",       label: "Profile",        glyph: "◐" },
  { id: "visibility",    label: "Visibility",     glyph: "◉" },
  { id: "notifications", label: "Notifications",  glyph: "◔" },
  { id: "account",       label: "Account",        glyph: "◈" },
  { id: "security",      label: "Security",       glyph: "✦" },
  { id: "data",          label: "Your data",      glyph: "◇" },
  { id: "danger",        label: "Danger zone",    glyph: "×" },
];

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const fmtHour = (h) => `${String(h).padStart(2, "0")}:00`;

// The 3-way profile_visibility control [F2.8 / B2.1]. Shelf, journal, and DNA are
// ALWAYS private — this governs only the profile page.
const VISIBILITY_OPTIONS = [
  { value: "private",   title: "Private",   desc: "Only you. Your profile page is visible to no one else." },
  { value: "community", title: "Community", desc: "Any signed-in member who visits your handle can see your profile." },
  { value: "public",    title: "Public",   desc: "Anyone on the web; indexable and shareable." },
];

export default function SettingsPage() {
  const { user, logout, refreshUser } = useAuth();
  const { changePasswordWithRewrap } = useJournalKey();
  const navigate = useNavigate();

  const [section, setSection] = useState("profile");
  const [displayName, setDisplayName] = useState("");
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [saving, setSaving] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const [toast, setToast] = useState(null);
  const [visibility, setVisibility] = useState(null);
  const [savingVis, setSavingVis] = useState(false);
  const [handle, setHandle] = useState("");
  const [savedHandle, setSavedHandle] = useState("");
  const [savingHandle, setSavingHandle] = useState(false);
  const [shareLink, setShareLink] = useState(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [prefs, setPrefs] = useState(null);
  const [prefsBusy, setPrefsBusy] = useState(false);
  const [readFor, setReadForState] = useState([]);
  const [savingReadFor, setSavingReadFor] = useState(false);

  const showToast = (message, type = "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    getSettings().then((s) => {
      if (s) {
        setDisplayName(s.display_name || "");
        setVisibility(s.profile_visibility || "private");
        setHandle(s.username || "");
        setSavedHandle(s.username || "");
        setReadForState(s.reads_for || []); // stated preference lives on /user/settings [F7.7]
      }
    });
  }, []);

  useEffect(() => {
    getNotificationPrefs().then((p) => { if (p) setPrefs(p); });
  }, []);

  const handleSaveReadFor = async (values) => {
    setSavingReadFor(true);
    try { await setReadFor(values); setReadForState(values); showToast("Saved what you read for.", "success"); }
    finally { setSavingReadFor(false); }
  };

  // Persist a partial prefs change optimistically; revert on failure.
  const savePrefs = async (patch) => {
    if (!prefs || prefsBusy) return;
    const prev = prefs;
    setPrefs({ ...prefs, ...patch }); // optimistic
    setPrefsBusy(true);
    try {
      const saved = await updateNotificationPrefs(patch);
      setPrefs(saved);
    } catch (err) {
      setPrefs(prev);
      showToast(err.message || "Couldn't update preferences");
    }
    setPrefsBusy(false);
  };

  const handleChangeHandle = async () => {
    const next = handle.trim();
    if (!next || next === savedHandle || savingHandle) return;
    setSavingHandle(true);
    try {
      await changeHandle(next);
      setSavedHandle(next);
      if (refreshUser) await refreshUser();
      showToast("Handle changed. Your old handle redirects for a short grace window.", "success");
    } catch (err) {
      setHandle(savedHandle); // revert
      showToast(err.message || "Couldn't change handle");
    }
    setSavingHandle(false);
  };

  const handleVisibility = async (next) => {
    if (next === visibility || savingVis) return;
    const prev = visibility;
    setVisibility(next); // optimistic
    setSavingVis(true);
    try {
      await updateSettings({ profile_visibility: next });
      showToast("Visibility updated", "success");
    } catch (err) {
      setVisibility(prev); // revert on failure
      showToast(err.message || "Couldn't update visibility");
    }
    setSavingVis(false);
  };

  const handleCreateShareLink = async () => {
    setShareBusy(true);
    try {
      const { share_token } = await generateShareToken();
      setShareLink(`${window.location.origin}/s/${share_token}`);
      showToast("Share link created", "success");
    } catch (err) { showToast(err.message || "Couldn't create link"); }
    setShareBusy(false);
  };

  const handleRevokeShareLinks = async () => {
    setShareBusy(true);
    try {
      await revokeShareTokens();
      setShareLink(null);
      showToast("All share links revoked", "success");
    } catch (err) { showToast(err.message || "Couldn't revoke links"); }
    setShareBusy(false);
  };

  const handleCopyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      showToast("Copied to clipboard", "success");
    } catch { showToast("Copy failed — select and copy manually"); }
  };

  const handleSaveProfile = async () => {
    if (!displayName.trim()) return;
    setSaving(true);
    try {
      await updateSettings({ display_name: displayName.trim() });
      if (refreshUser) await refreshUser();
      showToast("Profile updated", "success");
    } catch (err) { showToast(err.message); }
    setSaving(false);
  };

  const handleChangePassword = async () => {
    if (!currentPw || !newPw) return;
    if (newPw.length < 8) { showToast("New password must be at least 8 characters"); return; }
    if (newPw !== confirmPw) { showToast("Passwords don't match"); return; }
    setChangingPw(true);
    try {
      // Not the bare changePassword(): the journal's key is wrapped under the
      // OLD password, and the server cannot re-wrap it (it has neither key). The
      // client re-wraps locally and both writes land in one transaction, so
      // there's no window where the stored wrap and the password disagree.
      // [journalCryptoContract.md §5]
      const result = await changePasswordWithRewrap(currentPw, newPw);
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
      if (result?.journal && result.journal.rewrapped === false) {
        // The journal was locked, so there was no key in memory to re-wrap. The
        // password changed anyway; the journal now needs the recovery code. Say
        // so rather than letting them find out at the lock screen.
        showToast(
          "Password changed — but your journal was locked, so it stayed on the old password. Unlock it with your recovery code.",
          "error"
        );
      } else {
        showToast("Password changed", "success");
      }
    } catch (err) { showToast(err.message); }
    setChangingPw(false);
  };

  const handleLogout = async () => {
    // logout() revokes the refresh cookie server-side and clears local state
    // (including the cache). Navigate once it's done.
    await logout();
    navigate("/");
  };

  return (
    <div className="set-page">
      <div className="set-header">
        <button className="btn ghost" onClick={() => navigate("/")} style={{ fontSize: 12 }}>← back to shelf</button>
        <div>
          <div className="label" style={{ marginBottom: 6 }}>· housekeeping ·</div>
          <h1 className="set-h1">The <em>Drawer</em>.</h1>
        </div>
        <div className="set-header-stat">
          <div className="label-sm">member since</div>
          <div className="set-stat-val">{user?.created_at ? new Date(user.created_at).getFullYear() : "—"}</div>
        </div>
      </div>
      <div className="rule-dbl" style={{ marginBottom: 24 }} />

      <div className="set-grid">
        {/* RAIL */}
        <nav className="set-rail">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              className={`set-rail-item ${section === s.id ? "active" : ""}`}
              onClick={() => setSection(s.id)}
            >
              <span className="set-rail-glyph">{s.glyph}</span>
              <span>{s.label}</span>
            </button>
          ))}
          {user?.is_admin && (
            <button className="set-rail-item" onClick={() => navigate("/admin")}>
              <span className="set-rail-glyph">‡</span>
              <span>Admin</span>
            </button>
          )}
        </nav>

        {/* BODY */}
        <div className="set-body">
          {section === "profile" && (
            <div className="card editorial set-card">
              <div className="label" style={{ marginBottom: 12 }}>profile</div>
              <h3 className="set-card-h">How the world sees you.</h3>
              <div className="set-field">
                <div className="label-sm set-field-label">display name</div>
                <input
                  className="set-input"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your display name"
                  maxLength={100}
                />
              </div>
              <button className="btn brass" onClick={handleSaveProfile} disabled={saving || !displayName.trim()}>
                <span style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 15 }}>
                  {saving ? "Saving" : "Save"}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.18em" }}>PROFILE</span>
              </button>

              <div className="rule" style={{ margin: "24px 0" }} />

              {/* Pseudonymous public handle [F3.1 / B3.1] */}
              <div className="set-field">
                <div className="label-sm set-field-label">public handle</div>
                <input
                  className="set-input"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  placeholder="your-handle"
                  maxLength={50}
                  aria-label="Public handle"
                />
                <p className="set-card-d" style={{ marginTop: 8, fontSize: 13 }}>
                  The only name others see on your echoes. Changing it is rate-limited; your old
                  handle keeps resolving for a short "previously known as" grace window.
                </p>
              </div>
              <button className="btn ghost" onClick={handleChangeHandle} disabled={savingHandle || !handle.trim() || handle.trim() === savedHandle}>
                {savingHandle ? "changing…" : "change handle"}
              </button>

              <div className="rule" style={{ margin: "24px 0" }} />

              {/* What you read for — feeds the stated-vs-revealed insight class. [F7.7] */}
              <ReadForQuestion
                value={readFor}
                onSave={handleSaveReadFor}
                saving={savingReadFor}
                embedded
              />
            </div>
          )}

          {section === "visibility" && (
            <div className="card editorial set-card">
              <div className="label" style={{ marginBottom: 12 }}>visibility</div>
              <h3 className="set-card-h">Who can find you.</h3>
              <p className="set-card-d">
                Your shelf, journal, and DNA are <em>always</em> private. This governs only your profile page.
              </p>

              <div className="set-vis" role="radiogroup" aria-label="Profile visibility">
                {VISIBILITY_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`set-vis-opt ${visibility === opt.value ? "active" : ""}`}
                  >
                    <input
                      type="radio"
                      name="profile-visibility"
                      value={opt.value}
                      checked={visibility === opt.value}
                      disabled={savingVis || visibility === null}
                      onChange={() => handleVisibility(opt.value)}
                    />
                    <span className="set-vis-body">
                      <span className="set-vis-title">{opt.title}</span>
                      <span className="set-vis-desc">{opt.desc}</span>
                    </span>
                  </label>
                ))}
              </div>

              <div className="rule" style={{ margin: "24px 0" }} />

              <div className="label" style={{ marginBottom: 8 }}>share link</div>
              <p className="set-card-d">
                A private, revocable link to your profile card — it works regardless of the setting above.
                The link is shown once; store it somewhere safe.
              </p>

              {shareLink && (
                <div className="set-share-out">
                  <input
                    className="set-input"
                    readOnly
                    value={shareLink}
                    aria-label="Your share link"
                    onFocus={(e) => e.target.select()}
                  />
                  <button className="btn ghost" onClick={handleCopyShareLink}>copy</button>
                </div>
              )}

              <div className="set-share-actions">
                <button className="btn brass" onClick={handleCreateShareLink} disabled={shareBusy}>
                  {shareBusy ? "Working" : "Create a link"}
                </button>
                <button className="btn ghost" onClick={handleRevokeShareLinks} disabled={shareBusy}>
                  Revoke all links
                </button>
              </div>
            </div>
          )}

          {section === "notifications" && (
            <div className="card editorial set-card">
              <div className="label" style={{ marginBottom: 12 }}>notifications</div>
              <h3 className="set-card-h">Calm by default.</h3>
              <p className="set-card-d">
                Nothing per-event or guilt-based. A weekly digest, and batched notices when
                someone replies to your echoes. Security alerts always come through.
              </p>

              {!prefs ? (
                <div className="set-card-d">loading…</div>
              ) : (
                <>
                  <Toggle
                    label="Replies to your echoes"
                    hint="Batched — 'three readers replied', not three pings."
                    checked={prefs.reply_enabled}
                    disabled={prefsBusy}
                    onChange={(v) => savePrefs({ reply_enabled: v })}
                  />
                  <Toggle
                    label="Weekly reading digest"
                    hint="Your reading week + a resurfaced memory, once a week."
                    checked={prefs.digest_enabled}
                    disabled={prefsBusy}
                    onChange={(v) => savePrefs({ digest_enabled: v })}
                  />

                  <div className="rule" style={{ margin: "20px 0" }} />

                  <div className="label-sm set-field-label">quiet hours</div>
                  <p className="set-card-d" style={{ fontSize: 13, marginTop: 4 }}>
                    Non-urgent notifications wait until quiet hours end.
                  </p>
                  <div className="set-quiet">
                    <label className="set-quiet-field">
                      <span className="label-sm">from</span>
                      <select
                        className="set-input"
                        value={prefs.quiet_hours_start ?? ""}
                        disabled={prefsBusy}
                        onChange={(e) => savePrefs({ quiet_hours_start: e.target.value === "" ? null : Number(e.target.value) })}
                      >
                        <option value="">off</option>
                        {HOURS.map((h) => <option key={h} value={h}>{fmtHour(h)}</option>)}
                      </select>
                    </label>
                    <label className="set-quiet-field">
                      <span className="label-sm">to</span>
                      <select
                        className="set-input"
                        value={prefs.quiet_hours_end ?? ""}
                        disabled={prefsBusy}
                        onChange={(e) => savePrefs({ quiet_hours_end: e.target.value === "" ? null : Number(e.target.value) })}
                      >
                        <option value="">off</option>
                        {HOURS.map((h) => <option key={h} value={h}>{fmtHour(h)}</option>)}
                      </select>
                    </label>
                  </div>

                  <div className="set-field" style={{ marginTop: 16 }}>
                    <div className="label-sm set-field-label">timezone</div>
                    <input
                      className="set-input"
                      value={prefs.timezone || ""}
                      disabled={prefsBusy}
                      placeholder="e.g. America/New_York"
                      onBlur={(e) => { const tz = e.target.value.trim(); if (tz && tz !== prefs.timezone) savePrefs({ timezone: tz }); }}
                      onChange={(e) => setPrefs({ ...prefs, timezone: e.target.value })}
                    />
                  </div>

                  <div className="rule" style={{ margin: "20px 0" }} />
                  <button
                    className="btn ghost"
                    disabled={prefsBusy}
                    onClick={() => savePrefs({ reply_enabled: false, digest_enabled: true })}
                  >
                    ◔ fewer notifications — weekly digest only
                  </button>
                </>
              )}
            </div>
          )}

          {section === "account" && (
            <div className="card editorial set-card">
              <div className="label" style={{ marginBottom: 12 }}>account</div>
              <h3 className="set-card-h">The boring particulars.</h3>
              <Field label="username" value={user?.username || "—"} />
              <Field label="email"    value={user?.email || "—"} />
              <Field label="reading personality" value={user?.personality_type || "not generated yet"} />
            </div>
          )}

          {section === "security" && (
            <div className="card editorial set-card">
              <div className="label" style={{ marginBottom: 12 }}>change password</div>
              <h3 className="set-card-h">Write a new key.</h3>
              <div className="set-field">
                <div className="label-sm set-field-label">current password</div>
                <input className="set-input" type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} placeholder="your current key" />
              </div>
              <div className="set-field">
                <div className="label-sm set-field-label">new password</div>
                <input className="set-input" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="min 8 chars" />
              </div>
              <div className="set-field">
                <div className="label-sm set-field-label">confirm</div>
                <input className="set-input" type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="and again" />
              </div>
              <button className="btn brass" onClick={handleChangePassword} disabled={changingPw || !currentPw || !newPw || !confirmPw}>
                <span style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 15 }}>
                  {changingPw ? "Writing" : "Change"}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.18em" }}>PASSWORD</span>
              </button>
            </div>
          )}

          {section === "data" && (
            <div className="card editorial set-card">
              <div className="label" style={{ marginBottom: 12 }}>your data</div>
              <h3 className="set-card-h">Yours — fully.</h3>
              <p className="set-card-d">
                No ads. No selling. No third-party tracking. The shelf is private by default.
              </p>
              <p className="set-card-d">
                Public echoes are explicitly opt-in, per entry.
              </p>
            </div>
          )}

          {section === "danger" && (
            <div className="card editorial set-card set-danger">
              <div className="label" style={{ marginBottom: 12, color: "var(--oxblood)" }}>danger zone</div>
              <h3 className="set-card-h">Close the drawer.</h3>
              <p className="set-card-d">Signing out clears your local cache.</p>
              <button className="btn oxblood" onClick={handleLogout}>sign out</button>
            </div>
          )}
        </div>
      </div>

      {toast && <div className={`toast toast-${toast.type}`} onClick={() => setToast(null)}>{toast.message}</div>}
    </div>
  );
}

function Toggle({ label, hint, checked, disabled, onChange }) {
  return (
    <label className="set-toggle">
      <span className="set-toggle-text">
        <span className="set-toggle-label">{label}</span>
        {hint && <span className="set-toggle-hint">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        className={`set-switch ${checked ? "on" : ""}`}
        onClick={() => onChange(!checked)}
      >
        <span className="set-switch-knob" />
      </button>
    </label>
  );
}

function Field({ label, value }) {
  return (
    <div className="set-field">
      <div className="label-sm set-field-label">{label}</div>
      <div className="set-field-value">{value}</div>
    </div>
  );
}
