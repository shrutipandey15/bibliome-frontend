import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../../services/api", () => ({
  getCollectionMembers: vi.fn(),
  createCollectionInvite: vi.fn(),
  revokeCollectionInvite: vi.fn(),
  leaveCollection: vi.fn(),
}));

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "me" } }),
}));

import CollectionSharing from "./CollectionSharing";
import {
  getCollectionMembers,
  createCollectionInvite,
  revokeCollectionInvite,
  leaveCollection,
} from "../../services/api";

const COLLECTION = { id: "c1", title: "Winter Reads" };

const OWNER = [{ user_id: "me", handle: "owner", role: "owner", joined_at: "2026-01-01" }];
const MEMBER = [
  { user_id: "them", handle: "owner", role: "owner", joined_at: "2026-01-01" },
  { user_id: "me", handle: "guest", role: "member", joined_at: "2026-01-02" },
];

describe("CollectionSharing [#5]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCollectionMembers.mockResolvedValue(OWNER);
  });

  it("shows the invite link once, and says it won't be shown again", async () => {
    // The server stores only a hash, so this really is the only time it exists.
    // Copy that implied otherwise would be a lie the reader finds out later.
    createCollectionInvite.mockResolvedValue({ id: "i1", token: "TOK123" });
    render(<CollectionSharing collection={COLLECTION} />);

    await userEvent.click(await screen.findByRole("button", { name: /create an invite link/i }));

    const field = await screen.findByLabelText(/won.t be shown again/i);
    // Points at the APP's join route, not the API — a shared link must open
    // Bibliome for the person who receives it.
    expect(field.value).toContain("/collections/join/TOK123");
    expect(field.value.startsWith(window.location.origin)).toBe(true);
  });

  it("does not offer invite controls to a member", async () => {
    // Only the owner can invite. The backend enforces it; the UI must not dangle
    // a control that will 404.
    getCollectionMembers.mockResolvedValue(MEMBER);
    render(<CollectionSharing collection={COLLECTION} />);

    await screen.findByText(/@owner/);
    expect(screen.queryByRole("button", { name: /create an invite link/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /leave this collection/i })).toBeInTheDocument();
  });

  it("does not offer invite controls before the member list has loaded", async () => {
    // Ownership is the server's answer. Guessing "probably the owner" while the
    // list is in flight flashes a control that then disappears.
    let resolve;
    getCollectionMembers.mockReturnValue(new Promise((r) => { resolve = r; }));
    render(<CollectionSharing collection={COLLECTION} />);

    expect(screen.queryByRole("button", { name: /create an invite link/i })).not.toBeInTheDocument();
    resolve(OWNER);
    expect(await screen.findByRole("button", { name: /create an invite link/i })).toBeInTheDocument();
  });

  it("says revoking keeps existing members", async () => {
    // The distinction that stops an owner nuking their own group by accident.
    createCollectionInvite.mockResolvedValue({ id: "i1", token: "TOK123" });
    render(<CollectionSharing collection={COLLECTION} />);
    await userEvent.click(await screen.findByRole("button", { name: /create an invite link/i }));

    expect(await screen.findByText(/people who already joined stay/i)).toBeInTheDocument();
  });

  it("revokes the link it is showing", async () => {
    createCollectionInvite.mockResolvedValue({ id: "i1", token: "TOK123" });
    revokeCollectionInvite.mockResolvedValue();
    render(<CollectionSharing collection={COLLECTION} />);
    await userEvent.click(await screen.findByRole("button", { name: /create an invite link/i }));
    await userEvent.click(await screen.findByRole("button", { name: /revoke this link/i }));

    await waitFor(() => expect(revokeCollectionInvite).toHaveBeenCalledWith("c1", "i1"));
    expect(screen.queryByLabelText(/won.t be shown again/i)).not.toBeInTheDocument();
  });

  it("surfaces the reason a leave failed instead of pretending it worked", async () => {
    getCollectionMembers.mockResolvedValue(MEMBER);
    leaveCollection.mockRejectedValue(new Error("The owner cannot leave their own collection"));
    const onLeft = vi.fn();
    render(<CollectionSharing collection={COLLECTION} onLeft={onLeft} />);

    await userEvent.click(await screen.findByRole("button", { name: /leave this collection/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/cannot leave/i);
    expect(onLeft).not.toHaveBeenCalled();
  });

  it("marks which member is you", async () => {
    getCollectionMembers.mockResolvedValue(MEMBER);
    render(<CollectionSharing collection={COLLECTION} />);
    expect(await screen.findByText(/\(you\)/)).toBeInTheDocument();
  });
});
