import { useEffect, useState } from "react";
import { getDigest } from "../services/api";

/**
 * The archetype's letter from a weekly digest, pinned above the DNA reading.
 * Arrives via `/?view=dna&letter=<period>` from the email. Renders nothing if
 * that week had no letter, rather than an empty frame.
 */
export default function DigestLetterPin({ period }) {
  const [letter, setLetter] = useState(null);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    let live = true;
    getDigest(period)
      .then((d) => { if (live) setLetter(d.sections.find((s) => s.kind === "archetype_letter") || null); })
      .catch(() => {});
    return () => { live = false; };
  }, [period]);

  if (!letter || closed) return null;
  return (
    <aside className="card editorial" style={{ padding: "22px 20px", marginBottom: 20, position: "relative" }}>
      <div className="label-sm" style={{ color: "var(--ink-quiet)", marginBottom: 10 }}>· {letter.title} ·</div>
      {letter.body.split("\n").filter(Boolean).map((line, i) => (
        <p key={i} style={{ margin: "0 0 10px", fontFamily: "var(--font-display)", fontSize: 18, lineHeight: 1.5 }}>{line}</p>
      ))}
      <button className="btn ghost" onClick={() => setClosed(true)} aria-label="Put the letter away">Put it away</button>
    </aside>
  );
}
