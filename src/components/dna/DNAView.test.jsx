import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";

// Isolate DNAView from the card's own rendering and the share sheet's network.
// The stub still renders its children — DNAView puts the share action, the
// receipt and the archetype's description there, and swallowing them would
// hide real layout rather than a network call. `cardProps` captures the card
// DNAView handed over, so a test can assert on fields the stub doesn't render.
const cardProps = {};
vi.mock("../DNACard", () => ({
  default: ({ children, card }) => {
    Object.keys(cardProps).forEach((k) => delete cardProps[k]);
    Object.assign(cardProps, card || {});
    return <div data-testid="dna-card">{children}</div>;
  },
}));
const sheetProps = vi.fn();
vi.mock("../card/ShareSheet", () => ({
  default: (props) => {
    sheetProps(props);
    return (
      <div data-testid="share-sheet">
        {props.initialFormat}
        <button type="button" onClick={() => props.onClose({ season: false, red_flag: false })}>close sheet</button>
      </div>
    );
  },
}));

// DNAView no longer calls the API — snapshot history arrives on the profile
// payload as `snapshot_count`. The mock stays only to catch a regression that
// reintroduces a request.
const evolutionPoints = vi.fn(async () => []);
const shiftSeen = vi.fn(async () => true);
vi.mock("../../services/api", () => ({
  getDNAEvolution: (...a) => evolutionPoints(...a),
  markShiftSeen: (...a) => shiftSeen(...a),
}));

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
  archetype: { id: "grief-romantic", name: "The Grief Romantic", description: "You read toward the ache.", color: "#6B4F8E", glyph: "◈", blind_spots: ["beauty"] },
  insights: [
    { category: "contradiction", variant: "a", text: "You said you read for comfort. You rate the ones that hurt 2.3 points higher.", n: 47, surprise: 0.9 },
    { category: "blind_spot", variant: "rare", text: "47 books. Never once: nostalgia.", n: 47, surprise: 0.7 },
  ],
  locked: [{ category: "seasonality", unlocks_at: "25 books + 12 months", reason: "25 books across a full year of reading, once you've read here that long", have: null, need: 25 }],
  profiles: {
    enduring: { comfort: 0.6, grief: 0.3, shock: 0.1 },
    current: { shock: 0.7, grief: 0.2, comfort: 0.1 },
  },
  drift: 0.55,
  reads_for: ["comfort"],
  // The owner's share card, merged on by the /dna/profile route (backend dna_card).
  card: {
    archetype: { id: "grief_romantic", name: "The Grief Romantic", article: "a",
      share_line: "Loss isn't my enemy. Numbness is.", red_flag: "I avoid neat happy endings" },
    palette: { top: "#22343E", bottom: "#121C22", accent: "#9FC3D4", ink: "#F6EEDF" },
    bloom: { size: 1000, layers: [], top: [] },
    tagged_count: 47, year: 2026, season: null, red_flag: "I avoid neat happy endings",
    choices: { season: true, red_flag: true },
  },
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

  it("hands the card the backend's own card payload, with the receipt under it", async () => {
    await renderView({
      profile: { ...fullProfile, basis: { counts: [{ emotion: "grief", books: 9, of: 47 }] } },
    });
    // One card shape from one engine: the DNA tab no longer adapts the v2
    // payload into a card of its own, so it can't disagree with the share link.
    expect(cardProps.archetype.id).toBe("grief_romantic");
    expect(cardProps.choices).toEqual({ season: true, red_flag: true });
    // The receipt sits under the card on the reader's own page.
    expect(screen.getByText(/heartbreak in 9 of your 47 books/i)).toBeInTheDocument();
  });

  it("opens the share sheet on the story from 'Share my card'", async () => {
    await renderView({ profile: fullProfile });
    expect(screen.queryByTestId("share-sheet")).toBeNull();
    await act(async () => { screen.getByRole("button", { name: /share my card/i }).click(); });
    expect(screen.getByTestId("share-sheet")).toHaveTextContent("story");
  });

  it("never calls a first season a turn", async () => {
    const since = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
    const card = { ...fullProfile.card, season: { id: "world_diver", name: "The World-Diver", home: false, since } };
    // A first season is not a turn.
    await renderView({ profile: { ...fullProfile, card, seasons: [{ id: "world_diver" }] } });
    expect(screen.queryByText(/your season turned/i)).toBeNull();
  });

  it("offers the season story when the season has just turned", async () => {
    const since = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
    const card = { ...fullProfile.card, season: { id: "world_diver", name: "The World-Diver", home: false, since } };
    await renderView({ profile: { ...fullProfile, card, seasons: [{ id: "world_diver" }, { id: "grief_romantic" }] } });
    await act(async () => { screen.getByRole("button", { name: /your season turned — new card ready/i }).click(); });
    expect(screen.getByTestId("share-sheet")).toHaveTextContent("season");
  });

  it("shows the switches the reader just set once the sheet closes", async () => {
    await renderView({ profile: fullProfile });
    await act(async () => { screen.getByRole("button", { name: /share my card/i }).click(); });
    await act(async () => { screen.getByRole("button", { name: "close sheet" }).click(); });
    expect(screen.queryByTestId("share-sheet")).toBeNull();
    expect(cardProps.choices).toEqual({ season: false, red_flag: false });
  });

  it("says nothing about a season the reader switched off", async () => {
    const since = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
    const card = {
      ...fullProfile.card, choices: { season: false, red_flag: true },
      season: { id: "world_diver", name: "The World-Diver", home: false, since },
    };
    await renderView({ profile: { ...fullProfile, card, seasons: [{ id: "a" }, { id: "b" }] } });
    expect(screen.queryByText(/your season turned/i)).toBeNull();
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
    // The shorthand card sits in the right-hand rail with its description
    // beneath, and the rail follows the whole argument column in document order.
    const rail = document.querySelector(".dna-aside");
    expect(rail).toContainElement(screen.getByTestId("dna-card"));
    expect(rail).toHaveTextContent("You read toward the ache.");
    // eslint-disable-next-line no-bitwise
    const order = headline.compareDocumentPosition(rail);
    expect(order & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows the evolution gap as a text equivalent, not shape/colour alone [F7.3/F7.8]", async () => {
    await renderView({ profile: fullProfile, username: "alice" });
    // Drift moved comfort → shock; stated plainly in words.
    expect(screen.getByText(/enduringly, you read toward comfort\. lately, shock/i)).toBeInTheDocument();
    // then / now columns, each captioned with what the weighting actually means.
    expect(screen.getByText("then")).toBeInTheDocument();
    expect(screen.getByText("now")).toBeInTheDocument();
    expect(screen.getByText(/across everything you've logged/i)).toBeInTheDocument();
    expect(screen.getByText(/weighted toward what you've read lately/i)).toBeInTheDocument();
  });

  it("no longer renders a 'NOT YET' list — that moved to the Register fold below [F7.4]", async () => {
    const { container } = await renderView({ profile: fullProfile, username: "alice" });
    // The locked list used to live here; it's now one ledger on the DNA tab,
    // rendered by App outside this component.
    expect(container.querySelector(".dna-locked")).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(/\bnot yet\b/i);
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
    // `nostalgia` appears nowhere in the current vector, but must still be listed.
    expect(names).toContain("nostalgia");

    const blankRow = [...document.querySelectorAll(".dna-portrait-row")].find(
      (r) => r.querySelector(".dna-portrait-name").textContent === "nostalgia"
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
    const shock = [...container.querySelectorAll(".dna-portrait-row")].find(
      (r) => r.querySelector(".dna-portrait-name").textContent === "shock"
    );
    // No counts ledger supplied here, so it falls back to the weighted share.
    expect(shock.querySelector(".dna-portrait-count").textContent).toBe("70");
  });
});

describe("DNAView — the counts ledger and blind spots (mockup pass)", () => {
  // The counts ledger rides the DNA payload itself, NOT the separately-cached
  // /dna/stats call — that one is only fetched when the Patterns section opens,
  // so a reader who stayed on "the read" saw shares under a book-count heading.
  const stats = { avg_intensity: 8.5 };
  const counted = {
    ...fullProfile,
    emotion_counts: { shock: 16, catharsis: 11, dread: 11, comfort: 10, rage: 8 },
  };

  it("prints BOOK COUNTS from the stats ledger, not shares of the weighted vector", async () => {
    const { container } = await renderView({ profile: counted, username: "alice", stats });
    const row = (name) =>
      [...container.querySelectorAll(".dna-portrait-row")].find(
        (r) => r.querySelector(".dna-portrait-name").textContent === name
      );
    expect(row("shock").querySelector(".dna-portrait-count").textContent).toBe("16");
    expect(row("comfort").querySelector(".dna-portrait-count").textContent).toBe("10");
    // `grief` (shown as "heartbreak") is in the weighted vector but absent from the ledger — a real blank.
    expect(row("heartbreak").querySelector(".dna-portrait-count").textContent).toBe("—");
  });

  it("sorts by count, leaving the never-reached at the bottom", async () => {
    const { container } = await renderView({ profile: counted, username: "alice", stats });
    const rows = [...container.querySelectorAll(".dna-portrait-row")];
    const names = rows.map((r) => r.querySelector(".dna-portrait-name").textContent);
    expect(names[0]).toBe("shock");            // 16, the clear leader
    // Ties keep vocabulary order (catharsis is declared before dread, shown as
    // "tension"; both are 11).
    expect(names.slice(1, 3)).toEqual(["catharsis", "tension"]);

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
    const { container } = await renderView({ profile: counted, username: "alice", stats });
    // fullProfile's archetype lists `beauty` as a blind spot; it is untagged.
    const beauty = [...container.querySelectorAll(".dna-portrait-row")].find(
      (r) => r.querySelector(".dna-portrait-name").textContent === "beauty"
    );
    expect(beauty.className).toMatch(/dna-portrait-row--flagged/);
    // A blank that is NOT called out stays unflagged.
    const joy = [...container.querySelectorAll(".dna-portrait-row")].find(
      (r) => r.querySelector(".dna-portrait-name").textContent === "joy"
    );
    expect(joy.className).not.toMatch(/--flagged/);
  });

  it("puts volumes and avg intensity in the running head", async () => {
    await renderView({ profile: counted, username: "alice", stats });
    expect(screen.getByText(/47 volumes · avg intensity 8\.5/)).toBeInTheDocument();
  });

  it("omits intensity from the running head until the ledger loads", async () => {
    await renderView({ profile: fullProfile, username: "alice" });
    expect(screen.getByText("47 volumes")).toBeInTheDocument();
    expect(screen.queryByText(/avg intensity/)).toBeNull();
  });

  it("names what the reader said they read for, beside the headline's basis", async () => {
    await renderView({ profile: counted, username: "alice", stats });
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
      expect(screen.getByText(/enduringly, you read toward comfort\. lately, shock/i)).toBeInTheDocument()
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


describe("DNAView — the aliveness layer [DNA Aliveness spec]", () => {
  const WD = { id: "world_diver", name: "The World-Diver", color: "#3A7A8C", glyph: "✦" };
  const GR = { id: "grief_romantic", name: "The Grief Romantic", color: "#3A5A6B", glyph: "◈" };
  const alive = {
    ...fullProfile,
    archetype: { ...fullProfile.archetype, id: "world_diver", name: "The World-Diver" },
    season: { ...GR, since: "2026-08-04", books: 7, home: false },
    seasons: [
      { ...GR, from: "2026-08-04", to: null, books: 7 },
      { ...WD, from: "2026-05-01", to: "2026-08-04", books: 9 },
    ],
    eras: [
      { ...WD, from: "2026-06-10", to: null, books: 12,
        books_that_moved: [{ entry_id: "b1", title: "The Night Circus" }] },
      { ...GR, from: "2025-03-01", to: "2026-06-10", books: 30 },
    ],
    moments: [{ kind: "first", emotion: "swoon", gap: null, entry_id: "b1", title: "The Night Circus", date: "2026-09-12" }],
    shift_unseen: true,
  };

  beforeEach(() => shiftSeen.mockClear());

  it("lists seasons and eras, dated, instead of then / now", async () => {
    await renderView({ profile: alive, username: "alice" });
    expect(screen.getByText("Your seasons")).toBeInTheDocument();
    expect(screen.getByText("Eras")).toBeInTheDocument();
    expect(screen.getByText("since Aug 2026")).toBeInTheDocument();
    expect(screen.getByText("Mar 2025–Jun 2026")).toBeInTheDocument();
    expect(screen.queryByText("then")).not.toBeInTheDocument();
  });

  it("opens with the shift card once, and tells the server it was seen", async () => {
    await renderView({ profile: alive, username: "alice" });
    expect(screen.getByRole("heading", { name: "You've become a World-Diver." })).toBeInTheDocument();
    expect(screen.getAllByText("The Night Circus").length).toBeGreaterThan(0);
    await act(async () => { screen.getByRole("button", { name: "Got it" }).click(); });
    expect(shiftSeen).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("heading", { name: "You've become a World-Diver." })).not.toBeInTheDocument();
    await renderView({ profile: { ...alive, shift_unseen: false }, username: "bob" });
    expect(screen.queryByText(/You've become/)).not.toBeInTheDocument();
  });

  it("shows dated moments", async () => {
    await renderView({ profile: alive, username: "alice" });
    expect(screen.getByText("Moments")).toBeInTheDocument();
    expect(screen.getByText("A first: “it gave me butterflies”")).toBeInTheDocument();
    expect(screen.getByText("12 Sep 2026")).toBeInTheDocument();
  });

  it("keeps every new line clear of banned framing", async () => {
    const { container } = await renderView({ profile: alive, username: "alice" });
    const text = container.textContent;
    expect(text).not.toMatch(/\breveal\b/i);
    expect(text).not.toMatch(/streak/i);
    expect(text).not.toMatch(/than \d+%|% of readers|more \w+ than/i);
  });
});
