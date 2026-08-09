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
    blind_spots: ["boredom", "revulsion"],
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
    expect(screen.getByText("grief")).toBeInTheDocument();
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
    expect(bars.length).toBe(18);
    expect(container.querySelectorAll(".dna-fp-bar--none").length).toBe(15);

    // Tallest first, scaled to this reader's own peak.
    expect(bars[0].style.height).toBe("100%");
    expect(bars[1].style.height).toBe("33%");

    // Only registers actually felt are named underneath.
    expect(screen.getByText("grief")).toBeInTheDocument();
    expect(screen.queryByText("boredom")).not.toBeInTheDocument();
  });

  it("falls back to top_emotions when a surface predates the tally", () => {
    const { container } = render(<DNACard profile={profile} username="alice" />);
    expect(container.querySelectorAll(".dna-fp-bar").length).toBe(2);
    expect(screen.getByText("grief")).toBeInTheDocument();
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
});
