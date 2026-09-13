import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../../services/api", () => ({
  getCollectionConversations: vi.fn(),
  getCollectionMessages: vi.fn(),
  sendCollectionMessage: vi.fn(),
  deleteCollectionMessage: vi.fn(),
  reactToCollectionMessage: vi.fn(),
  reportCollectionConversation: vi.fn(),
  getCollectionSparks: vi.fn(),
}));

let rtHandlers = [];
vi.mock("../../hooks/useRealtimeEvent", () => ({
  default: (_filter, handler) => { rtHandlers.push(handler); },
}));

import CollectionChat from "./CollectionChat";
import {
  getCollectionConversations, getCollectionMessages, sendCollectionMessage,
  deleteCollectionMessage, reactToCollectionMessage, reportCollectionConversation, getCollectionSparks,
} from "../../services/api";

const BOOKS = [
  { book_id: "b1", title: "Beach Read", author: "Emily Henry" },
  { book_id: "b2", title: "Iron Flame", author: "Rebecca Yarros" },
];

const msg = (o = {}) => ({
  id: "m1", book_id: null, book_title: null, handle: "mara", is_mine: false,
  body: "the statues", created_at: new Date().toISOString(), crisis: null,
  reply_to: null, reaction_counts: {}, my_reactions: [], ...o,
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
    rtHandlers = [];
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
    await waitFor(() => expect(sendCollectionMessage).toHaveBeenCalledWith("c1", "hello", null, null));
  });

  it("can attach a book to a message", async () => {
    sendCollectionMessage.mockResolvedValue(msg({ id: "m2", is_mine: true }));
    const input = await mount();

    await userEvent.selectOptions(screen.getByLabelText(/attach a book/i), "b1");
    await userEvent.type(input, "about this one{Enter}");

    await waitFor(() => expect(sendCollectionMessage)
      .toHaveBeenCalledWith("c1", "about this one", "b1", null));
  });

  it("catches up immediately on a realtime collection_message event", async () => {
    // The fast path: a message pushes a "notify" event and the room refetches
    // without waiting for the fallback poll.
    await mount();

    getCollectionMessages.mockResolvedValue(page([msg({ id: "rt1", body: "pushed in" })]));

    await act(async () => {
      await Promise.all(rtHandlers.map((h) => h({ type: "notify", kind: "collection_message" })));
    });

    expect(await screen.findByText("pushed in")).toBeInTheDocument();
  });

  it("shows a jump-to-latest pill for a message that arrives while scrolled up in history", async () => {
    await mount();
    const scroller = document.querySelector(".cc-messages");
    Object.defineProperty(scroller, "scrollHeight", { value: 1000, configurable: true });
    Object.defineProperty(scroller, "clientHeight", { value: 300, configurable: true });
    Object.defineProperty(scroller, "scrollTop", { value: 0, configurable: true, writable: true });
    fireEvent.scroll(scroller); // now reading history, not pinned to the bottom

    getCollectionMessages.mockResolvedValue(page([msg({ id: "rt2", body: "while you were reading" })]));
    await act(async () => {
      await Promise.all(rtHandlers.map((h) => h({ type: "notify", kind: "collection_message" })));
    });

    await screen.findByRole("button", { name: /new messages/i });

    // Scrolling back to the bottom yourself clears it just as tapping it would.
    scroller.scrollTop = 700; // scrollHeight - clientHeight: fully caught up
    fireEvent.scroll(scroller);
    await waitFor(() => expect(screen.queryByRole("button", { name: /new messages/i })).not.toBeInTheDocument());

    // Scroll away again and use the pill itself this time.
    scroller.scrollTop = 0;
    fireEvent.scroll(scroller);
    getCollectionMessages.mockResolvedValue(page([msg({ id: "rt3", body: "one more while away" })]));
    await act(async () => {
      await Promise.all(rtHandlers.map((h) => h({ type: "notify", kind: "collection_message" })));
    });
    await userEvent.click(await screen.findByRole("button", { name: /new messages/i }));
    expect(screen.queryByRole("button", { name: /new messages/i })).not.toBeInTheDocument();
  });

  it("still polls for other people's messages while visible (socket-down fallback)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await mount();

    getCollectionMessages.mockResolvedValue(page([msg({ id: "m9", body: "arrived later" })]));
    await act(async () => { vi.advanceTimersByTime(21000); });

    expect(await screen.findByText("arrived later")).toBeInTheDocument();
  });

  it("does not duplicate a message it already holds", async () => {
    // Our own send appends locally and the poll sees it again.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await mount();

    getCollectionMessages.mockResolvedValue(page([msg()]));   // same id as on screen
    await act(async () => { vi.advanceTimersByTime(21000); });

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

  it("reacts optimistically and reconciles with the server's counts", async () => {
    reactToCollectionMessage.mockResolvedValue({
      my_reactions: ["resonated"], reaction_counts: { resonated: 3 },
    });
    await mount();

    await userEvent.click(screen.getByRole("button", { name: /resonated/i }));
    expect(reactToCollectionMessage).toHaveBeenCalledWith("c1", "m1", "resonated", true);
    // Reconciled count from the server response, not just the optimistic +1.
    expect(await screen.findByText("3")).toBeInTheDocument();
  });

  it("rolls back a reaction if the server refuses it", async () => {
    reactToCollectionMessage.mockRejectedValue(new Error("nope"));
    await mount();

    const button = screen.getByRole("button", { name: /resonated/i });
    await userEvent.click(button);
    await waitFor(() => expect(button).toHaveAttribute("aria-pressed", "false"));
  });

  it("lets you reply to a message, shows the quote strip, and clears it on send", async () => {
    sendCollectionMessage.mockResolvedValue(msg({
      id: "m2", is_mine: true, body: "same here",
      reply_to: { id: "m1", handle: "mara", body: "the statues" },
    }));
    const input = await mount();

    await userEvent.click(screen.getByRole("button", { name: /^reply$/i }));
    expect(screen.getByText(/replying to @mara/i)).toBeInTheDocument();

    await userEvent.type(input, "same here{Enter}");
    await waitFor(() => expect(sendCollectionMessage).toHaveBeenCalledWith("c1", "same here", null, "m1"));
    expect(screen.queryByText(/replying to @mara/i)).not.toBeInTheDocument();

    // The sent reply carries its quote into the transcript.
    expect(await screen.findByText("the statues", { selector: ".cc-quote-body" })).toBeInTheDocument();
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

  it("only offers delete on your own messages", async () => {
    await mount();
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
  });

  it("surfaces a refused delete rather than dropping the row locally", async () => {
    getCollectionMessages.mockResolvedValue(page([msg({ is_mine: true })]));
    deleteCollectionMessage.mockRejectedValue(new Error("Couldn't delete that just now"));
    await mount();

    await userEvent.click(screen.getByRole("button", { name: /delete your message/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't delete/i);
    expect(screen.getByText("the statues")).toBeInTheDocument();
  });

  it("says reporting changes nothing for anyone else", async () => {
    reportCollectionConversation.mockResolvedValue({ status: "received" });
    await mount();

    await userEvent.click(screen.getByRole("button", { name: /report this conversation/i }));
    await userEvent.click(screen.getByRole("button", { name: /report: spam/i }));
    expect(reportCollectionConversation).toHaveBeenCalledWith("c1", "spam");
    expect(await screen.findByText(/nothing here changes for anyone else/i)).toBeInTheDocument();
  });
});
