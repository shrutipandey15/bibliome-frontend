import { useEffect } from "react";
import { echoExtra, echoLine } from "./aliveCopy";
import "./EchoCard.css";

// How long the echo stays up. Longer than the 4s error toast: it's two lines the
// reader may want to finish, and nothing is waiting on them to dismiss it.
export const ECHO_MS = 6000;

/**
 * The echo: what the book you just saved did to your DNA. [DNA Aliveness · F1]
 *
 * Shown in place of the old silent close after a save. One line names the
 * archetype the book points to and how it sits against yours; at most one more
 * line says what else moved (a shift, a new season, a first, a leaning). The
 * backend decides all of it — this only renders the payload's `echo`.
 *
 * `role="status"` so a screen reader announces it politely; the archetype is
 * always written out, never carried by its colour alone.
 */
export default function EchoCard({ echo, onOpen, onDone, duration = ECHO_MS }) {
  useEffect(() => {
    if (!echo) return undefined;
    const t = setTimeout(() => onDone?.(), duration);
    return () => clearTimeout(t);
  }, [echo, duration, onDone]);

  const line = echoLine(echo);
  if (!line) return null;
  const extra = echoExtra(echo);
  const type = echo.book_type;

  return (
    <div className="echo-card" role="status" aria-live="polite" style={{ "--echo-c": type.color }}>
      <span className="echo-glyph" aria-hidden="true">{type.glyph}</span>
      <div className="echo-text">
        <p className="echo-line">{line}</p>
        {extra && <p className="echo-extra">{extra}</p>}
      </div>
      <div className="echo-actions">
        {onOpen && (
          <button type="button" className="echo-open" onClick={() => { onOpen(); onDone?.(); }}>
            See your DNA
          </button>
        )}
        <button type="button" className="echo-close" aria-label="Dismiss" onClick={() => onDone?.()}>×</button>
      </div>
    </div>
  );
}
