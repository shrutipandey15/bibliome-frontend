/**
 * renderCard — draws the share card straight onto a canvas (DNA card spec,
 * "Making the images in the browser").
 *
 * Replaces html2canvas, which skipped CSS the old card relied on and had open
 * iOS and colour bugs. Nothing here is measured from the page: text goes
 * through the browser's own text engine, and the bloom is drawn from the path
 * strings the backend computed (`card.bloom.layers`), so the posted image, the
 * in-app card and the link preview are the same flower.
 *
 * Formats: "story" and "season" (1080×1920, everything between y 250 and
 * 1670 so Instagram's and WhatsApp's chrome never covers it) and "square"
 * (1080×1080). The layout is computed bottom-up from the footer, so a long
 * name or a two-line share line pushes the bloom up rather than off the card.
 *
 * `drawCard(ctx, …)` is pure drawing against a 2D context, which is what the
 * tests exercise with a recording context; `renderCard` adds the canvas, the
 * font wait and the PNG.
 */

import {
  applyChoices, article, booksLabel, displayName, leaningLine, nameLines, sinceLabel, SITE,
} from "./cardModel";

export const SIZES = { story: [1080, 1920], season: [1080, 1920], square: [1080, 1080] };

// The self-hosted brand faces (src/styles/fonts.js), with the plain family
// names and system faces as fallbacks if they never arrive.
export const FAMILIES = {
  display: '"Newsreader Variable", "Newsreader", Georgia, serif',
  body: '"DM Sans Variable", "DM Sans", system-ui, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, Menlo, monospace',
};

const STORY = { margin: 96, top: 250, bottom: 1670 };

// ── Fonts ──

const FONT_LOADS = [
  `400 52px ${FAMILIES.display}`,
  `italic 400 52px ${FAMILIES.display}`,
  `500 56px ${FAMILIES.display}`,
  `italic 500 56px ${FAMILIES.display}`,
  `500 30px ${FAMILIES.body}`,
  `500 26px ${FAMILIES.mono}`,
];

/** Wait for the brand fonts, at most `timeoutMs`; then draw with whatever is
 *  there. A slow font never fails a share. */
export function waitForCardFonts(timeoutMs = 3000) {
  const fonts = typeof document !== "undefined" ? document.fonts : null;
  if (!fonts?.load) return Promise.resolve(false);
  const all = Promise.all(FONT_LOADS.map((f) => fonts.load(f).catch(() => null))).then(() => true);
  const timeout = new Promise((resolve) => setTimeout(() => resolve(false), timeoutMs));
  return Promise.race([all, timeout]);
}

// ── Text helpers ──

function font(ctx, { family, size, weight = 400, italic = false }) {
  ctx.font = `${italic ? "italic " : ""}${weight} ${size}px ${FAMILIES[family]}`;
}

/** Width of `text`, with `tracking` px between letters drawn by hand — canvas
 *  letterSpacing isn't in every Safari that can share files. */
function measure(ctx, text, tracking = 0) {
  if (!tracking) return ctx.measureText(text).width;
  let w = 0;
  for (const ch of text) w += ctx.measureText(ch).width;
  return w + tracking * Math.max([...text].length - 1, 0);
}

function draw(ctx, text, x, y, { fill, tracking = 0, align = "left" } = {}) {
  ctx.fillStyle = fill;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  const w = measure(ctx, text, tracking);
  let cx = align === "right" ? x - w : align === "center" ? x - w / 2 : x;
  if (!tracking) {
    ctx.fillText(text, cx, y);
    return w;
  }
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + tracking;
  }
  return w;
}

/** The largest size from `start` down to `floor` at which every line fits. */
function fitSize(ctx, lines, start, floor, width, weight = 400) {
  let size = start;
  const fits = (s) => lines.every((l, i) => {
    font(ctx, { family: "display", size: s, weight, italic: i === lines.length - 1 });
    return measure(ctx, l) <= width;
  });
  while (size > floor && !fits(size)) size -= 2;
  return Math.max(size, floor);
}

function wrap(ctx, text, width) {
  const out = [];
  let line = "";
  for (const word of text.split(" ")) {
    const trial = line ? `${line} ${word}` : word;
    if (line && measure(ctx, trial) > width) {
      out.push(line);
      line = word;
    } else {
      line = trial;
    }
  }
  if (line) out.push(line);
  return out;
}

// ── Shapes ──

function ground(ctx, w, h, pal, cx, cy) {
  const r = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy));
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, pal.top);
  g.addColorStop(1, pal.bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function bloom(ctx, b, x, y, size, ink, makePath) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / b.size, size / b.size);
  for (const layer of b.layers) {
    const path = makePath(layer.d);
    if (layer.stroke != null) {
      ctx.globalAlpha = layer.stroke;
      ctx.strokeStyle = ink;
      ctx.lineWidth = layer.width;
      ctx.stroke(path);
    } else {
      ctx.globalAlpha = layer.fill;
      ctx.fillStyle = ink;
      ctx.fill(path);
    }
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

/** A round sticker, rotated: three lines, the middle one in italic. */
function sticker(ctx, cx, cy, r, { bg, fg, top, mid, bottom, angle }) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((angle * Math.PI) / 180);
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  font(ctx, { family: "mono", size: Math.round(r * 0.17), weight: 500 });
  if (top) draw(ctx, top, 0, -r * 0.3, { fill: fg, tracking: r * 0.024, align: "center" });
  let ms = Math.round(r * 0.36);
  font(ctx, { family: "display", size: ms, weight: 500, italic: true });
  while (ms > r * 0.16 && measure(ctx, mid) > r * 1.6) {
    ms -= 2;
    font(ctx, { family: "display", size: ms, weight: 500, italic: true });
  }
  draw(ctx, mid, 0, top || bottom ? ms * 0.35 : ms * 0.3, { fill: fg, align: "center" });
  font(ctx, { family: "mono", size: Math.round(r * 0.17), weight: 500 });
  if (bottom) draw(ctx, bottom, 0, r * 0.47, { fill: fg, tracking: r * 0.024, align: "center" });
  ctx.restore();
}

function seasonSticker(ctx, card, pal, cx, cy, r) {
  const s = card.season;
  if (!s) return;
  if (s.home) {
    sticker(ctx, cx, cy, r, { bg: pal.accent, fg: pal.bottom, top: "IN MY", mid: "element", angle: 12 });
  } else {
    sticker(ctx, cx, cy, r, {
      bg: pal.accent, fg: pal.bottom, angle: 12,
      top: `NOW IN ${article(s).toUpperCase()}`, mid: displayName(s.name), bottom: "SEASON",
    });
  }
}

/** "14 heartbreak   9 catharsis   7 haunted", shrunk until it fits `width`. */
function numbersRow(ctx, top, x, y, width, pal, { num, label, gap, inner }) {
  if (!top.length) return 0;
  let k = 1;
  const total = (s) => top.reduce((sum, t, i) => {
    font(ctx, { family: "display", size: num * s, weight: 500 });
    const a = measure(ctx, String(t.count));
    font(ctx, { family: "body", size: label * s, weight: 500 });
    return sum + a + inner * s + measure(ctx, t.label) + (i ? gap * s : 0);
  }, 0);
  while (k > 0.6 && total(k) > width) k -= 0.04;
  let cx = x;
  top.forEach((t) => {
    font(ctx, { family: "display", size: num * k, weight: 500 });
    cx += draw(ctx, String(t.count), cx, y, { fill: pal.ink }) + inner * k;
    font(ctx, { family: "body", size: label * k, weight: 500 });
    cx += draw(ctx, t.label, cx, y, { fill: pal.ink }) + gap * k;
  });
  return num * k;
}

function redFlag(ctx, text, x, y, width, pal, { chip, size }) {
  font(ctx, { family: "mono", size: chip, weight: 500 });
  const label = "RED FLAG";
  const tw = measure(ctx, label, chip * 0.16);
  const padX = chip * 0.5;
  const boxH = chip * 1.7;
  ctx.fillStyle = pal.ink;
  ctx.fillRect(x, y - boxH * 0.72, tw + padX * 2, boxH);
  draw(ctx, label, x + padX, y, { fill: pal.bottom, tracking: chip * 0.16 });
  const tx = x + tw + padX * 2 + size * 0.5;
  let s = size;
  font(ctx, { family: "body", size: s, weight: 500 });
  while (s > size * 0.7 && measure(ctx, text) > width - (tx - x)) {
    s -= 1;
    font(ctx, { family: "body", size: s, weight: 500 });
  }
  draw(ctx, text, tx, y, { fill: pal.ink });
}

// ── Formats ──

/** The stacked text block shared by both stories; returns its height and a
 *  painter that draws it from a given top. */
function storyBlock(ctx, { kicker, lines, leaning, line, label, top, flag }, pal) {
  const W = 1080 - STORY.margin * 2;
  const x = STORY.margin;
  const nameSize = fitSize(ctx, lines, 168, 120, W);
  const nameLH = nameSize * 0.88;
  font(ctx, { family: "display", size: 50, italic: true });
  const lineRows = line ? wrap(ctx, line, W) : [];

  const parts = [];
  parts.push({ h: 52, gap: 0, paint: (y) => {
    font(ctx, { family: "display", size: 52, italic: true });
    draw(ctx, kicker, x, y + 42, { fill: pal.accent });
  } });
  parts.push({ h: nameLH * lines.length, gap: 14, paint: (y) => {
    lines.forEach((l, i) => {
      const last = i === lines.length - 1;
      font(ctx, { family: "display", size: nameSize, italic: last && lines.length > 0 });
      draw(ctx, l, x, y + nameLH * i + nameSize * 0.74, { fill: last ? pal.accent : pal.ink });
    });
  } });
  if (leaning) {
    parts.push({ h: 39, gap: 18, paint: (y) => {
      font(ctx, { family: "body", size: 30, weight: 500 });
      draw(ctx, leaning, x, y + 30, { fill: pal.accent });
    } });
  }
  if (lineRows.length) {
    parts.push({ h: 59 * lineRows.length, gap: 36, paint: (y) => {
      font(ctx, { family: "display", size: 50, italic: true });
      lineRows.forEach((r, i) => draw(ctx, r, x, y + 59 * i + 44, { fill: pal.ink }));
    } });
  }
  if (top?.length) {
    parts.push({ h: 92, gap: 40, paint: (y) => {
      font(ctx, { family: "mono", size: 20, weight: 500 });
      draw(ctx, label.toUpperCase(), x, y + 18, { fill: pal.accent, tracking: 4 });
      numbersRow(ctx, top, x, y + 36 + 50, W, pal, { num: 56, label: 30, gap: 44, inner: 12 });
    } });
  }
  if (flag) {
    parts.push({ h: 36, gap: 34, paint: (y) => redFlag(ctx, flag, x, y + 28, W, pal, { chip: 20, size: 28 }) });
  }
  const height = parts.reduce((s, p) => s + p.h + p.gap, 0);
  return {
    height,
    paint(topY) {
      let y = topY;
      parts.forEach((p) => {
        y += p.gap;
        p.paint(y);
        y += p.h;
      });
    },
  };
}

function header(ctx, left, right, pal, { x0, x1, y, size }) {
  font(ctx, { family: "mono", size, weight: 500 });
  draw(ctx, left, x0, y, { fill: pal.accent, tracking: size * 0.22 });
  draw(ctx, right, x1, y, { fill: pal.accent, tracking: size * 0.22, align: "right" });
}

function footer(ctx, pal, { x0, x1, y }) {
  font(ctx, { family: "mono", size: 26, weight: 500 });
  draw(ctx, "what's yours?", x0, y, { fill: pal.accent, tracking: 3 });
  font(ctx, { family: "mono", size: 30, weight: 500 });
  draw(ctx, SITE, x1, y, { fill: pal.ink, tracking: 3.6, align: "right" });
}

function drawStory(ctx, card, makePath) {
  const pal = card.palette;
  const a = card.archetype;
  ground(ctx, 1080, 1920, pal, 540, 650);
  header(ctx, "MY READING DNA", `${booksLabel(card.tagged_count ?? card.book_count)} · ${card.year}`, pal,
    { x0: STORY.margin, x1: 1080 - STORY.margin, y: STORY.top + 26, size: 26 });
  footer(ctx, pal, { x0: STORY.margin, x1: 1080 - STORY.margin, y: 1640 });

  const block = storyBlock(ctx, {
    kicker: `I'm ${article(a)}`,
    lines: nameLines(a.name),
    leaning: leaningLine(card),
    line: a.share_line,
    label: "what my books did to me",
    top: card.bloom.top,
    flag: card.red_flag,
  }, pal);
  const blockTop = 1640 - 30 - 50 - block.height;
  block.paint(blockTop);

  const areaTop = STORY.top + 26 + 34;
  const area = blockTop - 36 - areaTop;
  const size = Math.max(320, Math.min(640, area));
  const bx = (1080 - size) / 2;
  const by = areaTop + Math.max(0, (area - size) / 2);
  bloom(ctx, card.bloom, bx, by, size, pal.ink, makePath);
  const r = Math.round(115 * (size / 640));
  seasonSticker(ctx, card, pal, bx + size + 60 - r, by - 10 + r, r);
}

function drawSeasonStory(ctx, card, makePath, { justTurned = false } = {}) {
  const s = card.season;
  const pal = s.palette;
  const a = card.archetype;
  ground(ctx, 1080, 1920, pal, 540, 650);
  header(ctx, "MY READING DNA", sinceLabel(s.since), pal,
    { x0: STORY.margin, x1: 1080 - STORY.margin, y: STORY.top + 26, size: 26 });
  footer(ctx, pal, { x0: STORY.margin, x1: 1080 - STORY.margin, y: 1640 });

  // "World-Diver / season." — and when the name itself won't fit on one line
  // at the floor size, its two words take a line each.
  const name = displayName(s.name);
  let lines = [name, "season."];
  if (fitSize(ctx, lines, 168, 100, 1080 - STORY.margin * 2) < 120 && name.includes(" ")) {
    lines = [...name.split(" ").slice(0, 1), name.split(" ").slice(1).join(" "), "season."];
  }
  const block = storyBlock(ctx, {
    kicker: `Lately, I'm in ${article(s)}`,
    lines,
    leaning: null,
    line: `Still ${article(a)} ${displayName(a.name)} at heart.`,
    label: "my last 6 books",
    top: s.bloom.top,
    flag: null,
  }, pal);
  const blockTop = 1640 - 30 - 50 - block.height;
  block.paint(blockTop);

  const areaTop = STORY.top + 26 + 34;
  const area = blockTop - 36 - areaTop;
  const size = Math.max(320, Math.min(640, area));
  const bx = (1080 - size) / 2;
  const by = areaTop + Math.max(0, (area - size) / 2);
  bloom(ctx, s.bloom, bx, by, size, pal.ink, makePath);
  if (justTurned) {
    const r = Math.round(115 * (size / 640));
    sticker(ctx, bx + size + 60 - r, by - 10 + r, r, {
      bg: pal.ink, fg: pal.bottom, top: "NEW", mid: "season", bottom: "JUST TURNED", angle: -10,
    });
  }
}

function drawSquare(ctx, card, makePath) {
  const pal = card.palette;
  const a = card.archetype;
  const P = 80;
  ground(ctx, 1080, 1080, pal, 324, 432);
  header(ctx, "MY READING DNA", `${booksLabel(card.tagged_count ?? card.book_count)} · ${card.year}`, pal,
    { x0: P, x1: 1080 - P, y: P + 22, size: 24 });

  // Bottom row: the numbers on the left, the way in on the right.
  font(ctx, { family: "mono", size: 24, weight: 500 });
  draw(ctx, "what's yours?", 1080 - P, 1080 - P - 36, { fill: pal.accent, tracking: 2.9, align: "right" });
  const siteW = draw(ctx, SITE, 1080 - P, 1080 - P, { fill: pal.ink, tracking: 2.9, align: "right" });
  const numsW = 1080 - P * 2 - Math.max(siteW, 220) - 32;
  numbersRow(ctx, card.bloom.top, P, 1080 - P, numsW, pal, { num: 48, label: 26, gap: 36, inner: 10 });

  // The middle: bloom on the left, the words on the right.
  const midTop = P + 60;
  const midBottom = 1080 - P - 48 - 50;
  const colX = P + 440 + 40;
  const colW = 1080 - P - colX;
  const lines = nameLines(a.name);
  const nameSize = fitSize(ctx, lines, 112, 52, colW);
  const nameLH = nameSize * 0.9;
  const leaning = leaningLine(card);
  let lineSize = 38;
  font(ctx, { family: "display", size: lineSize, italic: true });
  let rows = wrap(ctx, a.share_line || "", colW);
  if (rows.length > 3) {
    lineSize = 32;
    font(ctx, { family: "display", size: lineSize, italic: true });
    rows = wrap(ctx, a.share_line || "", colW);
  }
  font(ctx, { family: "body", size: 24, weight: 500 });
  const flagRows = card.red_flag ? wrap(ctx, card.red_flag, colW) : [];
  const leanRows = leaning ? wrap(ctx, leaning, colW) : [];

  const h = 40 + 18 + nameLH * lines.length + (leanRows.length ? 14 + 30 * leanRows.length : 0)
    + 22 + lineSize * 1.2 * rows.length
    + (flagRows.length ? 22 + 30 + 8 + 30 * flagRows.length : 0);
  let y = midTop + Math.max(0, (midBottom - midTop - h) / 2);

  font(ctx, { family: "display", size: 40, italic: true });
  draw(ctx, `I'm ${article(a)}`, colX, y + 32, { fill: pal.accent });
  y += 40 + 18;
  lines.forEach((l, i) => {
    const last = i === lines.length - 1;
    font(ctx, { family: "display", size: nameSize, italic: last });
    draw(ctx, l, colX, y + nameLH * i + nameSize * 0.74, { fill: last ? pal.accent : pal.ink });
  });
  y += nameLH * lines.length;
  if (leanRows.length) {
    y += 14;
    font(ctx, { family: "body", size: 24, weight: 500 });
    leanRows.forEach((r, i) => draw(ctx, r, colX, y + 30 * i + 22, { fill: pal.accent }));
    y += 30 * leanRows.length;
  }
  y += 22;
  font(ctx, { family: "display", size: lineSize, italic: true });
  rows.forEach((r, i) => draw(ctx, r, colX, y + lineSize * 1.2 * i + lineSize * 0.9, { fill: pal.ink }));
  y += lineSize * 1.2 * rows.length;
  if (flagRows.length) {
    y += 22;
    font(ctx, { family: "mono", size: 16, weight: 500 });
    const tw = measure(ctx, "RED FLAG", 2.6);
    ctx.fillStyle = pal.ink;
    ctx.fillRect(colX, y, tw + 16, 28);
    draw(ctx, "RED FLAG", colX + 8, y + 20, { fill: pal.bottom, tracking: 2.6 });
    y += 30 + 8;
    font(ctx, { family: "body", size: 24, weight: 500 });
    flagRows.forEach((r, i) => draw(ctx, r, colX, y + 30 * i + 22, { fill: pal.ink }));
  }

  const size = Math.min(440, midBottom - midTop);
  const by = midTop + (midBottom - midTop - size) / 2;
  bloom(ctx, card.bloom, P, by, size, pal.ink, makePath);
  // Inside the bloom's own square, clear of the words column.
  seasonSticker(ctx, card, pal, P + size * 0.82, by + size * 0.1, 72);
}

/**
 * Draw `format` of `card` onto `ctx` (already sized by SIZES[format]).
 * `card` is either a stranger-safe payload or the owner's with `choices`,
 * which are applied here so the image matches the switches.
 */
export function drawCard(ctx, format, card, { makePath = (d) => new Path2D(d), justTurned = false } = {}) {
  const c = applyChoices(card);
  if (format === "season") {
    if (!c.season) throw new Error("This card has no season to draw");
    drawSeasonStory(ctx, c, makePath, { justTurned });
  } else if (format === "square") {
    drawSquare(ctx, c, makePath);
  } else {
    drawStory(ctx, c, makePath);
  }
}

/** The card as a PNG Blob. One canvas at a time, released after export. */
export async function renderCard(format, card, { justTurned = false, fontTimeoutMs = 3000 } = {}) {
  await waitForCardFonts(fontTimeoutMs);
  const [w, h] = SIZES[format] || SIZES.story;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  try {
    drawCard(canvas.getContext("2d"), format, card, { justTurned });
    return await new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't make the image"))), "image/png");
    });
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}
