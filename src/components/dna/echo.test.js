import { describe, it, expect } from "vitest";
import { shouldEcho } from "./echo";

const em = (...ids) => ids.map((emotion_id) => ({ emotion_id, strength: 6 }));

describe("which saves get an echo [Aliveness F1]", () => {
  it("a new book with feelings does; without feelings or on the pile it doesn't", () => {
    expect(shouldEcho(null, { status: "finished", emotions: em("grief") })).toBe(true);
    expect(shouldEcho(null, { status: "finished", emotions: [] })).toBe(false);
    expect(shouldEcho(null, { status: "want_to_read", emotions: em("grief") })).toBe(false);
  });

  it("an edit does only when its feelings changed or it was just finished", () => {
    const prev = { status: "reading", emotions: em("grief", "awe") };
    expect(shouldEcho(prev, { status: "reading", emotions: em("awe", "grief"), notes: "x" })).toBe(false);
    expect(shouldEcho(prev, { status: "reading", emotions: em("grief") })).toBe(true);
    expect(shouldEcho(prev, { status: "finished", emotions: em("grief", "awe") })).toBe(true);
    expect(shouldEcho({ ...prev, status: "finished" }, { status: "finished", emotions: em("grief", "awe") })).toBe(false);
  });
});
