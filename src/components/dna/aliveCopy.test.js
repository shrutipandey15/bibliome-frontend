import { describe, it, expect } from "vitest";
import {
  echoExtra, echoLine, leaningLine, momentLine, monthLabel, seasonLine, shiftCopy, shortName,
  spanLabel, withArticle,
} from "./aliveCopy";

const WD = { id: "world_diver", name: "The World-Diver", color: "#3A7A8C", glyph: "✦" };
const AS = { id: "adrenaline_seeker", name: "The Adrenaline Seeker", color: "#8C3A3A", glyph: "✶" };
const GR = { id: "grief_romantic", name: "The Grief Romantic", color: "#3A5A6B", glyph: "◈" };

describe("aliveness copy [DNA Aliveness · Copy]", () => {
  it("drops 'The' and picks the article", () => {
    expect(shortName(WD)).toBe("World-Diver");
    expect(withArticle(WD)).toBe("a World-Diver");
    expect(withArticle(AS)).toBe("an Adrenaline Seeker");
  });

  it("words the echo's first line by relation", () => {
    expect(echoLine({ book_type: GR, relation: "deepened" })).toBe("Deep in Grief Romantic territory.");
    expect(echoLine({ book_type: WD, relation: "pulled" })).toBe("This one pulled you toward the World-Diver.");
    expect(echoLine({ book_type: AS, relation: "reads_like" })).toBe("That reads like an Adrenaline Seeker book.");
    expect(echoLine(null)).toBeNull();
  });

  it("words each extra, and nothing for none", () => {
    expect(echoExtra({ extra: { kind: "shift", from: GR, to: WD } })).toBe("And that tipped it: you're a World-Diver now.");
    expect(echoExtra({ extra: { kind: "season", archetype: WD, home: false } })).toBe("Your season just turned: World-Diver.");
    expect(echoExtra({ extra: { kind: "season", archetype: GR, home: true } })).toBe("Back in your element.");
    expect(echoExtra({ extra: { kind: "first", emotion: "swoon" } })).toBe("A first for you: “it gave me butterflies”.");
    expect(echoExtra({ extra: { kind: "return", emotion: "nostalgia", gap: 23 } })).toBe("Nostalgia is back, first time in 23 books.");
    expect(echoExtra({ extra: { kind: "leaning", archetype: WD } })).toBe("You're leaning toward the World-Diver.");
    expect(echoExtra({ extra: null })).toBeNull();
  });

  it("dates seasons and eras from the ISO string, never through local time", () => {
    const now = new Date("2026-10-03T12:00:00Z");
    expect(monthLabel("2026-08-01", { now })).toBe("August");
    expect(monthLabel("2025-03-31", { now })).toBe("March 2025");
    expect(spanLabel("2026-08-01", "2026-10-01")).toBe("Aug–Oct 2026");
    expect(spanLabel("2025-11-20", "2026-02-01")).toBe("Nov 2025–Feb 2026");
    expect(spanLabel("2026-08-01", null)).toBe("since Aug 2026");
  });

  it("season and leaning lines for the card", () => {
    const now = new Date("2026-10-03T12:00:00Z");
    expect(seasonLine({ ...WD, since: "2026-08-04", home: false }, { now })).toBe("in a World-Diver season · since August");
    expect(seasonLine({ ...GR, since: "2026-08-04", home: true }, { now })).toBe("in your element · since August");
    expect(leaningLine(WD)).toBe("leaning toward the World-Diver");
    expect(seasonLine(null)).toBeNull();
  });

  it("moment rows and the shift card", () => {
    expect(momentLine({ kind: "first", emotion: "swoon" })).toBe("A first: “it gave me butterflies”");
    expect(momentLine({ kind: "spectrum" })).toBe("Every feeling, at least once");
    const moved = [{ entry_id: "b1", title: "The Night Circus" }];
    const copy = shiftCopy([{ ...WD, from: "2026-06-10", books_that_moved: moved }, { ...GR, from: "2025-03-01" }]);
    expect(copy.title).toBe("You've become a World-Diver.");
    expect(copy.body).toMatch(/^You read as a Grief Romantic from March 2025\. Since June.*pulled you somewhere new:$/);
    const bare = shiftCopy([{ ...WD, from: "2026-06-10", books_that_moved: [] }, { ...GR, from: "2025-03-01" }]);
    expect(bare.body).toMatch(/your reading has moved somewhere new\.$/);
    expect(copy.footer).toBe("Your Grief Romantic era is kept under Eras.");
    expect(shiftCopy([WD])).toBeNull();
  });

  it("never uses the words the DNA page bans", () => {
    const all = [
      echoLine({ book_type: WD, relation: "pulled" }),
      ...["shift", "season", "first", "return", "spectrum", "leaning"].map((kind) =>
        echoExtra({ extra: { kind, from: GR, to: WD, archetype: WD, emotion: "grief", gap: 21 } })),
      seasonLine({ ...WD, since: "2026-08-01" }), leaningLine(WD),
    ].join(" ");
    expect(all).not.toMatch(/\breveal\b/i);
    expect(all).not.toMatch(/streak/i);
    expect(all).not.toMatch(/than \d+%|% of readers|more \w+ than|left until|to go\b/i);
  });
});
