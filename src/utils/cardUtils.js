// The card is a 2:2.92 plate, but nowhere anyone shares it is that shape. A
// 9:16 frame is what Instagram Stories, WhatsApp Status and Snapchat all expect;
// exporting the bare plate meant the reader got a portrait rectangle that those
// apps then letterboxed against their own default background. So the plate is
// composited onto a story canvas here, on a ground taken from its own archetype
// colour, and lands as something already the right shape to post.
const STORY = { w: 1080, h: 1920, margin: 96 };

/** `--dc` is the archetype's colour, set on the card itself — the ground is
 *  drawn from it so the export doesn't look like a sticker on a black square. */
function storyGround(ctx, accent) {
  ctx.fillStyle = "#0C0A09";
  ctx.fillRect(0, 0, STORY.w, STORY.h);
  if (!accent) return;
  const glow = ctx.createRadialGradient(
    STORY.w * 0.78, STORY.h * 0.06, 0,
    STORY.w * 0.78, STORY.h * 0.06, STORY.h * 0.62
  );
  try {
    glow.addColorStop(0, accent);
    glow.addColorStop(1, "rgba(12,10,9,0)");
  } catch { return; }   // an unparseable custom property is not worth failing over
  ctx.globalAlpha = 0.34;
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, STORY.w, STORY.h);
  ctx.globalAlpha = 1;
}

/**
 * @param {HTMLElement} domNode  the `.dna-card` plate
 * @param {string} username      used for the filename
 * @param {{story?: boolean}} opts  `story: false` exports the bare plate
 */
export async function saveCardAsImage(domNode, username, { story = true } = {}) {
  if (!domNode) return;

  try {
    const { default: html2canvas } = await import("html2canvas");
    const clone = domNode.cloneNode(true);
    
    clone.style.position = "fixed";
    clone.style.left = "-9999px";
    clone.style.top = "0";
    document.body.appendChild(clone);

    const sanitizeColor = (val) => {
      if (!val || typeof val !== "string") return val;
      return val.replace(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+))?\)/g,
        (_, r, g, b, a) => {
          const ri = Math.round(parseFloat(r) * 255);
          const gi = Math.round(parseFloat(g) * 255);
          const bi = Math.round(parseFloat(b) * 255);
          const ai = a !== undefined ? parseFloat(a) : 1;
          return `rgba(${ri}, ${gi}, ${bi}, ${ai})`;
        }
      );
    };

    const resolveStyles = (src, dst) => {
      const computed = window.getComputedStyle(src);
      dst.style.cssText = "";
      for (const prop of computed) {
        let val = computed.getPropertyValue(prop);
        val = sanitizeColor(val);
        try { dst.style.setProperty(prop, val); } catch {}
      }
      for (let i = 0; i < src.children.length; i++) {
        if (dst.children[i]) resolveStyles(src.children[i], dst.children[i]);
      }
    };
    resolveStyles(domNode, clone);

    clone.style.animation = "none";
    clone.querySelectorAll("*").forEach((el) => el.style.animation = "none");

    // Render the plate at whatever scale puts it at its final width in the story
    // frame, so it is composited 1:1 rather than blown up afterwards.
    const cardWidth = domNode.getBoundingClientRect().width || 372;
    const targetWidth = STORY.w - STORY.margin * 2;
    const scale = story ? Math.max(2, targetWidth / cardWidth) : 3;

    const canvas = await html2canvas(clone, {
      backgroundColor: story ? null : "#0c0c10",
      scale,
      useCORS: true,
      logging: false,
    });
    // `--dc` can still be an unresolved `var(--oxblood)` when the archetype
    // carries no colour of its own; follow it one hop to the theme token.
    let accent = window.getComputedStyle(domNode).getPropertyValue("--dc").trim();
    const indirect = accent.match(/^var\(\s*(--[\w-]+)/);
    if (indirect) {
      accent = window.getComputedStyle(document.documentElement)
        .getPropertyValue(indirect[1]).trim();
    }
    document.body.removeChild(clone);

    let out = canvas;
    if (story) {
      out = document.createElement("canvas");
      out.width = STORY.w;
      out.height = STORY.h;
      const ctx = out.getContext("2d");
      storyGround(ctx, accent);

      // Fit the plate inside the margins — width-first, but never letting a tall
      // card run off the top and bottom.
      const ratio = canvas.height / canvas.width;
      let w = targetWidth;
      let h = w * ratio;
      const maxH = STORY.h - STORY.margin * 2;
      if (h > maxH) { h = maxH; w = h / ratio; }
      const x = (STORY.w - w) / 2;
      const y = (STORY.h - h) / 2;

      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.75)";
      ctx.shadowBlur = 90;
      ctx.shadowOffsetY = 34;
      ctx.drawImage(canvas, x, y, w, h);
      ctx.restore();
    }

    const link = document.createElement("a");
    link.download = `bibliome-${username || "card"}${story ? "-story" : ""}.png`;
    link.href = out.toDataURL("image/png");
    link.click();
    return true;
  } catch (err) {
    console.error("Image generation failed", err);
    throw err;
  }
}

export async function shareLink(title, url) {
  if (navigator.share && navigator.canShare) {
    try {
      await navigator.share({ url });
      return true;
    } catch (err) {
      if (err.name === "AbortError") return false;
    }
  }

  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    const input = document.createElement("input");
    input.value = url;
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    document.body.removeChild(input);
    return true;
  }
}