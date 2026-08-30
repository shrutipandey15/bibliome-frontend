import { EMOTIONS } from "../../services/emotions";

/**
 * Builds the Register structure the <Register> component renders, from data the
 * DNA tab already has on hand — no extra fetch:
 *
 *   entries  — the full shelf (JournalContext), for the five life milestones
 *   dna      — the /dna/profile payload (analytics.profile), for the gated
 *              readings: it carries `earned` and `locked` rows verbatim
 *
 * Kept as a pure function (not folded into the component) so the milestone
 * predicates and the proximity sort are unit-testable without a render.
 *
 * The milestone predicates mirror app/services/profile_service.compute_milestones;
 * the reading labels/reasons come straight off the DNA payload, which mirrors
 * app/services/dna_insights.GATE_LABELS / GATE_OPENS / UNLOCK_UNITS.
 */

const MONTH_MS = 2629800000; // average month, for "N months in"
const YEAR_MS = 365 * 86400000;

// Order the readings the same way the backend's CATEGORY_ORDER does.
const READING_ORDER = [
  "contradiction", "blind_spot", "drift", "intensity_signature", "pairing",
  "abandonment", "dnf_reason", "range", "arc", "seasonality",
];

const MILESTONES = [
  {
    kind: "first_book",
    label: "Logged your first book",
    opens: "the shelf began",
    req: "shelve a book",
    need: 1, unit: "book",
  },
  {
    kind: "first_finish",
    label: "Completed a full emotional arc",
    opens: "your first finish through all three beats — beginning, middle, end",
    req: "finish a book and say how it left you",
    need: 1, unit: "finish",
  },
  {
    kind: "deep_range",
    label: "Felt across 10+ emotional registers",
    opens: "opened Blind spot — a gap in your reading starts to mean something",
    req: "record 10 different feelings",
    need: 10, unit: "registers",
  },
  {
    kind: "full_spectrum",
    label: `Read across all ${Object.keys(EMOTIONS).length || 18} emotional registers`,
    opens: "you've reached for every feeling in the vocabulary at least once",
    req: "record every feeling in the vocabulary",
    need: Object.keys(EMOTIONS).length || 18, unit: "registers",
  },
  {
    kind: "year_of_reflection",
    label: "A year of consistent reflection",
    opens: "a full year of you, on the shelf",
    req: "a full year between your first entry and your latest",
    need: 12, unit: "months",
  },
];

function milestoneRows(entries) {
  const sorted = [...entries]
    .filter((e) => e.created_at)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const first = sorted.length ? new Date(sorted[0].created_at) : null;
  const last = sorted.length ? new Date(sorted[sorted.length - 1].created_at) : null;

  const tagged = new Set();
  let finishes = 0;
  const at = {};
  const stamp = (k, when) => { if (!(k in at)) at[k] = when; };

  for (const e of sorted) {
    const when = e.created_at;
    stamp("first_book", when);
    (e.emotions || []).forEach((em) => {
      if (em.emotion_id && EMOTIONS[em.emotion_id]) tagged.add(em.emotion_id);
    });
    if (e.arc_start_emotion_id || e.finish_thought) {
      finishes += 1;
      stamp("first_finish", when);
    }
    if (tagged.size >= 10) stamp("deep_range", when);
    if (tagged.size >= (Object.keys(EMOTIONS).length || 18)) stamp("full_spectrum", when);
    if (first && new Date(when) - first >= YEAR_MS) stamp("year_of_reflection", when);
  }

  const monthsIn = first && last ? Math.max(0, Math.floor((last - first) / MONTH_MS)) : 0;
  const have = {
    first_book: Math.min(1, entries.length),
    first_finish: Math.min(1, finishes),
    deep_range: tagged.size,
    full_spectrum: tagged.size,
    year_of_reflection: monthsIn,
  };

  return MILESTONES.map((m) => {
    const achieved = m.kind in at;
    return {
      kind: m.kind,
      band: "milestone",
      label: m.label,
      sub: achieved ? m.opens : m.req,
      achieved,
      achieved_at: at[m.kind] || null,
      have: have[m.kind],
      need: m.need,
      unit: m.unit,
    };
  });
}

function readingRows(dna) {
  const enough = !!(dna && dna.enough);
  const tagged = (dna && dna.tagged_count) || 0;

  const rows = [{
    kind: "dna_ready",
    band: "reading",
    label: "The mirror can read you",
    sub: enough
      ? "five opened books with a feeling — the DNA is reading you"
      : "five opened books with a feeling — the DNA starts computing",
    achieved: enough,
    achieved_at: null,
    have: tagged,
    need: 5,
    unit: "books",
  }];
  if (!enough) return rows;

  const earned = new Map((dna.earned || []).map((e) => [e.category, e]));
  const locked = new Map((dna.locked || []).map((l) => [l.category, l]));

  for (const cat of READING_ORDER) {
    if (earned.has(cat)) {
      const e = earned.get(cat);
      rows.push({
        kind: cat, band: "reading", label: e.label, sub: e.opens || "",
        achieved: true, achieved_at: null,
        have: Number.isFinite(e.have) ? e.have : null,
        need: Number.isFinite(e.need) ? e.need : null,
      });
    } else if (locked.has(cat)) {
      const l = locked.get(cat);
      rows.push({
        kind: cat, band: "reading", label: l.label,
        sub: l.reason || l.unlocks_at || "",
        achieved: false, achieved_at: null,
        have: Number.isFinite(l.have) ? l.have : null,
        need: Number.isFinite(l.need) ? l.need : null,
        unit: cat === "seasonality" ? "months" : undefined,
      });
    }
    // A gate in neither list (rendered as an insight this visit) is still
    // earned — the payload just didn't echo it. Treat "not locked" as earned.
    else if (READING_LABELS[cat]) {
      rows.push({
        kind: cat, band: "reading", label: READING_LABELS[cat].label,
        sub: READING_LABELS[cat].opens, achieved: true, achieved_at: null,
        have: null, need: null,
      });
    }
  }
  return rows;
}

// Fallback names for a gate the DNA payload echoed in neither `earned` nor
// `locked` (it became a rendered insight this visit). Mirrors GATE_LABELS/OPENS.
const READING_LABELS = {
  contradiction: { label: "Contradiction", opens: "where what you read for and what you rate highest disagree" },
  blind_spot: { label: "Blind spot", opens: "the feelings you never once reach for" },
  drift: { label: "Drift", opens: "how the shape of your reading has moved over time" },
  intensity_signature: { label: "Intensity signature", opens: "how you use the 1–10 scale — all-or-nothing, or careful" },
  pairing: { label: "Pairing", opens: "which feelings travel together on your shelf" },
  abandonment: { label: "Abandonment", opens: "what a book tends to be doing when you put it down" },
  dnf_reason: { label: "DNF reason", opens: "the reason your unfinished books have in common" },
  range: { label: "Range", opens: "how wide across the vocabulary your reading reaches" },
  arc: { label: "Arc", opens: "where your books start and where they leave you" },
};

export function buildRegister(entries, dna) {
  if (!entries || entries.length === 0) return null;

  const mRows = milestoneRows(entries);
  const rRows = readingRows(dna);
  const split = (rows) => ({
    earned: rows.filter((r) => r.achieved),
    ahead: rows.filter((r) => !r.achieved),
  });
  const m = split(mRows);
  const r = split(rRows);

  const countable = [...m.ahead, ...r.ahead].filter(
    (x) => Number.isFinite(x.have) && Number.isFinite(x.need) && x.need > x.have
  );
  const next = countable.length
    ? countable.reduce((best, x) => {
        const dx = x.need - x.have, db = best.need - best.have;
        return dx < db || (dx === db && x.need < best.need) ? x : best;
      })
    : null;

  const earned_count = m.earned.length + r.earned.length;
  const ahead_count = m.ahead.length + r.ahead.length;
  return {
    warming: !(dna && dna.enough),
    next,
    bands: [
      { key: "milestone", label: "Milestones — your reading life", earned: m.earned, ahead: m.ahead },
      { key: "reading", label: "Readings — what the mirror can see", earned: r.earned, ahead: r.ahead },
    ],
    earned_count,
    total: earned_count + ahead_count,
  };
}
