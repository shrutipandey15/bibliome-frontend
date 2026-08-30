import "./Register.css";

/**
 * The Register — one progress ledger for the whole account. [F7.4 successor]
 *
 * Folds the five life milestones and the DNA gates into a single list, split
 * earned / not-yet within two bands, with one "next" lifted out — the row
 * closest to earning. It lives on the DNA tab, below the mirror and beside the
 * Patterns fold, and replaces the old "NOT YET" list there and the milestones
 * rail on the profile: one place to see where you are.
 *
 * Renders the backend's `profile.register`:
 *   { warming, next, earned_count, total,
 *     bands: [ { key, label, earned:[row], ahead:[row] } ] }
 *   row = { kind, band, label, sub, achieved, achieved_at, have, need, unit }
 *
 * The caller (App's DNA tab) owns the collapsible <details> chrome and the
 * masthead, exactly as it does for <Patterns> — so this component is just the
 * body. `hideMasthead` is always true from there; it stays a prop so the
 * component is still usable standalone.
 *
 * PWA note: fed from `analytics.profile`, which JournalContext marks stale when
 * the tab was hidden >30s and refetches on visibility restore — current on every
 * resume of the installed app, no work here.
 */

const MONTH = { month: "short", year: "numeric" };
function whenEarned(iso) {
  if (!iso) return "reached";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "reached" : d.toLocaleDateString(undefined, MONTH);
}

/** A hairline measure — never a progress bar. 2px, the real figures underneath. */
function Measure({ have, need, unit, align = "end" }) {
  if (!Number.isFinite(have) || !Number.isFinite(need) || need <= 0) return null;
  const pct = Math.max(3, Math.min(100, Math.round((have / need) * 100)));
  return (
    <div className={`reg-measure reg-measure--${align}`}>
      <div className="reg-track">
        <div className="reg-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="reg-figs">
        {have} / {need}{unit ? ` ${unit}` : ""}
      </span>
    </div>
  );
}

function Row({ row }) {
  const earned = row.achieved;
  return (
    <li className={`reg-row${earned ? "" : " reg-row--ahead"}`}>
      <span className="reg-glyph" aria-hidden="true">{earned ? "✦" : "✧"}</span>
      <div className="reg-body">
        <div className="reg-name">{row.label}</div>
        {row.sub && <div className="reg-sub">{row.sub}</div>}
      </div>
      <div className="reg-status">
        {earned ? (
          <span className="reg-date">{whenEarned(row.achieved_at)}</span>
        ) : (
          <Measure have={row.have} need={row.need} unit={row.unit} />
        )}
      </div>
    </li>
  );
}

function Band({ band }) {
  const rows = [...band.earned, ...band.ahead];
  if (rows.length === 0) return null;
  return (
    <div className="reg-band">
      <div className="reg-band-head">
        <span>{band.label}</span>
        <span className="reg-band-count">
          {band.earned.length}{band.ahead.length ? ` of ${rows.length}` : ""}
        </span>
      </div>
      <ul className="reg-list">
        {rows.map((r) => <Row key={`${band.key}-${r.kind}`} row={r} />)}
      </ul>
    </div>
  );
}

function Next({ next }) {
  if (!next) return null;
  const remaining = Number.isFinite(next.have) && Number.isFinite(next.need)
    ? next.need - next.have
    : null;
  const unit = next.unit || "books";
  const gap = remaining != null
    ? `${remaining} ${remaining === 1 ? unit.replace(/s$/, "") : unit} to go`
    : "closest to earning";
  return (
    <div className="reg-next">
      <div className="reg-next-eyebrow">next · closest to earning</div>
      <div className="reg-next-row">
        <span className="reg-next-name">{next.label}</span>
        <span className="reg-next-gap">{gap}</span>
      </div>
      {next.sub && <p className="reg-next-why">{next.sub}</p>}
      <Measure have={next.have} need={next.need} unit={next.unit} align="start" />
    </div>
  );
}

export default function Register({ register, hideMasthead = false }) {
  if (!register || !register.bands) return null;

  const { bands, next, earned_count, total, warming } = register;
  if (earned_count === 0 && total === 0) return null;

  const tally = total > earned_count
    ? `${earned_count} of ${total} earned`
    : `${earned_count} earned`;

  return (
    <section className="pf-register">
      {!hideMasthead && (
        <div className="reg-masthead">
          <div>
            <div className="label reg-fig">fig. 04 · the register</div>
            <h2 className="reg-h">The <em>Register</em>.</h2>
          </div>
          <div className="label reg-tally">{tally}</div>
        </div>
      )}
      <p className="reg-dek">
        {warming
          ? "Everything your shelf has earned so far. The mirror is still warming up — the readings fill in once it has five books with a feeling."
          : "Everything your shelf has earned, and what it is still short of. Nothing here is a target; it is a record."}
      </p>
      <Next next={next} />
      {bands.map((b) => <Band key={b.key} band={b} />)}
    </section>
  );
}
