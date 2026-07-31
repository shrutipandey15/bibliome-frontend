import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../../services/api", () => ({ postEcho: vi.fn() }));

import EchoComposer from "./EchoComposer";
import { postEcho } from "../../services/api";
import { EMO_LIST } from "../../services/emotions";

describe("EchoComposer [F3.2 / B3.2]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("posts an echo and closes on success", async () => {
    postEcho.mockResolvedValue({ echo: { id: "e1", body: "wrecked me" }, held_for_review: false });
    const onPosted = vi.fn(), onClose = vi.fn();
    render(<EchoComposer onPosted={onPosted} onClose={onClose} />);

    expect(screen.getByRole("button", { name: /post echo/i })).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/your reflection/i), "wrecked me");
    await userEvent.click(screen.getByRole("button", { name: /post echo/i }));

    await waitFor(() => expect(postEcho).toHaveBeenCalledTimes(1));
    expect(onPosted).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("shows the whole vocabulary, grouped, with nothing behind a reveal", async () => {
    render(<EchoComposer onPosted={vi.fn()} onClose={vi.fn()} />);
    const group = screen.getByRole("group", { name: /anchor emotions/i });
    // Every emotion is one click away. The old "+14 more…" collapse existed
    // because a flat wall of eighteen chips is unreadable; grouping them by
    // family fixes that without hiding two thirds of the vocabulary.
    expect(group.querySelectorAll(".ec-emo-chip").length).toBe(EMO_LIST.length);
    expect(screen.queryByRole("button", { name: /more…/i })).toBeNull();
    // The families themselves are labelled, not just implied by order.
    for (const family of new Set(EMO_LIST.map(([, e]) => e.family))) {
      expect(within(group).getByText(family)).toBeInTheDocument();
    }
  });

  it("marks a chosen emotion pressed wherever it sits in the list", async () => {
    render(<EchoComposer onPosted={vi.fn()} onClose={vi.fn()} />);
    // Something at the very end of the vocabulary, which the old collapse would
    // have hidden.
    const late = EMO_LIST[EMO_LIST.length - 1];
    const name = (late[1].name || late[0]).toLowerCase();
    await userEvent.click(screen.getByRole("button", { name }));
    expect(screen.getByRole("button", { name })).toHaveAttribute("aria-pressed", "true");
  });

  it("shows the supportive crisis path instead of closing when the classifier fires [F3.6]", async () => {
    postEcho.mockResolvedValue({
      echo: { id: "e2", body: "..." },
      crisis: { message: "You're not alone.", resources: [{ name: "988 Lifeline", phone: "988" }] },
    });
    const onClose = vi.fn();
    render(<EchoComposer onPosted={vi.fn()} onClose={onClose} />);
    await userEvent.type(screen.getByLabelText(/your reflection/i), "something heavy");
    await userEvent.click(screen.getByRole("button", { name: /post echo/i }));

    await waitFor(() => expect(screen.getByText(/You're not alone/)).toBeInTheDocument());
    expect(screen.getByText(/988 Lifeline/)).toBeInTheDocument();
    // It does NOT auto-close — the author stays on the supportive screen.
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows a held-for-review state, not a rejection", async () => {
    postEcho.mockResolvedValue({ echo: { id: "e3", body: "x" }, held_for_review: true });
    render(<EchoComposer onPosted={vi.fn()} onClose={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/your reflection/i), "x");
    await userEvent.click(screen.getByRole("button", { name: /post echo/i }));
    await waitFor(() => expect(screen.getByText(/held for review/i)).toBeInTheDocument());
    // Held, not refused: it still tells you the echo is coming back.
    expect(screen.getByText(/lands in your feed once it clears/i)).toBeInTheDocument();
  });
});
