import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../services/api", () => ({ getPendingAnswers: vi.fn(), reviewAnswer: vi.fn() }));

import AnswerReview from "./AnswerReview";
import { getPendingAnswers, reviewAnswer } from "../services/api";

describe("AnswerReview", () => {
  it("approves a note and takes it off the list", async () => {
    getPendingAnswers.mockResolvedValue([{ id: "a1", period: "2026-40", question: "Q?", note: "lovely", book_title: "Circe" }]);
    reviewAnswer.mockResolvedValue({});
    render(<AnswerReview />);
    await userEvent.click(await screen.findByRole("button", { name: /approve/i }));
    expect(reviewAnswer).toHaveBeenCalledWith("a1", true);
    expect(await screen.findByText(/nothing waiting/i)).toBeInTheDocument();
  });
});
