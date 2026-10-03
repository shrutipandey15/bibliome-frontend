import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DNACard from "./DNACard";

// The backend's card payload (dna_card.card_payload_from), cut down.
const card = {
  archetype: {
    id: "grief_romantic", name: "The Grief Romantic", article: "a",
    share_line: "Loss isn't my enemy. Numbness is.", red_flag: "I avoid neat happy endings",
    description: "You seek books that break your heart…",
  },
  palette: { top: "#22343E", bottom: "#121C22", accent: "#9FC3D4", ink: "#F6EEDF" },
  bloom: {
    size: 1000,
    layers: [{ d: "M0 0Z", stroke: 0.08, width: 3 }, { d: "M1 1Z", fill: 1 }],
    top: [
      { slug: "grief", label: "heartbreak", count: 14 },
      { slug: "catharsis", label: "catharsis", count: 9 },
      { slug: "haunted", label: "haunted", count: 7 },
    ],
  },
  tagged_count: 34,
  book_count: 40,
  year: 2026,
  leaning: null,
  runner_up: null,
  red_flag: "I avoid neat happy endings",
  season: { id: "world_diver", name: "The World-Diver", article: "a", home: false },
};

describe("DNACard — the in-app card", () => {
  it("says it in the first person: I'm a Grief Romantic", () => {
    render(<DNACard card={card} />);
    expect(screen.getByText("I'm a")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Grief Romantic." })).toBeInTheDocument();
    expect(screen.getByText("Loss isn't my enemy. Numbness is.")).toBeInTheDocument();
  });

  it("counts tagged books in the header, not the shelf", () => {
    render(<DNACard card={card} />);
    expect(screen.getByText("34 BOOKS · 2026")).toBeInTheDocument();
  });

  it("prints the same three numbers the bloom's solid petals stand for", () => {
    render(<DNACard card={card} />);
    const items = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(items).toEqual(["14 heartbreak", "9 catharsis", "7 haunted"]);
  });

  it("describes the bloom for screen readers", () => {
    render(<DNACard card={card} />);
    expect(screen.getByRole("img", {
      name: "A bloom of petals, one per feeling, longest for heartbreak, catharsis and haunted.",
    })).toBeInTheDocument();
  });

  it("shows the season sticker and the red flag when they're on", () => {
    render(<DNACard card={card} />);
    expect(screen.getByLabelText("Now in a World-Diver season")).toBeInTheDocument();
    expect(screen.getByText("I avoid neat happy endings")).toBeInTheDocument();
  });

  it("says 'in my element' when the season is the reader's own archetype", () => {
    render(<DNACard card={{ ...card, season: { ...card.season, id: "grief_romantic", name: "The Grief Romantic", home: true } }} />);
    expect(screen.getByText("element")).toBeInTheDocument();
  });

  it("leaves off what a stranger's payload left off", () => {
    render(<DNACard card={{ ...card, season: null, red_flag: null }} />);
    expect(screen.queryByText(/red flag/i)).toBeNull();
    expect(screen.queryByText(/season/i)).toBeNull();
  });

  it("applies the owner's own switches, so the DNA tab shows what strangers see", () => {
    render(<DNACard card={{ ...card, choices: { season: false, red_flag: false } }} />);
    expect(screen.queryByText("I avoid neat happy endings")).toBeNull();
    expect(screen.queryByLabelText(/season/)).toBeNull();
  });

  it("carries the hedge whenever the engine sent one", () => {
    render(<DNACard card={{ ...card, leaning: { id: "obsessive_romantic", name: "The Obsessive Romantic" } }} />);
    expect(screen.getByText("leaning toward the Obsessive Romantic")).toBeInTheDocument();
  });

  it("puts 'an' before a vowel and keeps a one-word name whole", () => {
    render(<DNACard card={{ ...card, archetype: { ...card.archetype, id: "world_diver", name: "The World-Diver" } }} />);
    expect(screen.getByRole("heading", { name: "World-Diver." })).toBeInTheDocument();
    const { container } = render(<DNACard card={{ ...card, archetype: { ...card.archetype, name: "The Adrenaline Seeker", article: "an" } }} />);
    expect(container).toHaveTextContent("I'm an");
  });

  it("takes its colours from the payload's palette", () => {
    const { container } = render(<DNACard card={card} />);
    const el = container.querySelector(".dnacard");
    expect(el.style.getPropertyValue("--dc-top")).toBe("#22343E");
    expect(el.style.getPropertyValue("--dc-accent")).toBe("#9FC3D4");
  });

  it("has no fixed shape to clip it", () => {
    const { container } = render(<DNACard card={card} />);
    const el = container.querySelector(".dnacard");
    expect(el.style.aspectRatio).toBe("");
  });

  it("renders nothing without an archetype, and makes no comparison claims", () => {
    const { container } = render(<DNACard card={{ ...card, archetype: null }} />);
    expect(container).toBeEmptyDOMElement();
    const again = render(<DNACard card={card} />);
    expect(again.container).not.toHaveTextContent(/no two alike|% of readers|rarest/i);
  });

  it("renders children under the card", () => {
    render(<DNACard card={card}><button type="button">Share my card</button></DNACard>);
    expect(screen.getByRole("button", { name: "Share my card" })).toBeInTheDocument();
  });
});
