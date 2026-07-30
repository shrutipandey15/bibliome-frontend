import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));
vi.mock("../services/api", () => ({
  getEchoFeed: vi.fn(),
  blockHandle: vi.fn(),
  muteHandle: vi.fn(),
  reportEcho: vi.fn(),
  reportReply: vi.fn(),
}));

import EchoesPage from "./EchoesPage";
import { getEchoFeed, blockHandle } from "../services/api";

const feed = {
  echoes: [
    { id: "e1", handle: "reader_one", body: "first echo", primary_emotion: "grief", created_at: "2026-07-01T10:00:00Z" },
    { id: "e2", handle: "reader_two", body: "second echo", primary_emotion: "awe", created_at: "2026-07-02T10:00:00Z" },
  ],
  next_cursor: null,
  caught_up: true,
};

describe("EchoesPage — your echoes [B: ?mine=true]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requests only your own echoes when the view is switched", async () => {
    getEchoFeed.mockResolvedValue(feed);
    render(<EchoesPage />);
    await waitFor(() => expect(screen.getByText("first echo")).toBeInTheDocument());
    expect(getEchoFeed).toHaveBeenLastCalledWith(expect.objectContaining({ mine: false }));

    await userEvent.click(screen.getByRole("button", { name: /your echoes/i }));
    await waitFor(() =>
      expect(getEchoFeed).toHaveBeenLastCalledWith(expect.objectContaining({ mine: true }))
    );
  });

  it("composes 'yours' WITH a feeling anchor rather than replacing it", async () => {
    getEchoFeed.mockResolvedValue(feed);
    render(<EchoesPage />);
    await waitFor(() => screen.getByText("first echo"));

    await userEvent.click(screen.getByRole("button", { name: /your echoes/i }));
    await userEvent.click(screen.getByRole("button", { name: /^grief$/i }));
    await waitFor(() =>
      expect(getEchoFeed).toHaveBeenLastCalledWith(
        expect.objectContaining({ mine: true, emotion: "grief" })
      )
    );
  });

  it("does not tell the author to 'be the first' among their own echoes", async () => {
    getEchoFeed.mockResolvedValue({ echoes: [], next_cursor: null, caught_up: true });
    render(<EchoesPage />);
    await waitFor(() => expect(screen.getByText(/no echoes yet/i)).toBeInTheDocument());
    expect(screen.getByText(/be the first/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /your echoes/i }));
    await waitFor(() =>
      expect(screen.getByText(/you haven't written an echo yet/i)).toBeInTheDocument()
    );
    expect(screen.queryByText(/be the first/i)).toBeNull();
  });

  it("states the privacy promise where the private counts appear", async () => {
    getEchoFeed.mockResolvedValue(feed);
    render(<EchoesPage />);
    await waitFor(() => screen.getByText("first echo"));
    expect(screen.queryByText(/these counts are yours alone/i)).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: /your echoes/i }));
    expect(await screen.findByText(/these counts are yours alone/i)).toBeInTheDocument();
  });
});

describe("EchoesPage feed [F3.3]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders a chronological feed that ENDS with an explicit 'caught up'", async () => {
    getEchoFeed.mockResolvedValue(feed);
    render(<EchoesPage />);
    await waitFor(() => expect(screen.getByText("first echo")).toBeInTheDocument());
    expect(screen.getByText(/you're caught up/i)).toBeInTheDocument();
    // Terminus, not infinite scroll: no "load older" button when caught up.
    expect(screen.queryByRole("button", { name: /load older/i })).toBeNull();
  });

  it("blocking a handle removes their echoes from the feed", async () => {
    getEchoFeed.mockResolvedValue(feed);
    blockHandle.mockResolvedValue(undefined);
    render(<EchoesPage />);
    await waitFor(() => expect(screen.getByText("first echo")).toBeInTheDocument());

    const firstCard = screen.getByText("first echo").closest("article");
    await userEvent.click(within(firstCard).getByRole("button", { name: /safety actions/i }));
    await userEvent.click(screen.getByRole("menuitem", { name: /block @reader_one/i }));

    await waitFor(() => expect(blockHandle).toHaveBeenCalledWith("reader_one"));
    await waitFor(() => expect(screen.queryByText("first echo")).toBeNull());
    // The other author's echo remains.
    expect(screen.getByText("second echo")).toBeInTheDocument();
  });

  it("shows a load-more control (feed does not auto-infinite-scroll) when more remain", async () => {
    getEchoFeed.mockResolvedValue({ ...feed, next_cursor: "c2", caught_up: false });
    render(<EchoesPage />);
    await waitFor(() => expect(screen.getByText("first echo")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /load older echoes/i })).toBeInTheDocument();
    expect(screen.queryByText(/you're caught up/i)).toBeNull();
  });

  it("makes all 18 emotion chips reachable in the filter row [F6.3 / P5-5]", async () => {
    getEchoFeed.mockResolvedValue(feed);
    render(<EchoesPage />);
    await waitFor(() => expect(screen.getByText("first echo")).toBeInTheDocument());
    const filters = screen.getByText("a feeling").closest(".ep-filters");
    // 18 canonical emotions + the "everything" reset chip = 19 chips.
    expect(within(filters).getAllByRole("button")).toHaveLength(19);
  });

  it("renders NO public count anywhere across the feed cards [F6.5]", async () => {
    getEchoFeed.mockResolvedValue(feed);
    const { container } = render(<EchoesPage />);
    await waitFor(() => expect(screen.getByText("first echo")).toBeInTheDocument());
    expect(container.textContent).not.toMatch(/\d+\s*(likes?|replies|reactions?|underlined|added|echoes)/i);
  });
});
