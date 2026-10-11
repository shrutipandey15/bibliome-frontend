// Display-only title case for book titles typed in any case ("the trial",
// "Gone girl"). The stored title is never touched. A word that already carries a
// capital ("iPhone", "McCarthy", "ACOTAR") is left exactly as typed.
const SMALL = new Set(["a", "an", "and", "as", "at", "but", "by", "for", "in", "nor", "of", "on", "or", "the", "to", "vs"]);

export function titleCase(title) {
  if (!title) return title;
  const words = title.split(" ");
  return words
    .map((w, i) => {
      if (w !== w.toLowerCase()) return w;
      const inner = i > 0 && i < words.length - 1 && !/[:—–-]$/.test(words[i - 1]);
      if (inner && SMALL.has(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
}
