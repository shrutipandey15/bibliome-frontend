import { describe, it, expect, beforeEach, vi } from "vitest";

// html2canvas needs a real renderer; stand in for it with a canvas of the plate's
// own proportions so the compositing maths is what's under test.
const fakeCard = { width: 372 * 3, height: Math.round(372 * 2.92 / 2) * 3 };
vi.mock("html2canvas", () => ({
  default: vi.fn(async () => ({
    width: fakeCard.width,
    height: fakeCard.height,
    toDataURL: () => "data:image/png;base64,plate",
  })),
}));

import { saveCardAsImage } from "./cardUtils";

function stubCanvas() {
  const ctx = {
    fillRect: vi.fn(), drawImage: vi.fn(), save: vi.fn(), restore: vi.fn(),
    createRadialGradient: () => ({ addColorStop: vi.fn() }),
    fillStyle: null, globalAlpha: 1, shadowColor: null, shadowBlur: 0, shadowOffsetY: 0,
  };
  const created = [];
  const links = [];
  const realCreate = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation((tag) => {
    const el = realCreate(tag);
    if (tag === "canvas") {
      el.getContext = () => ctx;
      el.toDataURL = () => "data:image/png;base64,story";
      created.push(el);
    }
    if (tag === "a") { el.click = vi.fn(); links.push(el); }
    return el;
  });
  return { ctx, created, links };
}

/** jsdom's CSSStyleDeclaration isn't iterable, which `resolveStyles` relies on
 *  when it copies computed styles onto the clone. Stand in with something that
 *  behaves like a browser's. */
function stubComputedStyle(vars = {}) {
  vi.spyOn(window, "getComputedStyle").mockImplementation((el) => ({
    [Symbol.iterator]: function* () { yield "color"; },
    getPropertyValue: (prop) => {
      if (prop in vars) return vars[prop];
      return el?.style?.getPropertyValue?.(prop) ?? "";
    },
  }));
}

function cardNode() {
  const node = document.createElement("div");
  node.className = "dna-card";
  node.style.setProperty("--dc", "#6B4F8E");
  node.getBoundingClientRect = () => ({ width: 372, height: 543 });
  document.body.appendChild(node);
  return node;
}

describe("saveCardAsImage [F2.4]", () => {
  beforeEach(() => { vi.restoreAllMocks(); document.body.innerHTML = ""; stubComputedStyle(); });

  it("exports a 1080x1920 story frame by default, so it can be posted as-is", async () => {
    const { created } = stubCanvas();
    await saveCardAsImage(cardNode(), "alice");

    const story = created.at(-1);
    expect(story.width).toBe(1080);
    expect(story.height).toBe(1920);
  });

  it("fits the plate inside the margins and centres it", async () => {
    const { ctx } = stubCanvas();
    await saveCardAsImage(cardNode(), "alice");

    const [, x, y, w, h] = ctx.drawImage.mock.calls.at(-1);
    expect(w).toBe(1080 - 96 * 2);          // width-first, inside the margin
    expect(h).toBeLessThanOrEqual(1920 - 96 * 2);
    expect(x).toBeCloseTo((1080 - w) / 2, 5);
    expect(y).toBeCloseTo((1920 - h) / 2, 5);
  });

  it("names the file so the reader can tell the two exports apart", async () => {
    const { links } = stubCanvas();
    await saveCardAsImage(cardNode(), "alice");
    expect(links.at(-1).download).toBe("bibliome-alice-story.png");
  });

  it("still exports the bare plate when a caller asks for it", async () => {
    const { ctx, created } = stubCanvas();
    await saveCardAsImage(cardNode(), "alice", { story: false });
    expect(ctx.drawImage).not.toHaveBeenCalled();
    expect(created.every((c) => c.width !== 1080)).toBe(true);
  });
});
