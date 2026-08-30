import { describe, it, expect } from "vitest";
import { buildRegister } from "./registerData";

const day = (n) => new Date(2026, 0, 1 + n).toISOString();

// A shelf of n books, all tagged `grief`, created one day apart.
const shelf = (n, over = {}) =>
  Array.from({ length: n }, (_, i) => ({
    created_at: day(i),
    emotions: [{ emotion_id: "grief" }],
    ...over,
  }));

const dnaEnough = {
  enough: true,
  tagged_count: 70,
  earned: [
    { category: "pairing", label: "Pairing", opens: "which feelings travel together", have: 70, need: 15 },
    { category: "range", label: "Range", opens: "how wide you reach", have: 70, need: 8 },
  ],
  locked: [
    { category: "dnf_reason", label: "DNF reason", reason: "3 books you've set down and named a reason for", have: 0, need: 3 },
    { category: "arc", label: "Arc", reason: "5 books finished through the three-beat flow", have: 1, need: 5 },
    { category: "seasonality", label: "Seasonality", reason: "25 books across a full year", have: null, need: 25, unlocks_at: "25 books + 12 months" },
  ],
};

describe("buildRegister", () => {
  it("returns null for an empty shelf", () => {
    expect(buildRegister([], dnaEnough)).toBeNull();
    expect(buildRegister(null, dnaEnough)).toBeNull();
  });

  it("splits milestones into earned / ahead and dates the earned ones", () => {
    const reg = buildRegister(shelf(3), dnaEnough);
    const m = reg.bands.find((b) => b.key === "milestone");
    const earned = m.earned.map((r) => r.kind);
    expect(earned).toContain("first_book");
    expect(m.earned.find((r) => r.kind === "first_book").achieved_at).toBe(day(0));
    // 1 distinct feeling → deep_range / full_spectrum still ahead
    expect(m.ahead.map((r) => r.kind)).toEqual(
      expect.arrayContaining(["deep_range", "full_spectrum", "first_finish"]),
    );
  });

  it("reads the DNA payload's earned / locked rows straight through", () => {
    const reg = buildRegister(shelf(70), dnaEnough);
    const r = reg.bands.find((b) => b.key === "reading");
    const earned = r.earned.map((x) => x.kind);
    const ahead = r.ahead.map((x) => x.kind);
    expect(earned).toEqual(expect.arrayContaining(["dna_ready", "pairing", "range"]));
    expect(ahead).toEqual(expect.arrayContaining(["dnf_reason", "arc", "seasonality"]));
  });

  it("a gate in neither earned nor locked (rendered as an insight) still counts as earned", () => {
    // contradiction omitted from both lists by the backend this visit
    const reg = buildRegister(shelf(70), dnaEnough);
    const r = reg.bands.find((b) => b.key === "reading");
    expect(r.earned.map((x) => x.kind)).toContain("contradiction");
  });

  it("picks `next` as the ahead row with the smallest remaining count, across both bands", () => {
    const reg = buildRegister(shelf(70), dnaEnough);
    // first_finish (milestone): need 1 have 0 → 1 remaining, the closest of all.
    expect(reg.next.kind).toBe("first_finish");
    expect(reg.next.need - reg.next.have).toBe(1);

    // With first_finish already done, the next closest is dnf_reason (3 away),
    // ahead of arc (4) and deep_range (9).
    const withFinish = shelf(70).map((e, i) =>
      i === 0 ? { ...e, finish_thought: "it wrecked me" } : e,
    );
    expect(buildRegister(withFinish, dnaEnough).next.kind).toBe("dnf_reason");
  });

  it("warming: the DNA isn't ready, so readings are just the one 'mirror' row, ahead", () => {
    const reg = buildRegister(shelf(3), { enough: false, tagged_count: 3 });
    expect(reg.warming).toBe(true);
    const r = reg.bands.find((b) => b.key === "reading");
    expect(r.earned).toEqual([]);
    expect(r.ahead).toHaveLength(1);
    expect(r.ahead[0].kind).toBe("dna_ready");
    expect(r.ahead[0]).toMatchObject({ have: 3, need: 5 });
  });

  it("earns first_finish only when an arc or finish-thought is present", () => {
    const withArc = shelf(2).map((e, i) =>
      i === 0 ? { ...e, arc_start_emotion_id: "grief" } : e,
    );
    const reg = buildRegister(withArc, dnaEnough);
    const m = reg.bands.find((b) => b.key === "milestone");
    expect(m.earned.map((r) => r.kind)).toContain("first_finish");
  });

  it("totals add up: earned_count + every ahead row = total", () => {
    const reg = buildRegister(shelf(70), dnaEnough);
    const ahead = reg.bands.reduce((n, b) => n + b.ahead.length, 0);
    expect(reg.total).toBe(reg.earned_count + ahead);
  });
});
