import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../../services/api", () => ({
  getThreadMessages: vi.fn(),
  sendThreadMessage: vi.fn(),
  sendThreadImageMessage: vi.fn(),
  reactToThreadMessage: vi.fn(),
  blockThread: vi.fn(),
  reportThread: vi.fn(),
  getChatAttachment: vi.fn(),
}));

import ResonanceThread from "./ResonanceThread";
import {
  getThreadMessages, sendThreadMessage, sendThreadImageMessage, reactToThreadMessage,
  getChatAttachment,
} from "../../services/api";

const msg = (o = {}) => ({
  id: "m1", thread_id: "t1", handle: "abc", is_mine: false,
  body: "the ending wrecked me", created_at: new Date().toISOString(), crisis: null,
  reply_to: null, reaction_counts: {}, my_reactions: [], ...o,
});

const page = (messages = []) => ({ messages, next_before: null });

async function mount(props = {}) {
  render(
    <ResonanceThread threadId="t1" bookTitle="A Little Life" handle="abc" onClose={() => {}} {...props} />,
  );
  return screen.findByLabelText(/your message/i);
}

describe("ResonanceThread — reply and reactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getThreadMessages.mockResolvedValue(page([msg()]));
  });

  it("reacts optimistically and reconciles with the server's counts", async () => {
    reactToThreadMessage.mockResolvedValue({
      my_reactions: ["noted"], reaction_counts: { noted: 2 },
    });
    await mount();
    await screen.findByText("the ending wrecked me");

    await userEvent.click(screen.getByRole("button", { name: /^noted/i }));
    expect(reactToThreadMessage).toHaveBeenCalledWith("t1", "m1", "noted", true);
    expect(await screen.findByText("2")).toBeInTheDocument();
  });

  it("switching to a different reaction unsets the old one first", async () => {
    getThreadMessages.mockResolvedValue(page([
      msg({ id: "m1", reaction_counts: { resonated: 1 }, my_reactions: ["resonated"] }),
    ]));
    reactToThreadMessage.mockResolvedValue({
      my_reactions: ["underlined"], reaction_counts: { underlined: 1 },
    });
    await mount();
    await screen.findByText("the ending wrecked me");

    await userEvent.click(screen.getByRole("button", { name: /underlined this/i }));
    expect(reactToThreadMessage).toHaveBeenNthCalledWith(1, "t1", "m1", "resonated", false);
    expect(reactToThreadMessage).toHaveBeenNthCalledWith(2, "t1", "m1", "underlined", true);
    expect(screen.getByText("the ending wrecked me")).toHaveClass("rt-msg-body--underlined");
    expect(screen.getByText("the ending wrecked me")).not.toHaveClass("rt-msg-body--resonated");
  });

  it("rolls back a reaction if the server refuses it", async () => {
    reactToThreadMessage.mockRejectedValue(new Error("nope"));
    await mount();
    await screen.findByText("the ending wrecked me");

    const button = screen.getByRole("button", { name: /^resonated/i });
    await userEvent.click(button);
    await waitFor(() => expect(button).toHaveAttribute("aria-pressed", "false"));
  });

  it("lets you reply, shows the quote strip, and clears it on send", async () => {
    sendThreadMessage.mockResolvedValue(msg({
      id: "m2", is_mine: true, body: "same, honestly",
      reply_to: { id: "m1", handle: "abc", body: "the ending wrecked me" },
    }));
    const input = await mount();
    await screen.findByText("the ending wrecked me");

    await userEvent.click(screen.getByRole("button", { name: /^reply$/i }));
    expect(screen.getByText(/replying to @abc/i)).toBeInTheDocument();

    await userEvent.type(input, "same, honestly");
    await userEvent.click(screen.getByRole("button", { name: /send the letter/i }));

    await waitFor(() => expect(sendThreadMessage).toHaveBeenCalledWith("t1", "same, honestly", "m1"));
    expect(screen.queryByText(/replying to @abc/i)).not.toBeInTheDocument();
    expect(await screen.findByText("the ending wrecked me", { selector: ".rt-quote-body" })).toBeInTheDocument();
  });

  it("filters the visible letters by a search query", async () => {
    getThreadMessages.mockResolvedValue(page([
      msg({ id: "m1", body: "the ending wrecked me" }),
      msg({ id: "m2", body: "totally unrelated aside" }),
    ]));
    await mount();
    await screen.findByText("the ending wrecked me");

    await userEvent.type(screen.getByLabelText(/search letters/i), "ending");
    expect(screen.getByText("the ending wrecked me")).toBeInTheDocument();
    expect(screen.queryByText("totally unrelated aside")).not.toBeInTheDocument();
  });

  it("attaches a photo and sends it through the image endpoint", async () => {
    sendThreadImageMessage.mockResolvedValue(msg({
      id: "m2", is_mine: true, body: "look", attachment_url: "/threads/t1/messages/m2/attachment",
    }));
    getChatAttachment.mockResolvedValue({ url: "blob:fake", type: "image/png" });
    const input = await mount();
    await screen.findByText("the ending wrecked me");

    const file = new File(["fake"], "page.png", { type: "image/png" });
    const fileInput = document.querySelector('input[type="file"]');
    await userEvent.upload(fileInput, file);
    expect(await screen.findByText(/page\.png/)).toBeInTheDocument();

    await userEvent.type(input, "look");
    await userEvent.click(screen.getByRole("button", { name: /send the letter/i }));

    await waitFor(() => expect(sendThreadImageMessage).toHaveBeenCalledWith("t1", "look", file, null));
    expect(sendThreadMessage).not.toHaveBeenCalled();
    expect(await screen.findByAltText("Attached photo")).toBeInTheDocument();
  });
});
