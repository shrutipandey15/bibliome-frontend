// A stable colour per identity, so the same person is the same avatar every
// time they show up — shared by every chat surface (ResonanceThread,
// CollectionChat) so a reader who's in both reads as one visual language,
// not two ad-hoc hashes that happen to agree.
const AVATAR_COLORS = ["var(--res-accent, var(--brass))", "var(--moss)", "var(--plum)", "var(--ink-blue)", "var(--brass)"];

export function avatarColor(seed) {
  let h = 0;
  for (const ch of seed || "") h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
