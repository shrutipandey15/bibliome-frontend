import { describe, it, expect, beforeEach, vi } from "vitest";
import { render as rtlRender, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "../contexts/ThemeContext";

// Every surface mounts under the app's ThemeProvider (App.jsx wraps the router).
// Rendering a page without it is a test-only condition, so supply it here rather
// than making `useTheme` tolerate being called outside its provider — a toggle
// that silently does nothing is the bug this provider exists to prevent.
const render = (ui, opts) => rtlRender(ui, { wrapper: ThemeProvider, ...opts });

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
  // Deep links (?echo=, ?section=) are read on mount; default to none.
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}));
vi.mock("../services/api", () => ({
  getEchoFeed: vi.fn(),
  blockHandle: vi.fn(),
  muteHandle: vi.fn(),
  reportEcho: vi.fn(),
  reportReply: vi.fn(),
}));

import EchoesPage, { MINE_FILTER_SUPPORTED } from "./EchoesPage";
import { getEchoFeed, blockHandle } from "../services/api";

const feed = {
  echoes: [
    { id: "e1", handle: "reader_one", body: "first echo", primary_emotion: "grief", created_at: "2026-07-01T10:00:00Z" },
    { id: "e2", handle: "reader_two", body: "second echo", primary_emotion: "awe", created_at: "2026-07-02T10:00:00Z" },
  ],
  next_cursor: null,
  caught_up: true,
};

// The toggle is hidden until the backend honours `?mine=true` — see the flag in
// EchoesPage.jsx. These tests are kept intact and gated on the same constant, so
// the day the param lands the suite that proves it works comes back with it.
describe.runIf(!MINE_FILTER_SUPPORTED)("EchoesPage — 'your echoes' is withheld", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not offer a view it cannot actually filter", async () => {
    getEchoFeed.mockResolvedValue(feed);
    render(<EchoesPage />);
    await waitFor(() => expect(screen.getByText("first echo")).toBeInTheDocument());

    // A feed labelled "yours" that silently returns everyone's echoes is worse
    // than no toggle at all: it invites the author to reread in public.
    expect(screen.queryByRole("button", { name: /your echoes/i })).toBeNull();
    expect(screen.queryByRole("group", { name: /whose echoes/i })).toBeNull();
    expect(getEchoFeed).toHaveBeenLastCalledWith(expect.objectContaining({ mine: false }));
  });
});

describe.skipIf(!MINE_FILTER_SUPPORTED)("EchoesPage — your echoes [B: ?mine=true]", () => {
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

  it("does not tell the author to go first among their own echoes", async () => {
    getEchoFeed.mockResolvedValue({ echoes: [], next_cursor: null, caught_up: true });
    render(<EchoesPage />);
    await waitFor(() => expect(screen.getByText(/^empty\.$/i)).toBeInTheDocument());
    expect(screen.getByText(/go first/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /your echoes/i }));
    await waitFor(() =>
      expect(screen.getByText(/you haven't said anything yet/i)).toBeInTheDocument()
    );
    expect(screen.queryByText(/go first/i)).toBeNull();
  });

  it("states the privacy promise where the private counts appear", async () => {
    getEchoFeed.mockResolvedValue(feed);
    render(<EchoesPage />);
    await waitFor(() => screen.getByText("first echo"));
    expect(screen.queryByText(/nobody else sees these numbers/i)).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: /your echoes/i }));
    expect(await screen.findByText(/nobody else sees these numbers/i)).toBeInTheDocument();
  });
});

describe("EchoesPage feed [F3.3]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders a chronological feed that ENDS with an explicit 'caught up'", async () => {
    getEchoFeed.mockResolvedValue(feed);
    render(<EchoesPage />);
    await waitFor(() => expect(screen.getByText("first echo")).toBeInTheDocument());
    expect(screen.getByText(/that's all of it/i)).toBeInTheDocument();
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
    expect(screen.queryByText(/that's all of it/i)).toBeNull();
  });

  it("makes all 18 emotions reachable in the feeling rail [F6.3 / P5-5]", async () => {
    getEchoFeed.mockResolvedValue(feed);
    render(<EchoesPage />);
    await waitFor(() => expect(screen.getByText("first echo")).toBeInTheDocument());
    // The rail groups the vocabulary by family rather than laying it out as a
    // flat chip wall, but every one of them is still one click away — nothing is
    // behind a "more…" reveal.
    const rail = screen.getByRole("complementary", { name: /filter by feeling/i });
    // 18 canonical emotions + "any feeling" + the write button = 20 controls.
    expect(within(rail).getAllByRole("button")).toHaveLength(20);
  });

  it("renders NO public count anywhere across the feed cards [F6.5]", async () => {
    getEchoFeed.mockResolvedValue(feed);
    const { container } = render(<EchoesPage />);
    await waitFor(() => expect(screen.getByText("first echo")).toBeInTheDocument());
    expect(container.textContent).not.toMatch(/\d+\s*(likes?|replies|reactions?|underlined|added|echoes)/i);
  });
});
