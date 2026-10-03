// Card payload fixtures for the card tests, shaped like the backend's
// dna_card.card_payload_from — one per archetype, from the frontend's own
// mirror of the copy (checked against the backend by dna_contract_check.py).
import { ARCHETYPES } from "../../data/archetypes";

const PAL = { top: "#22343E", bottom: "#121C22", accent: "#9FC3D4", ink: "#F6EEDF" };

export const BLOOM = {
  size: 1000,
  layers: [
    { d: "M500 500L500 20Z", stroke: 0.08, width: 3 },
    { d: "M500 500L600 100Z", fill: 0.4 },
    { d: "M500 500L400 100Z", fill: 1 },
    { d: "M480 500A20 20 0 1 0 520 500Z", fill: 1 },
  ],
  top: [
    { slug: "grief", label: "heartbreak", count: 14 },
    { slug: "catharsis", label: "catharsis", count: 9 },
    { slug: "haunted", label: "haunted", count: 7 },
  ],
  felt: 9,
};

export function cardFor(a, extra = {}) {
  return {
    archetype: { id: a.id, name: a.name, article: a.article, share_line: a.shareLine, red_flag: a.redFlag },
    palette: PAL,
    bloom: BLOOM,
    tagged_count: 34,
    book_count: 40,
    year: 2026,
    leaning: null,
    runner_up: null,
    red_flag: a.redFlag,
    season: null,
    ...extra,
  };
}

export const SEASON = {
  id: "world_diver", name: "The World-Diver", article: "a", home: false,
  since: "2026-08-02", books: 6, palette: PAL,
  bloom: { ...BLOOM, top: [{ slug: "awe", label: "awe", count: 5 }, { slug: "thrill", label: "page-turner", count: 4 }] },
};

export const ALL = ARCHETYPES.map((a) => cardFor(a));
export const GRIEF = cardFor(ARCHETYPES.find((a) => a.id === "grief_romantic"), { season: SEASON });
