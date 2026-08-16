import { useState, useEffect } from "react";
import { pushSupported, pushPermission, pushConfig, currentSubscription, enablePush } from "../services/push";
import "./PushPrompt.css";

const DISMISSED_KEY = "bibliome_push_asked";

/**
 * Ask for push once, where it makes sense [add-on to #6].
 *
 * "On by default" is not something a web app can do: the browser owns the
 * permission and only grants it from a real tap. So the next best thing is to
 * ask at the one moment the answer is obvious — the reader is standing in a
 * conversation with other people in it — rather than burying the control in
 * Settings and hoping.
 *
 * Asked ONCE. A dismissal is remembered forever, because the alternative is a
 * banner that reappears until it is obeyed. The Settings toggle remains the way
 * back for anyone who dismisses it and changes their mind.
 *
 * Never auto-prompts: the browser dialog opens from the tap on "Turn them on".
 * Prompting on mount is refused by Chrome and treated by Safari as a permanent
 * denial — which would cost the very users this is meant to reach.
 */
export default function PushPrompt() {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      if (!pushSupported()) return;
      // "granted" is handled silently elsewhere; "denied" cannot be re-asked.
      if (pushPermission() !== "default") return;
      try {
        if (localStorage.getItem(DISMISSED_KEY)) return;
      } catch { /* storage unavailable — ask, it is one banner */ }

      const { enabled } = await pushConfig().catch(() => ({ enabled: false }));
      if (!enabled || !live) return;
      if (await currentSubscription()) return;
      if (live) setShow(true);
    })();
    return () => { live = false; };
  }, []);

  const remember = () => {
    try { localStorage.setItem(DISMISSED_KEY, "1"); } catch { /* ignore */ }
    setShow(false);
  };

  const accept = async () => {
    setBusy(true);
    try {
      await enablePush();
    } catch {
      // Refused or unavailable. Either way this banner has had its one turn.
    } finally {
      remember();
    }
  };

  if (!show) return null;

  return (
    <div className="push-prompt" role="region" aria-label="Notifications">
      <p className="push-prompt-text">
        Want a nudge when someone writes here? We’ll only ever say that something
        happened — never what was said.
      </p>
      <div className="push-prompt-actions">
        <button className="btn brass" onClick={accept} disabled={busy}>
          {busy ? "…" : "Turn them on"}
        </button>
        <button className="push-prompt-no" onClick={remember} disabled={busy}>
          not now
        </button>
      </div>
    </div>
  );
}
