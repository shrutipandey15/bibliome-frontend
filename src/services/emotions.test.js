import { describe, it, expect } from "vitest";
import { EMOTIONS, EMO_LIST, hydrateEmotions, getPrimaryEmotion, getEmotionFamilies } from "./emotions";

describe("shared emotion vocabulary [F1.5 / P2-9]", () => {
  it("the display label is the human phrase, with the plain word on `name`", () => {
    // Per VISION §4 the reader sees the first-person phrase, never the word/slug.
    expect(EMOTIONS.grief.label).toBe("it left a hole");
    expect(EMOTIONS.devastation.label).toBe("it wrecked me");
    expect(EMOTIONS.confusion.label).toBe("I lost the plot");
    // The plain word is still available for compact/analytic surfaces.
    expect(EMOTIONS.grief.name).toBe("grief");
    expect(EMOTIONS.devastation.name).toBe("devastation");
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

  it("groups the vocabulary into the five families in order [Part A]", () => {
    const fams = getEmotionFamilies();
    expect(fams.map((f) => f.family)).toEqual([
      "It hurt", "It held me", "It wanted something", "It moved me", "It lost me",
    ]);
    const hurt = fams.find((f) => f.family === "It hurt");
    expect(hurt.emotions.map(([slug]) => slug)).toContain("devastation");
    expect(hurt.emotions.map(([slug]) => slug)).toContain("rage");
  });

  it("getPrimaryEmotion falls back for unknown slugs", () => {
    expect(getPrimaryEmotion({ emotions: [{ emotion_id: "nope" }] }).label).toBe("Unknown");
    // A known slug resolves to its vocabulary entry (label is the served phrase).
    expect(getPrimaryEmotion({ emotions: [{ emotion_id: "rage" }] }).name).toBe("rage");
  });
});
