import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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

  it("starts with a short emotion list and reveals the rest on request", async () => {
    render(<EchoComposer onPosted={vi.fn()} onClose={vi.fn()} />);
    const group = screen.getByRole("group", { name: /anchor emotions/i });
    const chips = () => group.querySelectorAll(".ec-emo-chip:not(.ec-emo-more)");
    expect(chips().length).toBe(4);

    const more = screen.getByRole("button", { name: /\+ 14 more/i });
    await userEvent.click(more);
    expect(chips().length).toBe(EMO_LIST.length);
    expect(screen.queryByRole("button", { name: /more…/i })).toBeNull();
  });

  it("never hides a chosen emotion behind the collapse", async () => {
    render(<EchoComposer onPosted={vi.fn()} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /\+ 14 more/i }));
    // Pick something well past the preview window, then collapse is gone — but the
    // guard matters: a selected chip must render regardless of its index.
    const late = EMO_LIST[EMO_LIST.length - 1];
    await userEvent.click(screen.getByRole("button", { name: late[1].label.toLowerCase() }));
    expect(screen.getByRole("button", { name: late[1].label.toLowerCase() }))
      .toHaveAttribute("aria-pressed", "true");
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

  it("shows a calm held-for-review state (not a rejection)", async () => {
    postEcho.mockResolvedValue({ echo: { id: "e3", body: "x" }, held_for_review: true });
    render(<EchoComposer onPosted={vi.fn()} onClose={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/your reflection/i), "x");
    await userEvent.click(screen.getByRole("button", { name: /post echo/i }));
    await waitFor(() => expect(screen.getByText(/Held for a quick look/i)).toBeInTheDocument());
  });
});
