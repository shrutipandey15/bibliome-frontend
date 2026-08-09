import { useState, useId } from "react";
import { Eye, EyeOff } from "lucide-react";
import "./PasswordField.css";

/**
 * A password input you can read back.
 *
 * Every password field in the app was a bare `type="password"` with no way to
 * see what you had typed — which is worst exactly where it matters most: setting
 * a new one, confirming it, and unlocking a journal whose data is unrecoverable
 * if the password is wrong. Typing a passphrase blind and being told only
 * afterwards that the two didn't match is a bad trade for a threat model
 * (someone reading your screen) the user is better placed to judge than we are.
 *
 * Wraps the input rather than replacing it, so every caller keeps its own
 * `className`, autocomplete and validation attributes — the styling of these
 * fields differs per surface and none of it needed to change.
 *
 * Revealed state is deliberately NOT sticky across mounts: it resets to hidden
 * every time, so a shoulder-surf risk taken once doesn't follow the reader into
 * the next form.
 */
export default function PasswordField({ className = "", inputRef, ...props }) {
  const [shown, setShown] = useState(false);
  const hintId = useId();

  return (
    <div className="pwf">
      <input
        {...props}
        ref={inputRef}
        className={`${className} pwf-input`.trim()}
        type={shown ? "text" : "password"}
        aria-describedby={hintId}
      />
      <button
        type="button"
        className="pwf-toggle"
        onClick={() => setShown((v) => !v)}
        // The control's own name changes with state, so a screen reader hears
        // what pressing it will do rather than what it did.
        aria-label={shown ? "Hide password" : "Show password"}
        aria-pressed={shown}
        title={shown ? "Hide password" : "Show password"}
        // Never in the tab order between the field and the submit button —
        // Tab from the password should reach the button that uses it.
        tabIndex={-1}
      >
        {shown ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
      <span id={hintId} className="pwf-sr">
        {shown ? "Password is visible on screen." : "Password is hidden."}
      </span>
    </div>
  );
}
