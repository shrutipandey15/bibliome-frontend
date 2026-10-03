import { describe, it, expect } from "vitest";
import { EMOTIONS, EMO_LIST, RETIRED_EMOTIONS, hydrateEmotions, getPrimaryEmotion, getEmotionFamilies } from "./emotions";

describe("shared emotion vocabulary [F1.5 / P2-9]", () => {
  it("the display label is the human phrase, with the plain word on `name`", () => {
    // Per VISION §4 the reader sees the first-person phrase, never the word/slug.
    expect(EMOTIONS.grief.label).toBe("it broke my heart");
    expect(EMOTIONS.thrill.label).toBe("I read it in one sitting");
    expect(EMOTIONS.recognition.label).toBe("it knew me");
    // The plain word is still available for compact/analytic surfaces.
    expect(EMOTIONS.grief.name).toBe("heartbreak");
    expect(EMOTIONS.thrill.name).toBe("page-turner");
  });

  it("keeps presentation (Icon/glyph) local while carrying server label/color", () => {
    expect(EMOTIONS.grief.Icon).toBeTypeOf("object"); // lucide component (forwardRef obj)
    expect(EMOTIONS.grief.glyph).toBeTypeOf("string");
  });

  it("hydrateEmotions takes the label from the served phrase, in place", () => {
    const ref = EMOTIONS.grief; // same object reference must survive hydration
    hydrateEmotions({
      version: 2,
      emotions: [
        { slug: "grief", name: "grief", phrase: "it gutted me", symbol: "💧", color: "#000000", description: "updated" },
      ],
    });
    expect(EMOTIONS.grief).toBe(ref); // mutated in place, not replaced
    expect(EMOTIONS.grief.label).toBe("it gutted me"); // phrase, not the word
    expect(EMOTIONS.grief.name).toBe("grief");
    expect(EMOTIONS.grief.color).toBe("#000000");
    expect(EMOTIONS.grief.symbol).toBe("💧");
    // Presentation preserved through hydration.
    expect(EMOTIONS.grief.glyph).toBeTypeOf("string");
    // EMO_LIST still references the same live object.
    expect(EMO_LIST.find(([s]) => s === "grief")[1].label).toBe("it gutted me");
  });

  it("falls back to the plain word when the server hasn't served a phrase yet", () => {
    hydrateEmotions({ version: 2, emotions: [{ slug: "rage", name: "rage", color: "#C44B4B", description: "x" }] });
    expect(EMOTIONS.rage.label).toBe("rage");
  });

  it("groups the 21 feelings into the six families in order [v3]", () => {
    const fams = getEmotionFamilies();
    expect(fams.map((f) => f.family)).toEqual([
      "it broke me", "it hooked me", "it held me", "it lit me up", "it got my heart", "it opened my eyes",
    ]);
    expect(fams.map((f) => f.emotions.length)).toEqual([3, 4, 3, 3, 4, 4]);
    expect(EMO_LIST).toHaveLength(21);
    const hooked = fams.find((f) => f.family === "it hooked me");
    expect(hooked.emotions.map(([slug]) => slug)).toEqual(["thrill", "dread", "shock", "rage"]);
  });

  it("keeps retired tags displayable but out of every picker [v3]", () => {
    for (const slug of ["boredom", "revulsion", "confusion", "indifference"]) {
      expect(RETIRED_EMOTIONS.has(slug)).toBe(true);
      expect(EMOTIONS[slug]).toBeDefined();           // old entries still render
      expect(EMO_LIST.some(([s]) => s === slug)).toBe(false);
    }
    const inFamilies = getEmotionFamilies().flatMap((f) => f.emotions.map(([s]) => s));
    expect(inFamilies.some((s) => RETIRED_EMOTIONS.has(s))).toBe(false);
  });

  it("getPrimaryEmotion falls back for unknown slugs", () => {
    expect(getPrimaryEmotion({ emotions: [{ emotion_id: "nope" }] }).label).toBe("Unknown");
    // A known slug resolves to its vocabulary entry (label is the served phrase).
    expect(getPrimaryEmotion({ emotions: [{ emotion_id: "rage" }] }).name).toBe("rage");
  });
});
