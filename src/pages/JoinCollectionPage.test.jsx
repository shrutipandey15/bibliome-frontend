import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";

vi.mock("../services/api", () => ({
  peekCollectionInvite: vi.fn(),
  joinCollection: vi.fn(),
}));

const mockUser = { current: { id: "me" } };
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: mockUser.current }),
}));

import JoinCollectionPage from "./JoinCollectionPage";
import { peekCollectionInvite, joinCollection } from "../services/api";
import { takeInvite } from "../services/pendingInvite";

const PEEK = {
  collection_id: "c1",
  title: "Winter Reads",
  description: "books for the dark months",
  member_count: 3,
  book_count: 12,
  already_member: false,
};

function renderAt(token = "TOK") {
  return render(
    <MemoryRouter initialEntries={[`/collections/join/${token}`]}>
      <Routes>
        <Route path="/collections/join/:token" element={<JoinCollectionPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("JoinCollectionPage [#5]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser.current = { id: "me" };
    sessionStorage.clear();
  });

  it("names the collection and its size BEFORE joining", async () => {
    // Nobody should be added to something they haven't seen. The peek exists so
    // the decision is informed, and joining is always a deliberate tap.
    peekCollectionInvite.mockResolvedValue(PEEK);
    renderAt();

    expect(await screen.findByText("Winter Reads")).toBeInTheDocument();
    expect(screen.getByText(/3 readers · 12 books/)).toBeInTheDocument();
    expect(joinCollection).not.toHaveBeenCalled();
  });

  it("joins only on the tap", async () => {
    peekCollectionInvite.mockResolvedValue(PEEK);
    joinCollection.mockResolvedValue({ collection_id: "c1", title: "Winter Reads", joined: true });
    renderAt();

    await userEvent.click(await screen.findByRole("button", { name: /join this collection/i }));

    await waitFor(() => expect(joinCollection).toHaveBeenCalledWith("TOK"));
    expect(await screen.findByText(/you.re in/i)).toBeInTheDocument();
  });

  it("says 'already in' rather than congratulating a repeat click", async () => {
    // The backend reports joined:false for an existing member. Saying "You're
    // in!" would imply something happened that didn't.
    peekCollectionInvite.mockResolvedValue(PEEK);
    joinCollection.mockResolvedValue({ collection_id: "c1", title: "Winter Reads", joined: false });
    renderAt();

    await userEvent.click(await screen.findByRole("button", { name: /join this collection/i }));
    expect(await screen.findByText(/already in this one/i)).toBeInTheDocument();
  });

  it("explains a dead link instead of showing a blank page", async () => {
    peekCollectionInvite.mockResolvedValue(null);
    renderAt();

    expect(await screen.findByText(/isn.t live/i)).toBeInTheDocument();
    expect(screen.getByText(/expired, been used up, or been revoked/i)).toBeInTheDocument();
  });

  it("offers nothing to join when the viewer is already a member", async () => {
    peekCollectionInvite.mockResolvedValue({ ...PEEK, already_member: true });
    renderAt();

    expect(await screen.findByText(/already in this collection/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /join this collection/i })).not.toBeInTheDocument();
  });

  it("names the collection to a signed-out reader and parks the invite", async () => {
    // Bouncing straight to a login page explains nothing about what was clicked.
    // The token is stashed so signing in returns them here.
    mockUser.current = null;
    peekCollectionInvite.mockResolvedValue(PEEK);
    renderAt("TOK9");

    expect(await screen.findByText("Winter Reads")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("link", { name: /sign in to join/i }));

    expect(takeInvite()).toBe("TOK9");
  });
});
