import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Patterns } from "./Panels";

const baseStats = {
  total_books: 10,
  avg_intensity: 7.2,
  books_per_month: 3,
  emotion_diversity: 62,
  most_common_emotion: "grief",
  most_common_emotion_count: 6,
  highest_intensity_book: { title: "Piranesi", author: "Susanna Clarke", intensity: 10, quote: "beautiful" },
};

describe("Patterns / emotion ledger [F5.2 / F5.3]", () => {
  it("renders the full ledger from emotion_counts", () => {
    const stats = { ...baseStats, emotion_counts: { grief: 6, awe: 3, amusement: 1 } };
    render(<Patterns stats={stats} heatmap={null} />);
    // Ranked rows appear using the plain word ("grief"). "grief" also shows in the
    // most-felt tile, so allow more than one match.
    expect(screen.getAllByText("heartbreak").length).toBeGreaterThan(0);
    expect(screen.getByText("awe")).toBeInTheDocument();
    // Counts render as n/total.
    expect(screen.getByText("6/10")).toBeInTheDocument();
    // Not the empty message.
    expect(screen.queryByText(/no emotions tagged yet/i)).toBeNull();
  });

  it("shows an honest empty ledger (not a silent blank box) when there are no counts", () => {
    const stats = { ...baseStats, emotion_counts: {} };
    render(<Patterns stats={stats} heatmap={null} />);
    expect(screen.getByText(/no emotions tagged yet/i)).toBeInTheDocument();
  });

  it("shows the whole-view empty state when nothing is shelved yet", () => {
    render(<Patterns stats={{ total_books: 0 }} heatmap={null} />);
    expect(screen.getByText(/not enough yet/i)).toBeInTheDocument();
  });
});
