import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../../services/api", () => ({
  reactToEcho: vi.fn(),
  postReply: vi.fn(),
}));

import EchoCard from "./EchoCard";
import { reactToEcho, postReply } from "../../services/api";

const baseEcho = {
  id: "e1",
  handle: "quiet_reader",
  book_title: "Piranesi",
  book_author: "Susanna Clarke",
  primary_emotion: "awe",
  body: "I read this on a train and missed my stop.",
  created_at: "2026-07-01T10:00:00Z",
  my_reactions: {},
  replies_preview: [
    { id: "r1", handle: "other_one", body: "me too, exactly this" },
  ],
  has_more_replies: true,
};

beforeEach(() => vi.clearAllMocks());

describe("EchoCard — action row & safety menu [F6.1]", () => {
  it("keeps reply OUT of the ⋯ menu; menu holds only mute/block/report", async () => {
    const onReport = vi.fn();
    render(<EchoCard echo={baseEcho} onReport={onReport} onMute={vi.fn()} onBlock={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /safety actions/i }));

    const menu = screen.getByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: /mute @quiet_reader/i })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: /block @quiet_reader/i })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: /report/i })).toBeInTheDocument();
    // Reply is NOT a menu item.
    expect(within(menu).queryByRole("menuitem", { name: /reply/i })).toBeNull();
  });

  it("reply is a primary, always-visible action (not behind the menu)", () => {
    render(<EchoCard echo={baseEcho} />);
    const group = screen.getByRole("group", { name: /echo actions/i });
    expect(within(group).getByRole("button", { name: /reply/i })).toBeInTheDocument();
  });

  it("renders reaction pressed state from my_reactions with aria-pressed", () => {
    render(<EchoCard echo={{ ...baseEcho, my_reactions: { felt_this: true } }} />);
    expect(screen.getByRole("button", { name: /underlined/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /made me reconsider/i })).toHaveAttribute("aria-pressed", "false");
  });

  it("optimistically toggles a reaction and rolls back on failure", async () => {
    reactToEcho.mockRejectedValueOnce(new Error("nope"));
    render(<EchoCard echo={baseEcho} onToast={vi.fn()} />);
    const btn = screen.getByRole("button", { name: /underlined/i });
    await userEvent.click(btn);
    // rolled back to not-pressed after the rejected call
    expect(await screen.findByRole("button", { name: /underlined/i })).toHaveAttribute("aria-pressed", "false");
  });
});

describe("EchoCard — private tally, never a public count [F6.1 / F6.5]", () => {
  it("renders NO public count anywhere on a non-author's card", () => {
    const { container } = render(<EchoCard echo={baseEcho} />);
    // No reaction_counts present → no tally line, and no count-like string.
    expect(container.textContent).not.toMatch(/\d+\s*(likes?|replies|reactions?|underlined|added|reconsidered|echoes)/i);
    expect(container.querySelector(".eco-tally")).toBeNull();
  });

  it("shows the author-only private tally when reaction_counts is present", () => {
    render(<EchoCard echo={{ ...baseEcho, reaction_counts: { felt_this: 4, adding_to_list: 1, changed_my_mind: 0 } }} />);
    expect(screen.getByText(/4 underlined/i)).toBeInTheDocument();
    expect(screen.getByText(/1 added it/i)).toBeInTheDocument();
    // A zero count is omitted, never shown as "0 reconsidered".
    expect(screen.queryByText(/reconsidered/i)).toBeNull();
  });

  it("a non-author (no reaction_counts) sees no tally", () => {
    render(<EchoCard echo={baseEcho} />);
    expect(screen.queryByText(/underlined this/i)).toBeNull();
    expect(document.querySelector(".eco-tally")).toBeNull();
  });
});

describe("EchoCard — your own echo (mockup pass)", () => {
  // There is no `is_mine` field on EchoResponse; the backend populates
  // reaction_counts for the author ONLY, so its presence is the ownership signal.
  const mine = { ...baseEcho, reaction_counts: { felt_this: 4, adding_to_list: 1 } };

  it("marks your own echo as yours", () => {
    render(<EchoCard echo={mine} />);
    expect(screen.getByText("yours")).toBeInTheDocument();
  });

  it("does not mark someone else's echo", () => {
    render(<EchoCard echo={baseEcho} />);
    expect(screen.queryByText("yours")).toBeNull();
  });

  it("drops self-reactions on your own echo but KEEPS reply", () => {
    render(<EchoCard echo={mine} />);
    // You cannot underline or shelve yourself…
    expect(screen.queryByRole("button", { name: /underlined/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /to my shelf/i })).toBeNull();
    // …but answering your own thread is the point of having one.
    expect(screen.getByRole("button", { name: /reply/i })).toBeInTheDocument();
    // The tally is what your own card says instead of reaction buttons.
    expect(screen.getByText(/4 underlined/i)).toBeInTheDocument();
  });

  it("shows replies on your own echo", async () => {
    render(<EchoCard echo={{
      ...mine,
      replies_preview: [{ id: "r1", handle: "marginalia", body: "this got me" }],
      has_more_replies: true,
    }} />);
    expect(screen.getByText("this got me")).toBeInTheDocument();
    expect(screen.getByText("@marginalia")).toBeInTheDocument();
    // "read the rest" carries no number, on your own echo as on anyone's.
    const rest = screen.getByRole("button", { name: /read the rest/i });
    expect(rest.textContent).not.toMatch(/\d/);
  });

  it("counts replies in the private tally when the backend sends reply_count", () => {
    render(<EchoCard echo={{ ...mine, reply_count: 2 }} />);
    expect(screen.getByText(/2 replies/i)).toBeInTheDocument();
    render(<EchoCard echo={{ ...mine, reply_count: 1 }} />);
    expect(screen.getByText(/1 reply\b/i)).toBeInTheDocument();
  });

  it("says something, not a zero, when no one has responded", () => {
    // The backend sends an explicit 0 rather than omitting the key. Silence gets
    // a line of its own so it reads as a state rather than as a failed metric.
    render(<EchoCard echo={{ ...baseEcho, is_mine: true, reaction_counts: {}, reply_count: 0 }} />);
    expect(screen.getByText(/no replies/i)).toBeInTheDocument();
    expect(document.querySelector(".eco-tally").textContent).not.toMatch(/\b0\b/);
  });

  it("takes ownership from is_mine, not from the shape of reaction_counts", () => {
    // Author with no reactions yet: counts are empty but the echo is still theirs.
    render(<EchoCard echo={{ ...baseEcho, is_mine: true, reaction_counts: {}, reply_count: 0 }} />);
    expect(screen.getByText("yours")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /underlined/i })).toBeNull();
  });

  it("never treats a peer's card as yours", () => {
    render(<EchoCard echo={{ ...baseEcho, is_mine: false, reaction_counts: null, reply_count: null }} />);
    expect(screen.queryByText("yours")).toBeNull();
    expect(document.querySelector(".eco-tally")).toBeNull();
    expect(screen.getByRole("button", { name: /underlined/i })).toBeInTheDocument();
  });

  it("keeps the action row on everyone else's echo", () => {
    render(<EchoCard echo={baseEcho} />);
    expect(document.querySelector(".eco-actions")).not.toBeNull();
    expect(screen.getByRole("button", { name: /reply/i })).toBeInTheDocument();
  });

  it("still offers safety actions on your own echo", () => {
    render(<EchoCard echo={mine} />);
    expect(screen.getByRole("button", { name: /safety actions/i })).toBeInTheDocument();
  });
});

describe("EchoCard — to my shelf [F6.1]", () => {
  it("shows a confirmation toast when shelving a book", async () => {
    reactToEcho.mockResolvedValue();
    const onToast = vi.fn();
    render(<EchoCard echo={baseEcho} onToast={onToast} />);
    await userEvent.click(screen.getByRole("button", { name: /to my shelf/i }));
    expect(reactToEcho).toHaveBeenCalledWith("e1", "adding_to_list", true);
    expect(onToast).toHaveBeenCalledWith("Added to your shelf");
  });

  it("hides 'to my shelf' when the echo has no book anchor", () => {
    render(<EchoCard echo={{ ...baseEcho, book_title: null, book_author: null }} />);
    expect(screen.queryByRole("button", { name: /to my shelf/i })).toBeNull();
    // underlined + reply are still present
    expect(screen.getByRole("button", { name: /underlined/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reply/i })).toBeInTheDocument();
  });
});

describe("EchoCard — inline replies [F6.2]", () => {
  it("renders the reply preview inline (no count, no 'read more' number)", () => {
    render(<EchoCard echo={baseEcho} onReadMore={vi.fn()} />);
    expect(screen.getByText(/me too, exactly this/)).toBeInTheDocument();
    const readRest = screen.getByRole("button", { name: /read the rest/i });
    expect(readRest.textContent).not.toMatch(/\d/); // NO number
  });

  it("posts a reply and shows it inline immediately (optimistic)", async () => {
    let resolve;
    postReply.mockReturnValue(new Promise((r) => { resolve = r; }));
    render(<EchoCard echo={baseEcho} />);
    await userEvent.click(screen.getByRole("button", { name: /reply/i }));
    await userEvent.type(screen.getByLabelText(/your reply/i), "this wrecked me");
    // one reply button in the composer footer + the action-row toggle; click the footer submit
    await userEvent.click(screen.getAllByRole("button", { name: /^reply$/i }).at(-1));

    // Appears inline before the server confirms.
    expect(await screen.findByText("this wrecked me")).toBeInTheDocument();
    expect(postReply).toHaveBeenCalledWith("e1", "this wrecked me");
    resolve({ id: "r2", handle: "you", body: "this wrecked me" });
  });

  it("rolls the reply back and surfaces an error on failure", async () => {
    postReply.mockRejectedValueOnce(new Error("network down"));
    render(<EchoCard echo={baseEcho} />);
    await userEvent.click(screen.getByRole("button", { name: /reply/i }));
    await userEvent.type(screen.getByLabelText(/your reply/i), "gone soon");
    await userEvent.click(screen.getAllByRole("button", { name: /^reply$/i }).at(-1));

    expect(await screen.findByRole("alert")).toHaveTextContent(/network down/i);
    // Rolled back out of the inline reply LIST (the draft is preserved in the textarea).
    expect(document.querySelector(".eco-replies")?.textContent || "").not.toMatch(/gone soon/);
  });

  it("does not render a blocked user's replies in the preview [F6.5]", () => {
    const echo = {
      ...baseEcho,
      replies_preview: [
        { id: "r1", handle: "blocked_troll", body: "nasty thing" },
        { id: "r2", handle: "kind_reader", body: "a gentle thing" },
      ],
    };
    render(<EchoCard echo={echo} hiddenHandles={new Set(["blocked_troll"])} />);
    expect(screen.queryByText("nasty thing")).toBeNull();
    expect(screen.getByText("a gentle thing")).toBeInTheDocument();
  });
});

describe("EchoCard — accessibility [F6.4]", () => {
  it("Esc closes the composer and returns focus to the reply button", async () => {
    render(<EchoCard echo={baseEcho} />);
    const replyBtn = screen.getByRole("button", { name: /reply/i });
    await userEvent.click(replyBtn);
    const input = screen.getByLabelText(/your reply/i);
    input.focus();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByLabelText(/your reply/i)).toBeNull();
    expect(replyBtn).toHaveFocus();
  });

  it("keeps the handle as plain text, not a link [F3.7]", () => {
    render(<EchoCard echo={baseEcho} />);
    const handle = screen.getByText("@quiet_reader");
    expect(handle.closest("a")).toBeNull();
  });
});
