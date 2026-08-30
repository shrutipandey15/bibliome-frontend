import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Register from "./Register";

const base = {
  warming: false,
  earned_count: 2,
  total: 5,
  next: {
    kind: "dnf_reason", band: "reading", label: "DNF reason",
    sub: "the reason your unfinished books have in common",
    achieved: false, have: 2, need: 3, unit: "books",
  },
  bands: [
    {
      key: "milestone", label: "Milestones — your reading life",
      earned: [
        { kind: "first_book", band: "milestone", label: "Logged your first book",
          sub: "the shelf began", achieved: true, achieved_at: "2026-01-04T00:00:00Z",
          have: 1, need: 1, unit: "book" },
      ],
      ahead: [
        { kind: "year_of_reflection", band: "milestone", label: "A year of consistent reflection",
          sub: "a full year between your first entry and your latest", achieved: false,
          have: 3, need: 12, unit: "months" },
      ],
    },
    {
      key: "reading", label: "Readings — what the mirror can see",
      earned: [
        { kind: "range", band: "reading", label: "Range",
          sub: "how wide across the vocabulary your reading reaches", achieved: true,
          have: 12, need: 8 },
      ],
      ahead: [
        { kind: "dnf_reason", band: "reading", label: "DNF reason",
          sub: "the reason your unfinished books have in common", achieved: false,
          have: 2, need: 3, unit: "books" },
      ],
    },
  ],
};

describe("Register", () => {
  it("shows earned rows with their date and ahead rows with a measure", () => {
    render(<Register register={base} />);
    expect(screen.getByText("Logged your first book")).toBeInTheDocument();
    expect(screen.getByText("Jan 2026")).toBeInTheDocument();
    expect(screen.getByText("A year of consistent reflection")).toBeInTheDocument();
    expect(screen.getByText("3 / 12 months")).toBeInTheDocument();
  });

  it("lifts exactly one 'next', with a concrete remaining count", () => {
    render(<Register register={base} />);
    expect(screen.getByText("next · closest to earning")).toBeInTheDocument();
    expect(screen.getByText("1 book to go")).toBeInTheDocument(); // need 3 - have 2
  });

  it("carries no streak / countdown / urgency language", () => {
    const { container } = render(<Register register={base} />);
    expect(container.textContent).not.toMatch(/streak|days left|hurry|keep it up|don't break/i);
  });

  it("shows the masthead by default and drops it when told to (fold mounts it itself)", () => {
    const { rerender } = render(<Register register={base} />);
    expect(screen.getByText("fig. 04 · the register")).toBeInTheDocument();
    rerender(<Register register={base} hideMasthead />);
    expect(screen.queryByText("fig. 04 · the register")).not.toBeInTheDocument();
    // the body still renders
    expect(screen.getByText("Logged your first book")).toBeInTheDocument();
  });

  it("with everything earned it reads as a record: no 'next', a plain tally", () => {
    const done = {
      ...base, next: null, earned_count: 2, total: 2,
      bands: base.bands.map((b) => ({ ...b, ahead: [] })),
    };
    render(<Register register={done} />);
    expect(screen.queryByText("next · closest to earning")).not.toBeInTheDocument();
    expect(screen.getByText("Range")).toBeInTheDocument();
    expect(screen.getByText("2 earned")).toBeInTheDocument();
  });

  it("warming: leads with what's earned and says the readings are still coming", () => {
    const warming = {
      warming: true, next: null, earned_count: 1, total: 3,
      bands: [
        base.bands[0],
        { key: "reading", label: "Readings — what the mirror can see", earned: [],
          ahead: [{ kind: "dna_ready", band: "reading", label: "The mirror can read you",
            sub: "five opened books with a feeling — the DNA starts computing",
            achieved: false, have: 3, need: 5, unit: "books" }] },
      ],
    };
    render(<Register register={warming} />);
    expect(screen.getByText(/mirror is still warming up/i)).toBeInTheDocument();
    expect(screen.getByText("The mirror can read you")).toBeInTheDocument();
    expect(screen.getByText("3 / 5 books")).toBeInTheDocument();
  });

  it("renders nothing when there is nothing to show", () => {
    const { container } = render(
      <Register register={{ warming: true, next: null, earned_count: 0, total: 0, bands: [] }} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
