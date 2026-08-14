import { describe, it, expect, beforeEach, vi } from "vitest";
import { render as rtlRender, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "../contexts/ThemeContext";

// Every surface mounts under the app's ThemeProvider (App.jsx wraps the router).
// Rendering a page without it is a test-only condition, so supply it here rather
// than making `useTheme` tolerate being called outside its provider — a toggle
// that silently does nothing is the bug this provider exists to prevent.
const render = (ui, opts) => rtlRender(ui, { wrapper: ThemeProvider, ...opts });

vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));
vi.mock("../services/api", () => ({
  getResonanceMatches: vi.fn(),
  reachOut: vi.fn(),
  respondToMatch: vi.fn(),
  getThreadMessages: vi.fn(),
  sendThreadMessage: vi.fn(),
  blockThread: vi.fn(),
  reportThread: vi.fn(),
}));

import ResonancePage from "./ResonancePage";
import { getResonanceMatches, reachOut, respondToMatch, getThreadMessages } from "../services/api";

const suggested = {
  match_id: "m1",
  book_id: "b1",
  book_title: "The Remains of the Day",
  book_author: "Kazuo Ishiguro",
  cover_url: null,
  shared_emotions: [
    { emotion_id: "grief", label: "it wrecked me", your_strength: 8, their_strength: 9, close: true },
  ],
  strength: "strong",
  status: "suggested",
  direction: "none",
  your_note: null,
  their_note: null,
  thread_id: null,
  handle: null,
  created_at: "2026-07-20T10:00:00Z",
};

const list = (matches, reaches = 5) => ({ matches, reaches_left_today: reaches });

describe("ResonancePage — anonymity", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the book and the shared feeling, and nothing that names a person", async () => {
    getResonanceMatches.mockResolvedValue(list([suggested]));
    const { container } = render(<ResonancePage />);

    // The title appears twice by design: once drawn on the cover plate (which is
    // aria-hidden, so it is one title to a screen reader) and once as the heading.
    await waitFor(() => screen.getAllByText("The Remains of the Day"));
    expect(screen.getByText("it wrecked me")).toBeInTheDocument();

    // No handle, no avatar, no link out to anyone.
    expect(container.textContent).not.toMatch(/@/);
    expect(container.querySelector("img[src]")).toBeNull();
    expect(container.querySelector("a")).toBeNull();
  });

  it("renders no counts of other readers anywhere", async () => {
    getResonanceMatches.mockResolvedValue(list([suggested, { ...suggested, match_id: "m2" }]));
    const { container } = render(<ResonancePage />);
    await waitFor(() => screen.getAllByText("The Remains of the Day"));

    expect(container.textContent).not.toMatch(/\d+\s*(readers?|matches?|people)/i);
  });

  it("reveals the handle only once the match is connected", async () => {
    getResonanceMatches.mockResolvedValue(
      list([{ ...suggested, status: "connected", handle: "quiet_reader", thread_id: "t1" }])
    );
    render(<ResonancePage />);
    // Asserted as the handle itself rather than the old card's "with @handle"
    // phrasing: a connected match is an inbox row now, not a full card, and the
    // invariant being guarded is that the handle appears at all — which the
    // first test in this block pins to NOT happening while merely suggested.
    await waitFor(() => expect(screen.getByText("@quiet_reader")).toBeInTheDocument());
  });
});

describe("ResonancePage — the note", () => {
  beforeEach(() => vi.clearAllMocks());

  it("moves the card to a waiting state after the note is sent", async () => {
    getResonanceMatches.mockResolvedValue(list([suggested]));
    reachOut.mockResolvedValue({ ...suggested, status: "pending", direction: "you_reached" });
    render(<ResonancePage />);

    await userEvent.click(await screen.findByRole("button", { name: /leave a note/i }));
    await userEvent.type(screen.getByLabelText(/your note/i), "I read the last page twice.");
    await userEvent.click(screen.getByRole("button", { name: /leave the note/i }));

    await waitFor(() => expect(screen.getByText(/your note is with them/i)).toBeInTheDocument());
    expect(reachOut).toHaveBeenCalledWith("m1", "I read the last page twice.");
    expect(screen.queryByRole("button", { name: /leave a note/i })).toBeNull();
  });

  it("answering a note someone left accepts the match rather than reaching again", async () => {
    const theirs = { ...suggested, status: "pending", direction: "they_reached" };
    getResonanceMatches.mockResolvedValue(list([theirs]));
    respondToMatch.mockResolvedValue({ ...theirs, status: "connected", handle: "h", thread_id: "t1" });
    render(<ResonancePage />);

    await userEvent.click(await screen.findByRole("button", { name: /write back/i }));
    await userEvent.type(screen.getByLabelText(/your note/i), "me too.");
    await userEvent.click(screen.getByRole("button", { name: /^write back$/i }));

    await waitFor(() => expect(respondToMatch).toHaveBeenCalledWith("m1", true, "me too."));
    expect(reachOut).not.toHaveBeenCalled();
  });
});

describe("ResonancePage — declining is silent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("removes the card without announcing a rejection", async () => {
    getResonanceMatches.mockResolvedValue(list([suggested]));
    respondToMatch.mockResolvedValue({ ...suggested, status: "declined" });
    const { container } = render(<ResonancePage />);

    await userEvent.click(await screen.findByRole("button", { name: /not this one/i }));

    await waitFor(() => expect(screen.queryByText("The Remains of the Day")).toBeNull());
    expect(respondToMatch).toHaveBeenCalledWith("m1", false);
    expect(container.textContent).not.toMatch(/declin|reject|pass(ed)? on|removed/i);
  });
});

describe("ResonancePage — empty state", () => {
  beforeEach(() => vi.clearAllMocks());

  it("is warm about rarity rather than reporting zero results", async () => {
    getResonanceMatches.mockResolvedValue(list([]));
    const { container } = render(<ResonancePage />);

    await waitFor(() => expect(screen.getByText(/rare on purpose/i)).toBeInTheDocument());
    expect(container.textContent).not.toMatch(/no results|not found|0 matches/i);
  });
});

describe("ResonanceThread — calm by omission", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the letters with no read receipts or typing state", async () => {
    getResonanceMatches.mockResolvedValue(
      list([{ ...suggested, status: "connected", handle: "quiet_reader", thread_id: "t1" }])
    );
    getThreadMessages.mockResolvedValue({
      messages: [
        { id: "x1", thread_id: "t1", handle: "quiet_reader", is_mine: false, body: "your note reached me", created_at: "2026-07-21T10:00:00Z" },
      ],
      next_before: null,
    });
    const { container } = render(<ResonancePage />);

    await userEvent.click(await screen.findByRole("button", { name: /open the letters/i }));
    await waitFor(() => expect(screen.getByText("your note reached me")).toBeInTheDocument());

    expect(container.textContent).not.toMatch(/seen|read receipt|typing|online|delivered|last active/i);
  });
});
