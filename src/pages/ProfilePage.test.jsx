import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));
vi.mock("../contexts/JournalContext", () => ({ useJournal: () => ({ entries: [] }) }));
vi.mock("../components/DNACard", () => ({ default: () => <div data-testid="dnacard" /> }));
vi.mock("../services/api", () => ({
  getMyProfile: vi.fn(),
  updateMyProfile: vi.fn(),
  getInsight: vi.fn().mockResolvedValue(null),
  createCollection: vi.fn(), deleteCollection: vi.fn(),
  addCollectionItem: vi.fn(), removeCollectionItem: vi.fn(), reorderCollection: vi.fn(),
}));

import ProfilePage from "./ProfilePage";
import { getMyProfile, updateMyProfile, getInsight } from "../services/api";

const profile = {
  handle: "alice", display_name: "Alice", bio: null, profile_visibility: "private",
  personality_type: "The Grief Romantic", is_self: true, signature: null,
  member_since: "2024-03-01T00:00:00+00:00",
  now_reading: [{ entry_id: "n1", title: "Reading Now", author: "A", dominant_emotion: "grief", status: "reading" }],
  collections: [],
  milestones: [
    { kind: "first_book", label: "Logged your first book", achieved: true, achieved_at: "2024-11-02T00:00:00+00:00" },
    { kind: "full_spectrum", label: "Read across all 18 emotional registers", achieved: false, achieved_at: null },
  ],
  book_count: 5,
  registers_felt: 4,
  avg_intensity: 6.2,
  set_down: 1,
  margins: [],
  recent: [{ entry_id: "r1", title: "Recent Book", author: "B", dominant_emotion: "awe", status: "finished" }],
};

describe("ProfilePage self-view [F2.8]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getInsight.mockResolvedValue(null);
  });

  it("renders the identity strip, Now, history and milestones", async () => {
    getMyProfile.mockResolvedValue(profile);
    const { container } = render(<ProfilePage />);
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());
    expect(screen.getByText("@alice")).toBeInTheDocument();
    expect(screen.getByText("The Grief Romantic")).toBeInTheDocument();
    expect(screen.getByText("Reading Now")).toBeInTheDocument();
    expect(screen.getByText("Recent Book")).toBeInTheDocument();
    expect(screen.getByText(/Logged your first book/)).toBeInTheDocument();
    // Still no social metrics of any kind — the rule that matters. [F2.8]
    expect(container.textContent).not.toMatch(/follower|following|profile views/i);
  });

  it("shows only figures the shelf can actually count", async () => {
    getMyProfile.mockResolvedValue({ ...profile, avg_intensity: null, set_down: 0 });
    render(<ProfilePage />);
    await waitFor(() => screen.getByText("Alice"));

    expect(screen.getByText("registers felt")).toBeInTheDocument();
    // An empty shelf has no average; the figure is absent, never a fabricated 0.
    expect(screen.queryByText("avg intensity")).not.toBeInTheDocument();
  });

  it("dims the milestones still ahead instead of hiding them", async () => {
    getMyProfile.mockResolvedValue(profile);
    render(<ProfilePage />);
    await waitFor(() => screen.getByText("Alice"));

    expect(screen.getByText(/Read across all 18 emotional registers/)).toBeInTheDocument();
    expect(screen.getByText("not yet")).toBeInTheDocument();
  });

  it("renders the lines you kept, and expanding is reversible", async () => {
    getMyProfile.mockResolvedValue({
      ...profile,
      margins: [
        { entry_id: "m1", title: "Gilead", quote: "the first line", at: "2025-03-04", dominant_emotion: "awe" },
        { entry_id: "m2", title: "Middlemarch", quote: "the second line", at: "2025-02-01", dominant_emotion: "grief" },
        { entry_id: "m3", title: "Piranesi", quote: "the third line", at: "2025-01-01", dominant_emotion: "awe" },
        { entry_id: "m4", title: "Beach Read", quote: "the fourth line", at: "2024-12-01", dominant_emotion: "comfort" },
      ],
    });
    render(<ProfilePage />);
    await waitFor(() => screen.getByText("Alice"));

    expect(screen.getByText(/the first line/)).toBeInTheDocument();
    expect(screen.queryByText(/the fourth line/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /more from your margins/i }));
    expect(screen.getByText(/the fourth line/)).toBeInTheDocument();

    // …and back again. Expanding used to be a one-way door.
    await userEvent.click(screen.getByRole("button", { name: /show fewer/i }));
    expect(screen.queryByText(/the fourth line/)).not.toBeInTheDocument();
  });

  it("says nothing when the shelf has noticed nothing", async () => {
    getMyProfile.mockResolvedValue(profile);
    render(<ProfilePage />);
    await waitFor(() => screen.getByText("Alice"));
    expect(screen.queryByText(/the shelf says/i)).not.toBeInTheDocument();
  });

  it("shows the shelf's observation when there is a real one", async () => {
    getMyProfile.mockResolvedValue(profile);
    getInsight.mockResolvedValue({ sentence: "You have started four Gothic novels since March." });
    render(<ProfilePage />);
    await waitFor(() => expect(screen.getByText(/four Gothic novels/)).toBeInTheDocument());
  });

  it("tells a brand-new reader what will live here, and counts nothing", async () => {
    getMyProfile.mockResolvedValue({
      ...profile, book_count: 0, registers_felt: 0, avg_intensity: null, set_down: 0,
      now_reading: [], recent: [], margins: [], milestones: [], collections: [],
    });
    render(<ProfilePage />);
    await waitFor(() => screen.getByText("Alice"));

    expect(screen.getByText(/nothing shelved yet/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /log your first book/i })).toBeInTheDocument();
    // No figure quad on an empty shelf — not even zeroes.
    expect(screen.queryByText("registers felt")).not.toBeInTheDocument();
    // And no shelf-naming offer before there is a book to put on one.
    expect(screen.queryByText(/start a shelf/i)).not.toBeInTheDocument();
  });

  it("says how far off the signature is rather than faking a card", async () => {
    getMyProfile.mockResolvedValue({ ...profile, book_count: 2, signature: null });
    render(<ProfilePage />);
    await waitFor(() => screen.getByText("Alice"));

    expect(screen.getByText(/3 more books/i)).toBeInTheDocument();
    expect(screen.queryByTestId("dnacard")).not.toBeInTheDocument();
  });

  it("draws a progress bar only for a book whose reader placed it", async () => {
    getMyProfile.mockResolvedValue({
      ...profile,
      now_reading: [
        { entry_id: "n1", title: "Placed", author: "A", dominant_emotion: "grief", status: "reading", progress: 41 },
        { entry_id: "n2", title: "Unplaced", author: "B", dominant_emotion: "awe", status: "reading", progress: null },
      ],
    });
    render(<ProfilePage />);
    await waitFor(() => screen.getByText("Placed"));

    const bars = screen.getAllByRole("progressbar");
    expect(bars).toHaveLength(1);
    expect(bars[0]).toHaveAttribute("aria-valuenow", "41");
  });

  it("edits the bio via inline editor", async () => {
    getMyProfile.mockResolvedValue(profile);
    updateMyProfile.mockResolvedValue({ ...profile, bio: "reads for catharsis" });
    render(<ProfilePage />);
    await waitFor(() => screen.getByText("Alice"));

    await userEvent.click(screen.getByRole("button", { name: /\+ add/i }));
    await userEvent.type(screen.getByLabelText(/your bio/i), "reads for catharsis");
    await userEvent.click(screen.getByRole("button", { name: /^save$/i }));

    expect(updateMyProfile).toHaveBeenCalledWith({ bio: "reads for catharsis" });
    await waitFor(() => expect(screen.getByText("reads for catharsis")).toBeInTheDocument());
  });

  it("renders the signature card only when a DNA profile exists", async () => {
    getMyProfile.mockResolvedValue({ ...profile, signature: { personality: { name: "X" } } });
    render(<ProfilePage />);
    await waitFor(() => expect(screen.getByTestId("dnacard")).toBeInTheDocument());
  });
});
