const NUMERALS = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
  [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];

/**
 * A year set like a bookplate — MMXXVI.
 *
 * Lives here rather than on DNACard because two surfaces need it (the plate's
 * year of issue and the study's "keeping this shelf since"), and a page should
 * not have to import a component to format a date.
 */
export function romanYear(year = new Date().getFullYear()) {
  let n = Math.max(0, Math.floor(year));
  let out = "";
  for (const [value, symbol] of NUMERALS) {
    while (n >= value) { out += symbol; n -= value; }
  }
  return out;
}
