import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../../services/api", () => ({
  getCollectionConversations: vi.fn(),
  getCollectionMessages: vi.fn(),
  sendCollectionMessage: vi.fn(),
  deleteCollectionMessage: vi.fn(),
  reportCollectionConversation: vi.fn(),
  getCollectionSparks: vi.fn(),
}));

import CollectionChat from "./CollectionChat";
import {
  getCollectionConversations, getCollectionMessages, sendCollectionMessage,
  deleteCollectionMessage, reportCollectionConversation, getCollectionSparks,
} from "../../services/api";

const BOOKS = [
  { book_id: "b1", title: "Beach Read", author: "Emily Henry" },
  { book_id: "b2", title: "Iron Flame", author: "Rebecca Yarros" },
];

const msg = (o = {}) => ({
  id: "m1", book_id: null, book_title: null, handle: "mara", is_mine: false,
  body: "the statues", created_at: new Date().toISOString(), crisis: null, ...o,
});

const page = (messages = [], over = {}) =>
  ({ messages, next_before: null, next_before_id: null, ...over });

async function mount() {
  render(<CollectionChat collectionId="c1" />);
  return screen.findByLabelText(/your message/i);
}

describe("CollectionChat — one room per collection [#6]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCollectionConversations.mockResolvedValue(BOOKS);
    getCollectionSparks.mockResolvedValue({ sparks: [] });
    getCollectionMessages.mockResolvedValue(page([msg()]));
  });
  afterEach(() => vi.useRealTimers());

  it("opens straight into the conversation — no book-list step", async () => {
    // The old shape made you pick a book first, past a wall of "start it" rows.
    await mount();
    expect(screen.getByText("the statues")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /start it/i })).not.toBeInTheDocument();
  });

  it("sends with Enter and keeps Shift+Enter for a newline", async () => {
    sendCollectionMessage.mockResolvedValue(msg({ id: "m2", is_mine: true, body: "hi" }));
    const input = await mount();

    await userEvent.type(input, "line one{Shift>}{Enter}{/Shift}");
    expect(sendCollectionMessage).not.toHaveBeenCalled();   // newline, not a send

    await userEvent.type(input, "hi{Enter}");
    await waitFor(() => expect(sendCollectionMessage).toHaveBeenCalledTimes(1));
  });

  it("posts without a book — a general remark needs no anchor", async () => {
    sendCollectionMessage.mockResolvedValue(msg({ id: "m2", is_mine: true, body: "hello" }));
    const input = await mount();

    await userEvent.type(input, "hello{Enter}");
    await waitFor(() => expect(sendCollectionMessage).toHaveBeenCalledWith("c1", "hello", null));
  });

  it("can attach a book to a message", async () => {
    sendCollectionMessage.mockResolvedValue(msg({ id: "m2", is_mine: true }));
    const input = await mount();

    await userEvent.selectOptions(screen.getByLabelText(/attach a book/i), "b1");
    await userEvent.type(input, "about this one{Enter}");

    await waitFor(() => expect(sendCollectionMessage)
      .toHaveBeenCalledWith("c1", "about this one", "b1"));
  });

  it("polls for other people's messages while visible", async () => {
    // "Smooth" means you don't reload to see a reply.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await mount();

    getCollectionMessages.mockResolvedValue(page([msg({ id: "m9", body: "arrived later" })]));
    await act(async () => { vi.advanceTimersByTime(6000); });

    expect(await screen.findByText("arrived later")).toBeInTheDocument();
  });

  it("does not duplicate a message it already holds", async () => {
    // Our own send appends locally and the poll sees it again.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await mount();

    getCollectionMessages.mockResolvedValue(page([msg()]));   // same id as on screen
    await act(async () => { vi.advanceTimersByTime(6000); });

    expect(screen.getAllByText("the statues")).toHaveLength(1);
  });

  it("groups consecutive messages from one person under a single name", async () => {
    const now = Date.now();
    getCollectionMessages.mockResolvedValue(page([
      msg({ id: "a", body: "one", created_at: new Date(now - 2000).toISOString() }),
      msg({ id: "b", body: "two", created_at: new Date(now - 1000).toISOString() }),
    ]));
    await mount();

    // Two messages, one attribution.
    expect(screen.getAllByText("@mara")).toHaveLength(1);
    expect(screen.getByText("one")).toBeInTheDocument();
    expect(screen.getByText("two")).toBeInTheDocument();
  });

  it("offers sparks when the room is empty, and they fill the box rather than posting", async () => {
    // A silent room is the hardest moment in a group chat — but the words stay
    // yours, so tapping one drafts it instead of sending it.
    getCollectionMessages.mockResolvedValue(page([]));
    getCollectionSparks.mockResolvedValue({
      sparks: [{ kind: "question", text: "Which one has the best first line?" }],
    });
    const input = await mount();

    await userEvent.click(await screen.findByRole("button", { name: /best first line/i }));
    expect(input).toHaveValue("Which one has the best first line?");
    expect(sendCollectionMessage).not.toHaveBeenCalled();
  });

  it("narrows the same room by book rather than opening another", async () => {
    await mount();
    await userEvent.selectOptions(screen.getByLabelText(/which books to show|showing/i), "b1");

    await waitFor(() => expect(getCollectionMessages)
      .toHaveBeenCalledWith("c1", expect.objectContaining({ bookId: "b1" })));
  });

  it("tells the sender plainly when a message was refused, and keeps the draft", async () => {
    sendCollectionMessage.mockRejectedValue(new Error("That message can't be sent here."));
    const input = await mount();

    await userEvent.type(input, "refused thing{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent(/can't be sent/i);
    expect(input).toHaveValue("refused thing");
  });

  it("surfaces a refused delete rather than dropping the row locally", async () => {
    deleteCollectionMessage.mockRejectedValue(new Error("You can only delete your own messages"));
    await mount();

    await userEvent.click(screen.getByRole("button", { name: /delete message/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/only delete your own/i);
    expect(screen.getByText("the statues")).toBeInTheDocument();
  });

  it("says reporting changes nothing for anyone else", async () => {
    reportCollectionConversation.mockResolvedValue({ status: "received" });
    await mount();

    await userEvent.click(screen.getByRole("button", { name: /report this conversation/i }));
    expect(await screen.findByText(/nothing here changes for anyone else/i)).toBeInTheDocument();
  });
});
