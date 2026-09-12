import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// `--ink-faint` backs placeholders, hints, disabled labels, and timestamps
// across ~30 files — it silently regressed below WCAG AA once already
// (see decision.md D-6). This locks the ink-on-background pairs actually used
// so a future token edit can't fail contrast without the suite noticing.

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "global.css"),
  "utf8",
);

function tokenValue(block, name) {
  const re = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`);
  const m = block.match(re);
  if (!m) throw new Error(`token --${name} not found`);
  return m[1];
}

function relativeLuminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [R, G, B] = [r, g, b].map(lin);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function contrastRatio(hexA, hexB) {
  const [l1, l2] = [relativeLuminance(hexA), relativeLuminance(hexB)].sort((a, b) => b - a);
  return (l1 + 0.05) / (l2 + 0.05);
}

// Root block (light) is everything before the first `[data-theme="dark"]`.
const darkStart = css.indexOf('[data-theme="dark"]');
const lightBlock = css.slice(0, darkStart);
const darkBlock = css.slice(darkStart);

describe("ink-faint contrast [decision.md D-6]", () => {
  const cases = [
    ["light", lightBlock, "bg-page"],
    ["light", lightBlock, "bg-card"],
    ["dark", darkBlock, "bg-page"],
    ["dark", darkBlock, "bg-card"],
  ];

  it.each(cases)("%s theme: --ink-faint on --%s clears WCAG AA (4.5:1)", (_theme, block, bg) => {
    const ink = tokenValue(block, "ink-faint");
    const background = tokenValue(block, bg);
    expect(contrastRatio(ink, background)).toBeGreaterThanOrEqual(4.5);
  });
});
