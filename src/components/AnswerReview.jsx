import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { getPendingAnswers, reviewAnswer } from "../services/api";

/**
 * Admin: shared weekly-question notes waiting to be read before anyone else
 * sees them. No reader is named here either: a note is judged on what it says.
 */
export default function AnswerReview() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getPendingAnswers().then(setItems).catch((e) => setError(e.kind || "error"));
  }, []);

  const decide = async (id, approve) => {
    await reviewAnswer(id, approve);
    setItems((xs) => xs.filter((x) => x.id !== id));
  };

  if (error) return <div className="admin-section">Couldn't load answers ({error}).</div>;
  if (!items) return <div className="admin-section">Loading…</div>;
  if (!items.length) return <div className="admin-section">Nothing waiting. Every shared note has been read.</div>;
  return (
    <div className="admin-section">
      {items.map((a) => (
        <div key={a.id} className="card" style={{ marginBottom: 12, display: "grid", gap: 6 }}>
          <div className="label-sm">{a.period} · {a.question}</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 18 }}>{a.note}</div>
          {a.book_title && <div style={{ fontSize: 13, color: "var(--ink-quiet)" }}>on {a.book_title}</div>}
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <button className="btn brass" onClick={() => decide(a.id, true)}><Check size={14} /> Approve</button>
            <button className="btn ghost" onClick={() => decide(a.id, false)}><X size={14} /> Reject</button>
          </div>
        </div>
      ))}
    </div>
  );
}
