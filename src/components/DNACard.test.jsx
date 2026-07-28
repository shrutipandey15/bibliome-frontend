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

  it("renders nothing without a personality (honest empty)", () => {
    const { container } = render(<DNACard profile={{ personality: null }} username="alice" />);
    expect(container.querySelector(".dna-card")).toBeNull();
  });
});
