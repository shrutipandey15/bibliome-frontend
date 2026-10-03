// When a save earns an echo. [DNA Aliveness · F1]
//
// The backend always computes the echo for the most recently saved book; the
// client decides whether this save is one that should show it. A new book with
// feelings does; an edit does only when its feelings changed or it was just
// finished. A notes-only edit, a want-to-read, a book with no feelings: no echo.
const ids = (emotions) => new Set((emotions || []).map((e) => e.emotion_id ?? e.id ?? e));

export function shouldEcho(prev, data) {
  if (!data || data.status === "want_to_read") return false;
  if (!(data.emotions || []).length) return false;
  if (!prev) return true;
  const before = ids(prev.emotions);
  const after = ids(data.emotions);
  if (before.size !== after.size || [...after].some((id) => !before.has(id))) return true;
  const done = ["finished", "reread"];
  return done.includes(data.status) && !done.includes(prev.status);
}
