import { EMOTIONS } from "../../services/emotions";

// How a verdict reads inside the basis line. `gave_up` is the backend's key
// for an abandoned book, which counts as a judgement for the Discerning Reader.
const VERDICT_WORDS = {
  loved: "loved", liked: "liked", mixed: "mixed", not_for_me: "not for me", gave_up: "put down",
};

/**
 * The evidence under the label: "heartbreak in 14 of your 31 books · your 3
 * highest-rated were all heartbreak". Counts only, no adjectives — every clause
 * is something the reader can go and count for themselves. Shown under the card
 * on the reader's own DNA page; the card itself stays the shareable shape.
 */
export default function BasisLine({ basis }) {
  if (!basis) return null;
  const counts = (basis.counts || []).slice(0, 2);
  const topRated = basis.top_rated_emotions || [];
  const clauses = counts.map((c) => {
    const emo = EMOTIONS[c.emotion];
    return `${(emo?.name || c.emotion).toLowerCase()} in ${c.books} of your ${c.of} books`;
  });
  // The Discerning Reader is earned from verdicts, so its receipt is verdicts:
  // "not for me in 6 of your 9 judged books · put down 2 of 9".
  (basis.verdicts || []).slice(0, 2).forEach((v, i) => {
    const word = VERDICT_WORDS[v.verdict] || v.verdict;
    clauses.push(i === 0
      ? `${word} in ${v.books} of your ${v.of} judged books`
      : `${word} ${v.books} of ${v.of}`);
  });
  // Only when the reader's highest-rated books agree on ONE register. Listing
  // three is a list, not a finding, and "all" would then be a lie.
  if (topRated.length === 1) {
    const emo = EMOTIONS[topRated[0]];
    const n = basis.top_rated_n || 3;
    clauses.push(`your ${n} highest-rated were all ${(emo?.name || topRated[0]).toLowerCase()}`);
  }
  if (clauses.length === 0) return null;
  return <p className="dna-basis">{clauses.join(" · ")}</p>;
}
