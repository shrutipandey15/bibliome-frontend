import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";

// Isolate DNAView from the shareable card's network/ShareModal deps. The stub
// still renders the `footer` slot — DNAView puts the archetype's description
// there, and swallowing it would hide real layout rather than a network call.
// `cardProps` captures what DNAView actually handed the card, so a test can
// assert on fields the stub doesn't render.
const cardProps = {};
vi.mock("../DNACard", () => ({
  default: ({ footer, profile }) => {
    Object.assign(cardProps, profile || {});
    return <div data-testid="dna-card">{footer}</div>;
  },
}));

// DNAView no longer calls the API — snapshot history arrives on the profile
// payload as `snapshot_count`. The mock stays only to catch a regression that
// reintroduces a request.
const evolutionPoints = vi.fn(async () => []);
vi.mock("../../services/api", () => ({ getDNAEvolution: (...a) => evolutionPoints(...a) }));

import DNAView from "./DNAView";
import { EMO_LIST } from "../../services/emotions";

// Renders through act() so any effect-driven update stays inside the test.
async function renderView(props) {
  let utils;
  await act(async () => { utils = render(<DNAView {...props} />); });
  return utils;
}

beforeEach(() => {
  evolutionPoints.mockReset();
  evolutionPoints.mockResolvedValue([]);
});

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
  it("renders NO insight below the gate — the honest empty state only", async () => {
    await renderView({ profile: belowGate, username: "alice" });
    expect(screen.getByText(/at 5, the mirror starts to see you/i)).toBeInTheDocument();
    expect(document.querySelector(".insight")).toBeNull();
    expect(screen.queryByText(/2\.3 points/)).toBeNull();
  });

  // ── The engine is allowed to abstain [P0-2] ──

  it("says so when the engine named nobody, rather than showing a card", async () => {
    // `enough: true` with `archetype: null` is a real payload now: the reader is
    // past the gate and their tally still has no clear favourite.
    await renderView({ profile: { ...fullProfile, archetype: null }, username: "alice" });
    expect(screen.getByText(/not enough tagged books to name a shorthand yet/i)).toBeInTheDocument();
    expect(screen.queryByTestId("dna-card")).toBeNull();
    // The findings are still theirs — abstaining on the label hides nothing else.
    expect(screen.getByText(/2\.3 points higher/)).toBeInTheDocument();
  });

  it("does not treat a missing archetype as 'not enough' [P0-2]", async () => {
    // The `enough` fallback used to read `|| !!profile.archetype`, which flips the
    // wrong way once the engine can legitimately return null.
    await renderView({ profile: { ...fullProfile, archetype: null }, username: "alice" });
    expect(screen.queryByText(/the mirror starts to see you/i)).toBeNull();
  });

  it("passes the margin, runner-up and basis through to the card [P2-8]", async () => {
    const spy = vi.fn();
    await renderView({
      profile: { ...fullProfile, margin: 0.04, runner_up: "The Soft Masochist", basis: { counts: [] } },
      username: "alice",
      onSave: spy,
    });
    // The stub records what it was handed; before this the backend computed all
    // three and the card never saw them.
    const card = screen.getByTestId("dna-card");
    expect(card).toBeInTheDocument();
    expect(cardProps.margin).toBe(0.04);
    expect(cardProps.runner_up).toBe("The Soft Masochist");
    expect(cardProps.basis).toEqual({ counts: [] });
    expect(cardProps.archetype.id).toBe("grief-romantic");
  });

  it("shows the honest empty state when there is no profile at all (never fabricates)", async () => {
    await renderView({ profile: null, username: "alice", bookCount: 2 });
    expect(screen.getByText(/the mirror needs/i)).toBeInTheDocument();
    expect(document.querySelector(".insight")).toBeNull();
  });

  it("renders the basis ('from N books') on EVERY insight", async () => {
    await renderView({ profile: fullProfile, username: "alice" });
    const insights = document.querySelectorAll(".insight");
    const bases = document.querySelectorAll(".insight-basis");
    expect(insights.length).toBe(fullProfile.insights.length);
    expect(bases.length).toBe(fullProfile.insights.length);
    bases.forEach((b) => expect(b.textContent).toMatch(/from \d+ books?/));
  });

  it("leads with the strongest insight and DEMOTES the archetype below it [F7.2]", async () => {
    await renderView({ profile: fullProfile, username: "alice" });
    const headline = screen.getByText(/2\.3 points higher/);
    // The archetype is no longer duplicated in DNAView's own markup — the
    // shorthand plate in the right-hand rail carries it, with the description
    // beneath. Demotion is now a property of that rail's position: it follows
    // the whole argument column in document order.
    const rail = document.querySelector(".dna-aside");
    expect(rail).toContainElement(screen.getByTestId("dna-card"));
    expect(rail).toHaveTextContent("You read toward the ache.");
    // eslint-disable-next-line no-bitwise
    const order = headline.compareDocumentPosition(rail);
    expect(order & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows the evolution gap as a text equivalent, not shape/colour alone [F7.3/F7.8]", async () => {
    await renderView({ profile: fullProfile, username: "alice" });
    // Drift moved comfort → devastation; stated plainly in words.
    expect(screen.getByText(/enduringly, you read toward comfort\. lately, devastation/i)).toBeInTheDocument();
    // then / now columns, each captioned with what the weighting actually means.
    expect(screen.getByText("then")).toBeInTheDocument();
    expect(screen.getByText("now")).toBeInTheDocument();
    expect(screen.getByText(/across everything you've logged/i)).toBeInTheDocument();
    expect(screen.getByText(/weighted toward what you've read lately/i)).toBeInTheDocument();
  });

  it("shows locked insights WITH the real reason, no timers [F7.4]", async () => {
    await renderView({ profile: fullProfile, username: "alice" });
    expect(screen.getByText("Seasonality")).toBeInTheDocument();
    // The backend's own requirement text, set as a sentence. No countdown, and no
    // "you are N short" — the payload carries no such figure.
    const locked = document.querySelector(".dna-locked-row");
    expect(locked.textContent).toMatch(/Seasonality waits on 12 months of reading\./i);
    expect(locked.textContent).not.toMatch(/\d+ short|days|weeks left/i);
  });

  it("refuses forbidden framing: no mysticism, no streak, no comparative ranking [F7.5/F7.6]", async () => {
    const { container } = await renderView({ profile: fullProfile, username: "alice" });
    const text = container.textContent;
    expect(text).not.toMatch(/\breveal\b/i);
    expect(text).not.toMatch(/unlock your true self|crystal|the cards/i);
    expect(text).not.toMatch(/streak/i);
    expect(text).not.toMatch(/than \d+%|% of readers|more \w+ than/i);
  });
});

describe("DNAView — the shape of you [F-DNA-3 / F-DNA-9]", () => {
  it("lists EVERY canonical emotion, including ones never tagged", async () => {
    await renderView({ profile: fullProfile, username: "alice" });
    const rows = document.querySelectorAll(".dna-portrait-row");
    // The vocabulary is the full served list, not just the three in `current`.
    expect(rows.length).toBe(EMO_LIST.length);
    expect(rows.length).toBeGreaterThan(fullProfile.profiles.current.length || 3);
  });

  it("renders never-tagged emotions as a blank, not omitted — the blind spot IS the gap", async () => {
    await renderView({ profile: fullProfile, username: "alice" });
    const names = [...document.querySelectorAll(".dna-portrait-name")].map((n) => n.textContent);
    // `tenderness` appears nowhere in the current vector, but must still be listed.
    expect(names).toContain("tenderness");

    const blankRow = [...document.querySelectorAll(".dna-portrait-row")].find(
      (r) => r.querySelector(".dna-portrait-name").textContent === "tenderness"
    );
    expect(blankRow.className).toMatch(/dna-portrait-row--blank/);
    expect(blankRow.querySelector(".dna-portrait-count").textContent).toBe("—");
  });

  it("prints the share as a figure and uses leader dots, never a progress bar", async () => {
    const { container } = await renderView({ profile: fullProfile, username: "alice" });
    // The old bar-chart elements are gone.
    expect(container.querySelector(".dna-portrait-track")).toBeNull();
    expect(container.querySelector(".dna-portrait-fill")).toBeNull();
    expect(container.querySelector(".evo-comp-seg")).toBeNull();
    // Leader dots, and a readable number on the tagged rows.
    expect(container.querySelector(".dna-portrait-leader")).not.toBeNull();
    const devastation = [...container.querySelectorAll(".dna-portrait-row")].find(
      (r) => r.querySelector(".dna-portrait-name").textContent === "devastation"
    );
    // No counts ledger supplied here, so it falls back to the weighted share.
    expect(devastation.querySelector(".dna-portrait-count").textContent).toBe("70");
  });
});

describe("DNAView — the counts ledger and blind spots (mockup pass)", () => {
  // stats.emotion_counts is the /dna/patterns ledger the DNA tab already loads.
  const stats = {
    avg_intensity: 8.5,
    emotion_counts: { devastation: 16, catharsis: 11, dread: 11, comfort: 10, rage: 8 },
  };

  it("prints BOOK COUNTS from the stats ledger, not shares of the weighted vector", async () => {
    const { container } = await renderView({ profile: fullProfile, username: "alice", stats });
    const row = (name) =>
      [...container.querySelectorAll(".dna-portrait-row")].find(
        (r) => r.querySelector(".dna-portrait-name").textContent === name
      );
    expect(row("devastation").querySelector(".dna-portrait-count").textContent).toBe("16");
    expect(row("comfort").querySelector(".dna-portrait-count").textContent).toBe("10");
    // `grief` is in the weighted vector but absent from the ledger — a real blank.
    expect(row("grief").querySelector(".dna-portrait-count").textContent).toBe("—");
  });

  it("sorts by count, leaving the never-reached at the bottom", async () => {
    const { container } = await renderView({ profile: fullProfile, username: "alice", stats });
    const rows = [...container.querySelectorAll(".dna-portrait-row")];
    const names = rows.map((r) => r.querySelector(".dna-portrait-name").textContent);
    expect(names[0]).toBe("devastation");            // 16, the clear leader
    // Ties keep vocabulary order (dread is declared before catharsis; both are 11).
    expect(names.slice(1, 3)).toEqual(["dread", "catharsis"]);

    // Counts never increase as you go down the column.
    const figures = rows
      .map((r) => r.querySelector(".dna-portrait-count").textContent)
      .map((t) => (t === "—" ? 0 : Number(t)));
    expect(figures).toEqual([...figures].sort((a, b) => b - a));

    const blanks = rows.map((r) => r.className.includes("--blank"));
    // Once the blanks start, they never stop — no reached row after a blank one.
    expect(blanks.indexOf(true)).toBe(blanks.lastIndexOf(false) + 1);
  });

  it("marks a blank the archetype names as a blind spot", async () => {
    const { container } = await renderView({ profile: fullProfile, username: "alice", stats });
    // fullProfile's archetype lists `boredom` as a blind spot; it is untagged.
    const boredom = [...container.querySelectorAll(".dna-portrait-row")].find(
      (r) => r.querySelector(".dna-portrait-name").textContent === "boredom"
    );
    expect(boredom.className).toMatch(/dna-portrait-row--flagged/);
    // A blank that is NOT called out stays unflagged.
    const joy = [...container.querySelectorAll(".dna-portrait-row")].find(
      (r) => r.querySelector(".dna-portrait-name").textContent === "joy"
    );
    expect(joy.className).not.toMatch(/--flagged/);
  });

  it("puts volumes and avg intensity in the running head", async () => {
    await renderView({ profile: fullProfile, username: "alice", stats });
    expect(screen.getByText(/47 volumes · avg intensity 8\.5/)).toBeInTheDocument();
  });

  it("omits intensity from the running head until the ledger loads", async () => {
    await renderView({ profile: fullProfile, username: "alice" });
    expect(screen.getByText("47 volumes")).toBeInTheDocument();
    expect(screen.queryByText(/avg intensity/)).toBeNull();
  });

  it("names what the reader said they read for, beside the headline's basis", async () => {
    await renderView({ profile: fullProfile, username: "alice", stats });
    const foot = document.querySelector(".insight--headline .insight-basis");
    expect(foot.textContent).toMatch(/from 47 books · you told me: comfort/);
    // Non-headline insights keep their basis but not the stated-for clause.
    const others = [...document.querySelectorAll(".insight:not(.insight--headline) .insight-basis")];
    expect(others.length).toBeGreaterThan(0);
    others.forEach((o) => {
      expect(o.textContent).toMatch(/from \d+ books?/);
      expect(o.textContent).not.toMatch(/you told me/);
    });
  });
});

describe("DNAView — what's changed / snapshot history [F-DNA-4]", () => {
  it("says 'not enough history' when fewer than two snapshots exist and nothing moved", async () => {
    const steady = {
      ...fullProfile,
      snapshot_count: 1,                                 // one generation only
      drift: 0.01,
      profiles: { enduring: { grief: 0.7, comfort: 0.3 }, current: { grief: 0.7, comfort: 0.3 } },
    };
    await renderView({ profile: steady, username: "alice" });
    await waitFor(() =>
      expect(screen.getByText(/not enough history yet/i)).toBeInTheDocument()
    );
    // Honest about WHY — not a fake "steady" verdict standing in for no data.
    expect(screen.queryByText(/^Steady —/)).toBeNull();
  });

  it("reads the real drift once two snapshots exist", async () => {
    await renderView({ profile: { ...fullProfile, snapshot_count: 2 }, username: "alice" });
    await waitFor(() =>
      expect(screen.getByText(/enduringly, you read toward comfort\. lately, devastation/i)).toBeInTheDocument()
    );
    expect(screen.queryByText(/not enough history yet/i)).toBeNull();
  });

  it("never claims 'no history' on a cached payload that predates snapshot_count", async () => {
    const steady = {
      ...fullProfile,                                    // no snapshot_count key
      drift: 0.01,
      profiles: { enduring: { grief: 1 }, current: { grief: 1 } },
    };
    await renderView({ profile: steady, username: "alice" });
    // Unknown is not zero: say nothing rather than assert an absence of history.
    expect(screen.queryByText(/not enough history yet/i)).toBeNull();
  });

  it("costs no extra request — snapshot history rides on the profile payload", async () => {
    await renderView({ profile: { ...fullProfile, snapshot_count: 2 }, username: "alice" });
    await renderView({ profile: belowGate, username: "alice" });
    expect(evolutionPoints).not.toHaveBeenCalled();
  });
});
