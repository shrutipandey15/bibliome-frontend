import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../../services/api", () => ({
  getEchoThread: vi.fn(),
  postReply: vi.fn(),
  reactToEcho: vi.fn(),
}));

import EchoThread from "./EchoThread";
import { getEchoThread, postReply } from "../../services/api";

const thread = {
  echo: { id: "e1", handle: "author_one", body: "the echo body", primary_emotion: "grief", created_at: "2026-07-01T10:00:00Z" },
  replies: [
    { id: "r1", handle: "reader_two", body: "me too", created_at: "2026-07-01T11:00:00Z" },
  ],
};

describe("EchoThread [F3.4 / B3.4]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("attaches the reactions to the echo, ABOVE the conversation", async () => {
    getEchoThread.mockResolvedValue(thread);
    render(<EchoThread echoId="e1" />);
    await waitFor(() => expect(screen.getByText("me too")).toBeInTheDocument());

    // Reactions act on the echo, so they sit with it; the replies follow, and the
    // reply box closes the thread. (Previously the reactions were stranded below
    // the reply box, after the conversation they belong to.)
    const reactions = screen.getByRole("group", { name: /private reactions/i });
    const repliesLabel = screen.getByText("Replies");
    const replyBox = screen.getByLabelText(/your reply/i);
    // eslint-disable-next-line no-bitwise
    const F = Node.DOCUMENT_POSITION_FOLLOWING;
    // eslint-disable-next-line no-bitwise
    expect(reactions.compareDocumentPosition(repliesLabel) & F).toBeTruthy();
    // eslint-disable-next-line no-bitwise
    expect(repliesLabel.compareDocumentPosition(replyBox) & F).toBeTruthy();
  });

  it("seeds the reaction toggles from the viewer's own my_reactions", async () => {
    getEchoThread.mockResolvedValue({
      ...thread,
      echo: { ...thread.echo, my_reactions: ["felt_this"] },
    });
    render(<EchoThread echoId="e1" />);
    await waitFor(() => screen.getByText("me too"));
    // Opening a thread must not present an already-set reaction as unset.
    expect(screen.getByRole("button", { name: /underlined/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /reconsider/i })).toHaveAttribute("aria-pressed", "false");
  });

  it("offers no self-reactions on your own echo, but still lets you reply", async () => {
    getEchoThread.mockResolvedValue({
      ...thread,
      echo: { ...thread.echo, reaction_counts: { felt_this: 2 } },
    });
    render(<EchoThread echoId="e1" />);
    await waitFor(() => screen.getByText("me too"));
    expect(screen.queryByRole("group", { name: /private reactions/i })).toBeNull();
    expect(screen.getByLabelText(/your reply/i)).toBeInTheDocument();
  });

  it("posts a reply and appends it to the thread", async () => {
    getEchoThread.mockResolvedValue(thread);
    postReply.mockResolvedValue({ id: "r2", handle: "me", body: "adding this", created_at: "2026-07-01T12:00:00Z" });
    render(<EchoThread echoId="e1" />);
    await waitFor(() => screen.getByText("me too"));

    await userEvent.type(screen.getByLabelText(/your reply/i), "adding this");
    await userEvent.click(screen.getByRole("button", { name: /^reply$/i }));

    await waitFor(() => expect(postReply).toHaveBeenCalledWith("e1", "adding this"));
    expect(await screen.findByText("adding this")).toBeInTheDocument();
  });

  it("reaction toggles show NO counts to the viewer [B3.5]", async () => {
    getEchoThread.mockResolvedValue(thread);
    render(<EchoThread echoId="e1" />);
    await waitFor(() => screen.getByText("me too"));
    const reactions = screen.getByRole("group", { name: /private reactions/i });
    // Labels only, never a number.
    expect(reactions.textContent).not.toMatch(/\d/);
  });
});
