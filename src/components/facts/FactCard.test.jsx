import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../../services/api", () => ({ getTodayFact: vi.fn() }));

import FactCard from "./FactCard";
import { getTodayFact } from "../../services/api";

const FACT = {
  day: "2026-12-16", kind: "birth", tone: "fun",
  text: "Born on this day in 1775: Jane Austen, English novelist.",
  source: "https://en.wikipedia.org/wiki/Jane_Austen", shelf_note: "They're on your shelf.",
};

describe("FactCard", () => {
  beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });

  it("shows today's fact with its source and the shelf note", async () => {
    getTodayFact.mockResolvedValue(FACT);
    render(<FactCard />);
    expect(await screen.findByText(FACT.text)).toBeInTheDocument();
    expect(screen.getByText("They're on your shelf.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /source/i })).toHaveAttribute("href", FACT.source);
  });

  it("stays put away for the rest of that day", async () => {
    getTodayFact.mockResolvedValue(FACT);
    const { unmount } = render(<FactCard />);
    await userEvent.click(await screen.findByRole("button", { name: /put today's fact away/i }));
    expect(screen.queryByText(FACT.text)).toBeNull();
    unmount();
    render(<FactCard />);
    await waitFor(() => expect(getTodayFact).toHaveBeenCalledTimes(2));
    expect(screen.queryByText(FACT.text)).toBeNull();
    // A new day's fact shows again.
    getTodayFact.mockResolvedValue({ ...FACT, day: "2026-12-17", text: "Tomorrow's fact." });
    render(<FactCard />);
    expect(await screen.findByText("Tomorrow's fact.")).toBeInTheDocument();
  });

  it("renders nothing when no fact arrived today", async () => {
    getTodayFact.mockResolvedValue(null);
    const { container } = render(<FactCard />);
    await waitFor(() => expect(getTodayFact).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
