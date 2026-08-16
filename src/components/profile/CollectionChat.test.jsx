import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../../services/api", () => ({
  getCollectionConversations: vi.fn(),
  getCollectionMessages: vi.fn(),
  sendCollectionMessage: vi.fn(),
  deleteCollectionMessage: vi.fn(),
  reportCollectionConversation: vi.fn(),
}));

import CollectionChat from "./CollectionChat";
import {
  getCollectionConversations,
  getCollectionMessages,
  sendCollectionMessage,
  deleteCollectionMessage,
  reportCollectionConversation,
} from "../../services/api";

const COLLECTION = { id: "c1", title: "Group Read" };

const BOOKS = [
  { book_id: "b1", title: "Piranesi", author: "Susanna Clarke", message_count: 2, last_message_at: "2026-08-01T10:00:00Z" },
  { book_id: "b2", title: "The Employees", author: "Olga Ravn", message_count: 0, last_message_at: null },
];

const msg = (over = {}) => ({
  id: "m1", book_id: "b1", handle: "reader", is_mine: false,
  body: "this wrecked me", created_at: "2026-08-01T10:00:00Z", crisis: null, ...over,
});

async function openRoom() {
  render(<CollectionChat collection={COLLECTION} />);
  await userEvent.click(await screen.findByRole("button", { name: /Piranesi/ }));
  return screen.findByLabelText(/your message/i);
}

describe("CollectionChat [#6]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCollectionConversations.mockResolvedValue(BOOKS);
    getCollectionMessages.mockResolvedValue({ messages: [msg()], next_before: null, next_before_id: null });
  });

  it("lists every book, including ones nobody has spoken about", async () => {
    // The list shows where a conversation COULD start, not only where one has.
    render(<CollectionChat collection={COLLECTION} />);

    expect(await screen.findByText("Piranesi")).toBeInTheDocument();
    expect(screen.getByText("The Employees")).toBeInTheDocument();
    expect(screen.getByText("start it")).toBeInTheDocument();
  });

  it("opens one book's room — there is no general channel", async () => {
    await openRoom();
    expect(getCollectionMessages).toHaveBeenCalledWith("c1", "b1", expect.anything());
    expect(screen.getByText("this wrecked me")).toBeInTheDocument();
    // Only way back is to the book list; no room that isn't a book.
    expect(screen.getByRole("button", { name: /all books/i })).toBeInTheDocument();
  });

  it("tells the sender plainly when a message was REFUSED, and keeps the draft", async () => {
    // A 422 means it did not send. Anything softer implies it landed, and the
    // draft has to survive — it is still unsaid.
    sendCollectionMessage.mockRejectedValue(new Error("That message can't be sent here."));
    const input = await openRoom();

    await userEvent.type(input, "something refused");
    await userEvent.click(screen.getByRole("button", { name: /^send$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/can't be sent/i);
    expect(input).toHaveValue("something refused");
    // Scoped to the transcript: the draft text is legitimately still in the
    // textarea, so a page-wide query would match its own value.
    const bodies = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(bodies.some((t) => t.includes("something refused"))).toBe(false);
  });

  it("shows crisis support to the sender, and still posts the message", async () => {
    // Care, not enforcement — the message sent.
    sendCollectionMessage.mockResolvedValue(msg({
      id: "m2", is_mine: true, body: "a heavy thing",
      crisis: { message: "You're not alone.", resources: [{ name: "988", contact: "Call 988" }] },
    }));
    const input = await openRoom();

    await userEvent.type(input, "a heavy thing");
    await userEvent.click(screen.getByRole("button", { name: /^send$/i }));

    expect(await screen.findByText(/you.re not alone/i)).toBeInTheDocument();
    expect(screen.getByText("a heavy thing")).toBeInTheDocument();  // it posted
  });

  it("pages backward carrying BOTH halves of the cursor", async () => {
    // A timestamp-only cursor would skip or repeat messages sharing an instant.
    getCollectionMessages.mockResolvedValueOnce({
      messages: [msg({ id: "m9", body: "newest" })],
      next_before: "2026-08-01T10:00:00Z",
      next_before_id: "m9",
    });
    await openRoom();

    getCollectionMessages.mockResolvedValueOnce({
      messages: [msg({ id: "m8", body: "older" })],
      next_before: null, next_before_id: null,
    });
    await userEvent.click(screen.getByRole("button", { name: /load earlier/i }));

    await waitFor(() => expect(getCollectionMessages).toHaveBeenLastCalledWith(
      "c1", "b1",
      expect.objectContaining({ before: "2026-08-01T10:00:00Z", beforeId: "m9" }),
    ));
    // Prepended, not appended — the older page belongs before what we had.
    const bodies = screen.getAllByText(/newest|older/).map((n) => n.textContent);
    expect(bodies).toEqual(["older", "newest"]);
  });

  it("surfaces a refused delete rather than dropping the message locally", async () => {
    // A member deleting someone else's message gets 403. Removing it from the
    // list anyway would show a deletion that never happened.
    deleteCollectionMessage.mockRejectedValue(new Error("You can only delete your own messages"));
    await openRoom();

    await userEvent.click(screen.getByRole("button", { name: /delete message/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/only delete your own/i);
    expect(screen.getByText("this wrecked me")).toBeInTheDocument();
  });

  it("says reporting changes nothing for anyone else", async () => {
    // A private group must not be silenceable on one member's say-so, so the
    // copy must not imply the room was hidden.
    reportCollectionConversation.mockResolvedValue({ status: "received" });
    await openRoom();

    await userEvent.click(screen.getByRole("button", { name: /report this conversation/i }));

    expect(await screen.findByText(/nothing here changes for anyone else/i)).toBeInTheDocument();
  });

  it("will not send an empty or whitespace-only message", async () => {
    const input = await openRoom();
    expect(screen.getByRole("button", { name: /^send$/i })).toBeDisabled();

    await userEvent.type(input, "   ");
    expect(screen.getByRole("button", { name: /^send$/i })).toBeDisabled();
    expect(sendCollectionMessage).not.toHaveBeenCalled();
  });
});
