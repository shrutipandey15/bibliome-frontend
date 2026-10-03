import { describe, it, expect } from "vitest";
import {
  applyChoices, bloomAlt, displayName, imageFormats, leaningLine, nameLines, seasonJustTurned,
  shareText, sinceLabel,
} from "./cardModel";
import { GRIEF, BLOOM } from "./testCards";

describe("cardModel", () => {
  it("drops 'The' and splits the name the way the card sets it", () => {
    expect(displayName("The Grief Romantic")).toBe("Grief Romantic");
    expect(nameLines("The Grief Romantic")).toEqual(["Grief", "Romantic."]);
    expect(nameLines("The Control-Seeking Intellectual")).toEqual(["Control-Seeking", "Intellectual."]);
    expect(nameLines("The World-Diver")).toEqual(["World-Diver."]);
  });

  it("writes the share text the image can't carry", () => {
    expect(shareText(GRIEF, "abc")).toBe("I'm a Grief Romantic. What's yours? bibliome.app/s/abc");
    expect(shareText(GRIEF, null)).toBe("I'm a Grief Romantic. What's yours? bibliome.app");
    expect(shareText(GRIEF, "abc", "season")).toBe(
      "Lately, I'm in a World-Diver season. What's yours? bibliome.app/s/abc");
  });

  it("applies the reader's switches", () => {
    const off = applyChoices({ ...GRIEF, choices: { season: false, red_flag: false } });
    expect(off.season).toBeNull();
    expect(off.red_flag).toBeNull();
    expect(applyChoices(GRIEF).season).not.toBeNull();
  });

  it("offers the season story only for a season that isn't home", () => {
    expect(imageFormats(GRIEF)).toEqual(["story", "season", "square"]);
    expect(imageFormats({ ...GRIEF, season: { ...GRIEF.season, home: true } })).toEqual(["story", "square"]);
    expect(imageFormats({ ...GRIEF, season: null })).toEqual(["story", "square"]);
  });

  it("says when the season started, with the year only if it isn't this one", () => {
    const now = new Date("2026-10-03T00:00:00Z");
    expect(sinceLabel("2026-08-02", now)).toBe("SINCE AUGUST");
    expect(sinceLabel("2025-12-20", now)).toBe("SINCE DECEMBER 2025");
  });

  it("only calls a season turned when there's been one, recently", () => {
    const now = new Date("2026-10-03T00:00:00Z");
    const recent = { ...GRIEF, season: { ...GRIEF.season, since: "2026-09-28" } };
    expect(seasonJustTurned(recent, [{}, {}], now)).toBe(true);
    expect(seasonJustTurned(recent, [{}], now)).toBe(false);
    expect(seasonJustTurned(GRIEF, [{}, {}], now)).toBe(false);
  });

  it("names the hedge from the leaning, or the runner-up on older payloads", () => {
    expect(leaningLine({ leaning: { name: "The Soft Masochist" } })).toBe("leaning toward the Soft Masochist");
    expect(leaningLine({ runner_up: "The Soft Masochist" })).toBe("leaning toward the Soft Masochist");
    expect(leaningLine({})).toBeNull();
  });

  it("describes the bloom by its three longest petals", () => {
    expect(bloomAlt(BLOOM)).toBe("A bloom of petals, one per feeling, longest for heartbreak, catharsis and haunted.");
    expect(bloomAlt({ top: [] })).toBe("A bloom of petals, one per feeling.");
  });
});
