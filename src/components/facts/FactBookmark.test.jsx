import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, renderHook } from "@testing-library/react";

vi.mock("../../services/api", () => ({ getTodayFact: vi.fn() }));

import { FactBookmark, FactSlip, lengthClass, useTodayFact } from "./FactBookmark";
import { getTodayFact } from "../../services/api";

const DATED = {
  day: "2026-12-16", kind: "birth", tone: "fun", shelf_note: "They're on your shelf.",
  text: "Born on this day in 1775: Jane Austen, English novelist.", source: "https://en.wikipedia.org/wiki/Jane_Austen",
};
const BANK = { day: "2026-10-11", kind: "bank", tone: "unhinged", text: "Byron kept a bear.", source: "https://x" };

describe("today's fact on the shelf", () => {
  it("a dated fact shows its year big, and the text doesn't say it twice", () => {
    render(<FactBookmark fact={DATED} />);
    expect(screen.getByText("1775")).toBeInTheDocument();
    expect(screen.getByText("born on this day")).toBeInTheDocument();
    expect(screen.getByText("Jane Austen, English novelist.")).toBeInTheDocument();
    expect(screen.getByText("They're on your shelf.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /source/i })).toHaveAttribute("href", DATED.source);
  });

  it("a bank fact shows today's date and its tone", () => {
    render(<FactSlip fact={BANK} />);
    expect(screen.getByText("11 Oct")).toBeInTheDocument();
    expect(screen.getByText("unhinged but true")).toBeInTheDocument();
    expect(screen.getByText("Byron kept a bear.")).toBeInTheDocument();
  });

  it("trims each kind's opening the small line already says", async () => {
    const { parts } = await import("./FactBookmark");
    expect(parts({ ...BANK, kind: "holiday", text: "Today is World Book Day." }).text).toBe("World Book Day.");
    expect(parts({ ...BANK, kind: "event", text: "On this day in 1813: Jane Austen's Pride and Prejudice is first published." }))
      .toMatchObject({ big: "1813", kicker: "on this day", text: "Jane Austen's Pride and Prejudice is first published." });
    expect(parts({ ...BANK, kind: "death", text: "Died on this day in 1616: William Shakespeare, English playwright." }).kicker).toBe("died on this day");
    expect(parts(BANK).text).toBe("Byron kept a bear.");                  // bank facts are left as written
  });

  it("sizes its type to the text, from 'World Book Day' to the whaleship Essex", () => {
    expect(lengthClass("Today is World Book Day.")).toBe("is-short");
    expect(lengthClass("x".repeat(120))).toBe("is-medium");
    expect(lengthClass("x".repeat(266))).toBe("is-long");
    render(<FactBookmark fact={{ ...BANK, text: "x".repeat(266) }} />);
    expect(screen.getByRole("complementary")).toHaveClass("is-long");
    expect(screen.getByRole("complementary")).toHaveAttribute("title", "x".repeat(266));   // full text on hover
  });

  it("nothing at all on a day without a fact", async () => {
    getTodayFact.mockResolvedValue(null);
    const { result } = renderHook(() => useTodayFact());
    await waitFor(() => expect(getTodayFact).toHaveBeenCalled());
    expect(result.current).toBeNull();
    const { container } = render(<><FactBookmark fact={null} /><FactSlip fact={null} /></>);
    expect(container).toBeEmptyDOMElement();
  });
});
