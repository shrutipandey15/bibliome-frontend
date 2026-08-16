import { useState, useEffect } from "react";
import {
  pushSupported, pushPermission, pushConfig, currentSubscription,
  enablePush, disablePush,
} from "../services/push";

/**
 * Turn Web Push on for THIS device [add-on to #6].
 *
 * Per-device, not per-account, and the copy says so — a reader who enables it on
 * their laptop and then wonders why their phone is silent has been misled by a
 * toggle that looked like a preference.
 *
 * The prompt only ever fires from the tap. Browsers refuse a permission request
 * raised on page load, and Safari treats a dismissed one as a permanent denial,
 * so there is no "ask on mount" path here at all.
 */
export default function PushToggle() {
  const [state, setState] = useState("checking");
  // checking | unsupported | unconfigured | blocked | off | on | working
  const [error, setError] = useState(null);

  useEffect(() => {
    let live = true;
    (async () => {
      if (!pushSupported()) { if (live) setState("unsupported"); return; }
      const { enabled } = await pushConfig().catch(() => ({ enabled: false }));
      if (!live) return;
      if (!enabled) { setState("unconfigured"); return; }
      if (pushPermission() === "denied") { setState("blocked"); return; }
      const sub = await currentSubscription();
      if (live) setState(sub ? "on" : "off");
    })();
    return () => { live = false; };
  }, []);

  const toggle = async () => {
    setError(null);
    const turningOn = state === "off";
    setState("working");
    try {
      if (turningOn) { await enablePush(); setState("on"); }
      else { await disablePush(); setState("off"); }
    } catch (e) {
      setError(e.message);
      // Re-read rather than assume: a refused prompt leaves the browser in a
      // state the component did not choose.
      setState(pushPermission() === "denied" ? "blocked" : turningOn ? "off" : "on");
    }
  };

  if (state === "checking") return null;

  if (state === "unsupported") {
    return (
      <p className="set-note">
        This browser can’t show notifications. On iPhone, add Bibliome to your
        home screen first — Safari only allows them for installed apps.
      </p>
    );
  }

  if (state === "unconfigured") {
    // Not the reader's problem to solve, so it is stated and not offered.
    return <p className="set-note">Push notifications aren’t set up on this server yet.</p>;
  }

  if (state === "blocked") {
    return (
      <p className="set-note">
        Notifications are blocked for this site. Browsers won’t let an app ask
        twice — you can turn them back on in your browser’s site settings.
      </p>
    );
  }

  return (
    <div className="set-row">
      <div>
        <div className="set-row-label">Push notifications</div>
        <div className="set-row-hint">
          A quiet knock on this device when someone writes in a collection you’re
          in. Never the message itself — you open the app to read it.
          {" "}Applies to this device only.
        </div>
      </div>
      <button
        className={`btn ${state === "on" ? "ghost" : "brass"}`}
        onClick={toggle}
        disabled={state === "working"}
      >
        {state === "working" ? "…" : state === "on" ? "turn off" : "turn on"}
      </button>
      {error && <p className="set-note" role="alert">{error}</p>}
    </div>
  );
}
