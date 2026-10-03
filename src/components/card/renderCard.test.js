import { describe, it, expect, vi } from "vitest";
import { drawCard, renderCard, SIZES, waitForCardFonts } from "./renderCard";
import { ALL, GRIEF } from "./testCards";

/**
 * A 2D context that records what was drawn. Text width is approximated from
 * the font size — 0.45em a character for the serif, 0.5em for the sans, 0.6em
 * for the mono, close to the real faces' averages — which is enough to
 * exercise fitting and wrapping; the real faces are checked in a browser.
 */
const EM = (font) => (font.includes("Newsreader") ? 0.45 : font.includes("Mono") ? 0.6 : 0.5);
const width = (text, font) => [...text].length * Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] || 16) * EM(font);

class RecordingContext {
  constructor() {
    this.ops = [];
    this.font = "16px serif";
    this.fillStyle = "#000";
    this.globalAlpha = 1;
    this.stack = [];
    this.tx = 0;
    this.ty = 0;
  }
  measureText(t) { return { width: width(t, this.font) }; }
  fillText(text, x, y) {
    this.ops.push({ op: "text", text, x: x + this.tx, y: y + this.ty, font: this.font, fill: this.fillStyle, rotated: !!this.rot });
  }
  fill(path) { this.ops.push({ op: "fill", path: typeof path === "string" ? path : "arc", alpha: this.globalAlpha }); }
  stroke(path) { this.ops.push({ op: "stroke", path, alpha: this.globalAlpha }); }
  fillRect(x, y, w, h) { this.ops.push({ op: "rect", x, y, w, h, fill: typeof this.fillStyle === "string" ? this.fillStyle : "gradient" }); }
  createRadialGradient() { const stops = []; return { stops, addColorStop: (o, c) => stops.push([o, c]) }; }
  save() { this.stack.push([this.tx, this.ty, this.rot]); }
  restore() { [this.tx, this.ty, this.rot] = this.stack.pop(); }
  translate(x, y) { this.tx += x; this.ty += y; }
  scale() {}
  rotate(a) { this.rot = a; }
  beginPath() {}
  arc() {}
}

function draw(format, card) {
  const ctx = new RecordingContext();
  drawCard(ctx, format, card, { makePath: (d) => d, justTurned: true });
  return ctx;
}

const texts = (ctx) => ctx.ops.filter((o) => o.op === "text" && !o.rotated);
// Hand-tracked labels are drawn one character at a time; join them back up.
const words = (ctx) => texts(ctx).map((o) => o.text).join("");

describe("renderCard", () => {
  it("draws the bloom from the payload's own path data, in its layers", () => {
    const ctx = draw("story", GRIEF);
    const paths = ctx.ops.filter((o) => o.op === "fill" || o.op === "stroke").map((o) => o.path);
    for (const layer of GRIEF.bloom.layers) expect(paths).toContain(layer.d);
    const ghost = ctx.ops.find((o) => o.path === GRIEF.bloom.layers[0].d);
    expect(ghost.op).toBe("stroke");
    expect(ghost.alpha).toBe(0.08);
  });

  it("says the card's words: first person, the numbers, the way in", () => {
    const all = words(draw("story", GRIEF));
    for (const s of ["I'm a", "Grief", "Romantic.", "Loss isn't my enemy. Numbness is.",
      "WHAT MY BOOKS DID TO ME", "14", "heartbreak", "REDFLAG", "I avoid neat happy endings",
      "what'syours?", "bibliome.app", "MYREADINGDNA", "34BOOKS·2026"]) {
      expect(all.replace(/ /g, "")).toContain(s.replace(/ /g, ""));
    }
  });

  it.each(["story", "season"])("keeps every word of the %s inside Instagram's safe zone", (format) => {
    for (const card of [GRIEF, ...ALL.map((c) => ({ ...c, season: GRIEF.season }))]) {
      for (const o of texts(draw(format, card))) {
        expect(o.y).toBeGreaterThanOrEqual(250);
        expect(o.y).toBeLessThanOrEqual(1670);
        expect(o.x).toBeGreaterThanOrEqual(96 - 1);
        expect(o.x + width(o.text, o.font)).toBeLessThanOrEqual(984 + 1);
      }
    }
  });

  it("keeps the square's words on the square", () => {
    for (const card of ALL) {
      for (const o of texts(draw("square", card))) {
        expect(o.y).toBeGreaterThan(0);
        expect(o.y).toBeLessThanOrEqual(1080 - 70);
        expect(o.x).toBeGreaterThanOrEqual(80 - 1);
      }
    }
  });

  it("shrinks a long name to fit, never below 120px on a story", () => {
    const long = ALL.find((c) => c.archetype.id === "control_intellectual");
    const ctx = draw("story", long);
    const name = texts(ctx).find((o) => o.text === "Intellectual.");
    const size = Number(/(\d+)px/.exec(name.font)[1]);
    expect(size).toBeGreaterThanOrEqual(120);
    expect(size).toBeLessThanOrEqual(168);
  });

  it("leaves off what the reader switched off", () => {
    const off = { ...GRIEF, choices: { season: false, red_flag: false } };
    const all = words(draw("story", off));
    expect(all).not.toContain("RED");
    expect(all).not.toContain("World-Diver");
  });

  it("prints the hedge on the image too", () => {
    const all = words(draw("story", { ...GRIEF, leaning: { name: "The Soft Masochist" } }));
    expect(all).toContain("leaning toward the Soft Masochist");
  });

  it("draws the season story from the last six books, in the season's colours", () => {
    const ctx = draw("season", GRIEF);
    const all = words(ctx);
    expect(all).toContain("Lately, I'm in a");
    expect(all).toContain("World-Diver");
    expect(all).toContain("Still a Grief Romantic at heart.");
    expect(all.replace(/ /g, "")).toContain("MYLAST6BOOKS");
    expect(all.replace(/ /g, "")).toContain("SINCEAUGUST");
    expect(all).toContain("page-turner");
    expect(all).not.toContain("heartbreak");
  });

  it("refuses a season story for a card without a season", () => {
    expect(() => draw("season", { ...GRIEF, season: null })).toThrow();
  });

  it("never prints a handle, a title or a comparison", () => {
    for (const format of ["story", "season", "square"]) {
      const all = words(draw(format, GRIEF));
      expect(all).not.toMatch(/@|% of|rarest|no two alike/);
    }
  });

  it.each(Object.keys(SIZES))("matches its %s snapshot for every archetype", (format) => {
    const cards = format === "season" ? ALL.map((c) => ({ ...c, season: GRIEF.season })) : ALL;
    const shot = cards.map((card) => ({
      id: card.archetype.id,
      text: texts(draw(format, card)).reduce((acc, o) => {
        // Collapse hand-tracked letters into their label for a readable snapshot.
        const last = acc[acc.length - 1];
        if (last && o.text.length === 1 && last.font === o.font && Math.abs(last.y - o.y) < 0.5 && last.single) {
          last.text += o.text;
        } else {
          acc.push({ text: o.text, x: Math.round(o.x), y: Math.round(o.y), font: o.font, single: o.text.length === 1 });
        }
        return acc;
      }, []).map(({ text, x, y, font }) => `${x},${y} ${font.replace(/".*$/, "").trim()} | ${text}`),
    }));
    expect(shot).toMatchSnapshot();
  });
});

describe("renderCard — making the file", () => {
  it("never waits on fonts longer than it's told to", async () => {
    vi.useFakeTimers();
    const load = vi.fn(() => new Promise(() => {}));
    const orig = document.fonts;
    Object.defineProperty(document, "fonts", { value: { load }, configurable: true });
    const p = waitForCardFonts(3000);
    vi.advanceTimersByTime(3000);
    await expect(p).resolves.toBe(false);
    Object.defineProperty(document, "fonts", { value: orig, configurable: true });
    vi.useRealTimers();
  });

  it("makes a PNG at the format's size and releases the canvas", async () => {
    const ctx = new RecordingContext();
    const canvas = { width: 0, height: 0, getContext: () => ctx, toBlob: (cb, type) => cb(new Blob(["x"], { type })) };
    const sizes = [];
    const spy = vi.spyOn(document, "createElement").mockImplementation(() => new Proxy(canvas, {
      set(t, k, v) { if (k === "width" || k === "height") sizes.push([k, v]); t[k] = v; return true; },
    }));
    const orig = global.Path2D;
    global.Path2D = function Path2D(d) { return d; };
    const blob = await renderCard("square", GRIEF, { fontTimeoutMs: 1 });
    expect(blob.type).toBe("image/png");
    expect(sizes.slice(0, 2)).toEqual([["width", 1080], ["height", 1080]]);
    expect(canvas.width).toBe(0);
    expect(canvas.height).toBe(0);
    spy.mockRestore();
    global.Path2D = orig;
  });
});
