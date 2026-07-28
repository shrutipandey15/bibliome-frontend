import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Isolate DNAView from the shareable card's network/ShareModal deps.
vi.mock("../DNACard", () => ({ default: () => <div data-testid="dna-card" /> }));

import DNAView from "./DNAView";

// The REAL backend "v2" payload shape (app/services/dna_insights.build_dna).
const fullProfile = {
  enough: true,
  book_count: 47,
  archetype: { id: "grief-romantic", name: "The Grief Romantic", description: "You read toward the ache.", color: "#6B4F8E", glyph: "◈", blind_spots: ["boredom"] },
  insights: [
    { category: "contradiction", variant: "a", text: "You said you read for comfort. You rate the ones that hurt 2.3 points higher.", n: 47, surprise: 0.9 },
    { category: "blind_spot", variant: "rare", text: "47 books. Never once: tenderness.", n: 47, surprise: 0.7 },
  ],
  locked: [{ category: "seasonality", unlocks_at: "25 books + 12 months", reason: "needs 12 months of reading" }],
  profiles: {
    enduring: { comfort: 0.6, grief: 0.3, devastation: 0.1 },
    current: { devastation: 0.7, grief: 0.2, comfort: 0.1 },
  },
  drift: 0.55,
  reads_for: ["comfort"],
};

const belowGate = {
  enough: false,
  book_count: 3,
  needed: 5,
  message: "3 books in. At 5, the mirror starts to see you.",
};

describe("DNAView — anti-horoscope guards [F7.1 / F7.8]", () => {
  it("renders NO insight below the gate — the honest empty state only", () => {
    render(<DNAView profile={belowGate} username="alice" />);
    expect(screen.getByText(/at 5, the mirror starts to see you/i)).toBeInTheDocument();
    expect(document.querySelector(".insight")).toBeNull();
    expect(screen.queryByText(/2\.3 points/)).toBeNull();
  });

  it("shows the honest empty state when there is no profile at all (never fabricates)", () => {
    render(<DNAView profile={null} username="alice" bookCount={2} />);
    expect(screen.getByText(/the mirror needs/i)).toBeInTheDocument();
    expect(document.querySelector(".insight")).toBeNull();
  });

  it("renders the basis ('from N books') on EVERY insight", () => {
    render(<DNAView profile={fullProfile} username="alice" />);
    const insights = document.querySelectorAll(".insight");
    const bases = document.querySelectorAll(".insight-basis");
    expect(insights.length).toBe(fullProfile.insights.length);
    expect(bases.length).toBe(fullProfile.insights.length);
    bases.forEach((b) => expect(b.textContent).toMatch(/from \d+ books?/));
  });

  it("leads with the strongest insight and DEMOTES the archetype below it [F7.2]", () => {
    render(<DNAView profile={fullProfile} username="alice" />);
    const headline = screen.getByText(/2\.3 points higher/);
    const archetype = document.querySelector(".dna-arch-name");
    expect(archetype).toHaveTextContent("The Grief Romantic");
    // eslint-disable-next-line no-bitwise
    const order = headline.compareDocumentPosition(archetype);
    expect(order & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows the evolution gap as a text equivalent, not shape/colour alone [F7.3/F7.8]", () => {
    render(<DNAView profile={fullProfile} username="alice" />);
    // Drift moved comfort → devastation; stated plainly in words.
    expect(screen.getByText(/enduringly, you read toward comfort\. lately, devastation/i)).toBeInTheDocument();
    expect(screen.getByText("who you've been")).toBeInTheDocument();
    expect(screen.getByText("who you've been lately")).toBeInTheDocument();
  });

  it("shows locked insights WITH the real reason, no timers [F7.4]", () => {
    render(<DNAView profile={fullProfile} username="alice" />);
    expect(screen.getByText("Seasonality")).toBeInTheDocument();
    expect(screen.getByText(/needs 12 months of reading/i)).toBeInTheDocument();
  });

  it("refuses forbidden framing: no mysticism, no streak, no comparative ranking [F7.5/F7.6]", () => {
    const { container } = render(<DNAView profile={fullProfile} username="alice" />);
    const text = container.textContent;
    expect(text).not.toMatch(/\breveal\b/i);
    expect(text).not.toMatch(/unlock your true self|crystal|the cards/i);
    expect(text).not.toMatch(/streak/i);
    expect(text).not.toMatch(/than \d+%|% of readers|more \w+ than/i);
  });
});
