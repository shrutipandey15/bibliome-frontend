export async function saveCardAsImage(domNode, username) {
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

    const canvas = await html2canvas(clone, {
      backgroundColor: "#0c0c10",
      scale: 3,
      useCORS: true,
      logging: false,
    });
    document.body.removeChild(clone);

    const link = document.createElement("a");
    link.download = `bibliome-${username || "card"}.png`;
    link.href = canvas.toDataURL("image/png");
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