import { useEffect, useState } from "react";
import { getDigestClicks } from "../services/api";
import "./DigestClicks.css";

const NAMES = {
  past_self: "A line from your past self", archetype_letter: "Letter from your archetype",
  weather: "Shelf's weather", while_away: "While you weren't looking", emotion_of_week: "Feeling of the week",
  drift: "The drift", dna_waiting: "Your DNA is waiting", revealed: "You've been revealed",
  weekly_question: "Weekly question",
};
const pct = (n, d) => (d ? Math.round((100 * n) / d) : 0);

/**
 * Admin: the digest's success metric. For each section type, of the digests that
 * carried it, the share whose reader tapped through it; and the same when it led.
 * One series, so one hue and no legend; the numbers sit beside every bar.
 */
export default function DigestClicks() {
  const [weeks, setWeeks] = useState(8);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setData(null);
    getDigestClicks(weeks).then(setData).catch((e) => setError(e.kind || "error"));
  }, [weeks]);

  if (error) return <div className="admin-section">Couldn't load clicks ({error}).</div>;
  return (
    <div className="admin-section dc">
      <div className="dc-filter" role="group" aria-label="Time range">
        {[4, 8, 26].map((w) => (
          <button key={w} className={`dc-chip${w === weeks ? " is-on" : ""}`} aria-pressed={w === weeks} onClick={() => setWeeks(w)}>
            {w} weeks
          </button>
        ))}
      </div>
      {!data ? <p>Loading…</p> : !data.digests ? <p>No digests sent in the last {weeks} weeks yet.</p> : (
        <>
          <div className="dc-tiles">
            <div className="dc-tile"><span className="label-sm">digests sent</span><b>{data.digests}</b></div>
            <div className="dc-tile"><span className="label-sm">opened</span><b>{pct(data.opened, data.digests)}%</b><small>{data.opened} of {data.digests}</small></div>
          </div>
          <table className="dc-table">
            <caption className="label-sm">tapped through, by section</caption>
            <thead><tr><th scope="col">Section</th><th scope="col">Rate</th><th scope="col">When it led</th></tr></thead>
            <tbody>
              {data.sections.map((s) => {
                const r = pct(s.clicked, s.shown);
                return (
                  <tr key={s.kind} title={`${NAMES[s.kind] || s.kind}: ${s.clicked} of ${s.shown} digests tapped through`}>
                    <th scope="row">{NAMES[s.kind] || s.kind}</th>
                    <td>
                      <div className="dc-bar"><span style={{ width: `${r}%` }} /></div>
                      <span className="dc-val">{r}% <small>{s.clicked} of {s.shown}</small></span>
                    </td>
                    <td className="dc-led">{s.led ? <>{pct(s.led_clicked, s.led)}% <small>of {s.led}</small></> : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
