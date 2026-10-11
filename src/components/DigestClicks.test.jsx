import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../services/api", () => ({ getDigestClicks: vi.fn() }));
import DigestClicks from "./DigestClicks";
import { getDigestClicks } from "../services/api";

describe("DigestClicks", () => {
  it("shows the open rate and each section's rate with its numbers", async () => {
    getDigestClicks.mockResolvedValue({ weeks: 8, digests: 40, opened: 22, sections: [
      { kind: "weekly_question", shown: 40, clicked: 14, led: 0, led_clicked: 0 },
      { kind: "while_away", shown: 10, clicked: 3, led: 8, led_clicked: 3 },
    ] });
    render(<DigestClicks />);
    expect(await screen.findByText("55%")).toBeInTheDocument();
    expect(screen.getByText("Weekly question")).toBeInTheDocument();
    expect(screen.getByText("14 of 40")).toBeInTheDocument();
    expect(screen.getByText("38%")).toBeInTheDocument();                  // 3 of 8 when it led
    await userEvent.click(screen.getByRole("button", { name: "26 weeks" }));
    expect(getDigestClicks).toHaveBeenLastCalledWith(26);
  });
});
