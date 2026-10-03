import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// The share button hits the network + renders ShareModal; stub both out.
vi.mock("../services/api", () => ({ generateShareToken: vi.fn() }));
vi.mock("./ShareModal", () => ({ default: () => null }));

import DNACard from "./DNACard";

const profile = {
  book_count: 12,
  personality: {
    id: "grief-romantic",
    name: "The Grief Romantic",
    description: "You read toward the ache.",
    color: "#6B4F8E",
    glyph: "◈",
    blind_spots: ["nostalgia", "beauty"],
  },
  top_emotions: [
    { emotion_id: "grief", count: 9 },
    { emotion_id: "longing", count: 5 },
  ],
};

describe("DNACard signature render [F2.4 / F2.11]", () => {
  it("renders the personality and an emotional fingerprint using canonical labels", () => {
    render(<DNACard profile={profile} username="alice" />);

    // Personality name (split across first/rest) and volume count.
    expect(screen.getByText(/Grief Romantic/)).toBeInTheDocument();
    expect(screen.getByText(/12 VOLUMES/)).toBeInTheDocument();

    // Fingerprint rows use the SERVER-CANONICAL labels (F1.5), lowercased —
    // "grief"/"longing", NOT the old divergent "melancholy"/"nostalgia".
    expect(screen.getByText("heartbreak")).toBeInTheDocument();
    expect(screen.getByText("longing")).toBeInTheDocument();
    expect(screen.queryByText("melancholy")).not.toBeInTheDocument();
    expect(screen.queryByText("nostalgia")).not.toBeInTheDocument();
  });

  it("draws the fingerprint from this reader's own register tally", () => {
    const { container } = render(
      <DNACard
        profile={{ ...profile, emotion_counts: { grief: 9, awe: 3, rage: 1 } }}
        username="alice"
      />
    );

    // One bar per register in the vocabulary — including the ones never reached,
    // which are the half of the fingerprint that actually distinguishes readers.
    const bars = container.querySelectorAll(".dna-fp-bar");
    expect(bars.length).toBe(21);
    expect(container.querySelectorAll(".dna-fp-bar--none").length).toBe(18);

    // Tallest first, scaled to this reader's own peak.
    expect(bars[0].style.height).toBe("100%");
    expect(bars[1].style.height).toBe("33%");

    // Only registers actually felt are named underneath.
    expect(screen.getByText("heartbreak")).toBeInTheDocument();
    expect(screen.queryByText("nostalgia")).not.toBeInTheDocument();
  });

  it("falls back to top_emotions when a surface predates the tally", () => {
    const { container } = render(<DNACard profile={profile} username="alice" />);
    expect(container.querySelectorAll(".dna-fp-bar").length).toBe(2);
    expect(screen.getByText("heartbreak")).toBeInTheDocument();
  });

  it("shows the archetype's share only when the backend can support one", () => {
    const { rerender } = render(<DNACard profile={profile} username="alice" />);
    expect(screen.queryByText(/shared by/i)).not.toBeInTheDocument();

    rerender(<DNACard profile={{ ...profile, archetype_share: 3 }} username="alice" />);
    expect(screen.getByText("shared by 3% of readers")).toBeInTheDocument();
  });

  it("renders nothing without a personality (honest empty)", () => {
    const { container } = render(<DNACard profile={{ personality: null }} username="alice" />);
    expect(container.querySelector(".dna-card")).toBeNull();
  });

  // ── One engine: the backend's card shape (`archetype`) ──

  it("renders the backend's one card shape, and still reads a legacy payload", () => {
    // What /public/shared/{token} and the profile signature now return.
    const card = {
      handle: "alice",
      book_count: 12,
      archetype: profile.personality,
      top_emotions: [{ emotion_id: "grief", weight: 0.42 }, { emotion_id: "longing", weight: 0.19 }],
    };
    const { rerender } = render(<DNACard profile={card} username="alice" />);
    expect(screen.getByText(/Grief Romantic/)).toBeInTheDocument();
    // A share is rendered as a share — printing "42" here would read as 42 books
    // on a shelf of twelve.
    expect(screen.getByText("42%")).toBeInTheDocument();
    expect(screen.getByText(/share of recent reading/i)).toBeInTheDocument();

    rerender(<DNACard profile={profile} username="alice" />);
    expect(screen.getByText(/Grief Romantic/)).toBeInTheDocument();
    expect(screen.getByText("9")).toBeInTheDocument();          // a count stays a count
  });

  it("renders nothing when the engine abstained", () => {
    const { container } = render(<DNACard profile={{ ...profile, personality: null, archetype: null }} username="alice" />);
    expect(container.querySelector(".dna-card")).toBeNull();
  });

  // ── The label stops overstating itself ──

  // The hedge is the BACKEND's call, carried by the presence of `runner_up`. These
  // tests deliberately say nothing about `margin`: pinning them to a threshold is
  // what let the card and the engine drift apart in the first place.

  it("names the archetype it leans toward when the backend sent one [Aliveness F3]", () => {
    render(
      <DNACard profile={{ ...profile, runner_up: "The Soft Masochist" }} username="alice" />
    );
    // The public payload carries only the name; the card words it the same way.
    expect(screen.getByText("leaning toward the Soft Masochist")).toBeInTheDocument();
    expect(screen.queryByText(/closest to|shading toward/i)).not.toBeInTheDocument();
  });

  it("asserts the name plainly when the backend sent no runner-up", () => {
    render(<DNACard profile={{ ...profile, runner_up: null }} username="alice" />);
    expect(screen.queryByText(/leaning toward/i)).not.toBeInTheDocument();
  });

  it("shows the owner's season under the name, and says how many archetypes there are", () => {
    render(
      <DNACard
        profile={{ ...profile, season: { id: "world_diver", name: "The World-Diver", since: `${new Date().getFullYear()}-08-02`, home: false } }}
        username="alice"
      />
    );
    expect(screen.getByText(/^in a World-Diver season · since August/)).toBeInTheDocument();
    expect(screen.getByText(/ONE OF TWELVE/)).toBeInTheDocument();
  });

  // The regression. `card_payload` — the share link, your profile, a public
  // profile — ships `margin` and NO `runner_up`. The card used to read the number,
  // so a thin margin drew "closest to" over the name with nothing underneath it.
  // Neither half of the hedge may appear without the other.
  it("never orphans the hedge on a payload carrying margin but no runner-up", () => {
    render(<DNACard profile={{ ...profile, margin: 0.04 }} username="alice" />);
    expect(screen.queryByText(/leaning toward/i)).not.toBeInTheDocument();
  });

  it("prints the basis under the name — counts the reader can go and check", () => {
    render(
      <DNACard
        profile={{
          ...profile,
          basis: {
            counts: [{ emotion: "grief", books: 14, of: 31 }],
            top_rated_emotions: ["shock"],
            top_rated_n: 3,
          },
        }}
        username="alice"
      />
    );
    expect(screen.getByText(/heartbreak in 14 of your 31 books/)).toBeInTheDocument();
    expect(screen.getByText(/your 3 highest-rated were all shock/)).toBeInTheDocument();
  });

  it("gives the Discerning Reader a verdict receipt, not a feeling one [v3]", () => {
    render(
      <DNACard
        profile={{
          ...profile,
          archetype: { id: "discerning_reader", name: "The Discerning Reader", description: "x", color: "#6E6E6E", glyph: "◌" },
          basis: {
            counts: [],
            verdicts: [{ verdict: "not_for_me", books: 6, of: 9 }, { verdict: "gave_up", books: 2, of: 9 }],
            top_rated_emotions: [],
            top_rated_n: 0,
          },
        }}
        username="alice"
      />
    );
    expect(screen.getByText(/not for me in 6 of your 9 judged books · put down 2 of 9/)).toBeInTheDocument();
  });

  it("makes no 'all' claim when the top-rated books disagree", () => {
    render(
      <DNACard
        profile={{
          ...profile,
          basis: {
            counts: [{ emotion: "grief", books: 14, of: 31 }],
            top_rated_emotions: ["shock", "rage", "awe"],
            top_rated_n: 3,
          },
        }}
        username="alice"
      />
    );
    expect(screen.getByText(/heartbreak in 14 of your 31 books/)).toBeInTheDocument();
    expect(screen.queryByText(/highest-rated/)).not.toBeInTheDocument();
  });

  it("makes no claim it can't support: 'no two alike' is gone", () => {
    // Two eight-book readers who both tag grief and comfort draw the same
    // silhouette. The card no longer says otherwise.
    render(<DNACard profile={{ ...profile, emotion_counts: { grief: 9, awe: 3 } }} username="alice" />);
    expect(screen.queryByText(/no two alike/i)).not.toBeInTheDocument();
    expect(screen.getByText(/books per register/i)).toBeInTheDocument();
  });
});
