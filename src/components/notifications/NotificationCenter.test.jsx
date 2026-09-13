import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const navigate = vi.fn();
vi.mock("react-router-dom", () => ({ useNavigate: () => navigate }));
vi.mock("../../services/api", () => ({
  getNotifications: vi.fn(),
  markNotificationsRead: vi.fn(),
}));

import NotificationCenter from "./NotificationCenter";
import { getNotifications, markNotificationsRead } from "../../services/api";

const data = {
  unread_count: 2,
  notifications: [
    { id: "n1", tier: 1, kind: "echo_reply", read: false, created_at: new Date().toISOString(),
      payload: { echo_id: "e1", book_title: "Piranesi", actors: ["quiet_reader"], count: 1 } },
    { id: "n2", tier: 2, kind: "weekly_digest", read: false, created_at: new Date().toISOString(),
      payload: { period: "2026-W28", books_this_week: 3, memory: "Three months ago, X wrecked you." } },
    { id: "n3", tier: 0, kind: "password_changed", read: true, created_at: new Date().toISOString(),
      payload: { message: "Your password was changed." } },
  ],
};

describe("NotificationCenter [F4.1 / F4.2 / F3.8]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows a presence dot (not a number) when there are unread items", async () => {
    getNotifications.mockResolvedValue(data);
    const { container } = render(<NotificationCenter />);
    await waitFor(() => expect(container.querySelector(".nc-dot")).toBeInTheDocument());
    // Calm-first: the bell's accessible name mentions unread, but no number is painted on it.
    expect(screen.getByRole("button", { name: /2 unread/i })).toBeInTheDocument();
  });

  it("renders batched reply notices and the weekly digest [F3.8 / F4.2]", async () => {
    getNotifications.mockResolvedValue(data);
    render(<NotificationCenter />);
    await userEvent.click(await screen.findByRole("button", { name: /notifications/i }));

    expect(await screen.findByText(/replied to your echo/i)).toBeInTheDocument();
    expect(screen.getByText(/@quiet_reader/)).toBeInTheDocument();
    expect(screen.getByText(/your reading week/i)).toBeInTheDocument();
    expect(screen.getByText(/shelved/i)).toBeInTheDocument();
  });

  it("names the reactor and the reaction when exactly one person reacted", async () => {
    getNotifications.mockResolvedValue({
      unread_count: 1,
      notifications: [
        { id: "n4", tier: 1, kind: "chat_reaction", read: false, created_at: new Date().toISOString(),
          payload: { thread_id: "t1", message_id: "m1", kind: "underlined", actors: ["quiet_reader"], count: 1 } },
      ],
    });
    render(<NotificationCenter />);
    await userEvent.click(await screen.findByRole("button", { name: /notifications/i }));
    expect(await screen.findByText(/@quiet_reader underlined your letter/i)).toBeInTheDocument();
  });

  it("stays vague about which reaction once several people have picked different ones", async () => {
    getNotifications.mockResolvedValue({
      unread_count: 1,
      notifications: [
        { id: "n5", tier: 1, kind: "chat_reaction", read: false, created_at: new Date().toISOString(),
          payload: { collection_id: "c1", message_id: "m1", kind: "chills", actors: ["a", "b"], count: 2 } },
      ],
    });
    render(<NotificationCenter />);
    await userEvent.click(await screen.findByRole("button", { name: /notifications/i }));
    expect(await screen.findByText(/2 readers reacted to your message/i)).toBeInTheDocument();
  });

  it("renders a mention", async () => {
    getNotifications.mockResolvedValue({
      unread_count: 1,
      notifications: [
        { id: "n6", tier: 1, kind: "chat_mention", read: false, created_at: new Date().toISOString(),
          payload: { collection_id: "c1", message_id: "m1", actors: ["mara"], count: 1 } },
      ],
    });
    render(<NotificationCenter />);
    await userEvent.click(await screen.findByRole("button", { name: /notifications/i }));
    expect(await screen.findByText(/@mara mentioned you in a collection room/i)).toBeInTheDocument();
  });

  it("names both archetypes on a DNA shift, rather than the raw kind string", async () => {
    // Before this case existed this fell through to the generic fallback and
    // rendered literally as "dna shifted" — dead text, same bug class as the
    // other kinds documented above.
    getNotifications.mockResolvedValue({
      unread_count: 1,
      notifications: [
        { id: "n7", tier: 1, kind: "dna_shifted", read: false, created_at: new Date().toISOString(),
          payload: { old: "Grief Romantic", new: "Midnight Arsonist" } },
      ],
    });
    render(<NotificationCenter />);
    await userEvent.click(await screen.findByRole("button", { name: /notifications/i }));
    expect(await screen.findByText(/Grief Romantic/)).toBeInTheDocument();
    expect(screen.getByText(/Midnight Arsonist/)).toBeInTheDocument();
    expect(screen.queryByText(/^dna shifted$/i)).not.toBeInTheDocument();
  });

  it("shows who joined a room, as a clickable link into it", async () => {
    markNotificationsRead.mockResolvedValue(undefined);
    getNotifications.mockResolvedValue({
      unread_count: 1,
      notifications: [
        { id: "n8", tier: 1, kind: "collection_joined", read: false, created_at: new Date().toISOString(),
          payload: { collection_id: "c1", actors: ["ines"], count: 1 } },
      ],
    });
    render(<NotificationCenter />);
    await userEvent.click(await screen.findByRole("button", { name: /notifications/i }));
    await userEvent.click(await screen.findByText(/@ines joined a room you're in/i));
    expect(navigate).toHaveBeenCalledWith("/collections/c1/discussion");
  });

  it("names the deleted room without turning it into a dead-end button", async () => {
    getNotifications.mockResolvedValue({
      unread_count: 1,
      notifications: [
        { id: "n9", tier: 1, kind: "collection_deleted", read: false, created_at: new Date().toISOString(),
          payload: { title: "Doomed Room" } },
      ],
    });
    render(<NotificationCenter />);
    await userEvent.click(await screen.findByRole("button", { name: /notifications/i }));
    const row = await screen.findByText(/Doomed Room/);
    expect(row.closest("button")).toBeNull(); // no target — plain text, not a control
  });

  it("marks all read", async () => {
    getNotifications.mockResolvedValue(data);
    markNotificationsRead.mockResolvedValue(undefined);
    render(<NotificationCenter />);
    await userEvent.click(await screen.findByRole("button", { name: /notifications/i }));
    await userEvent.click(await screen.findByRole("button", { name: /mark all read/i }));
    expect(markNotificationsRead).toHaveBeenCalledWith(null);
  });

  it("shows an honest empty state", async () => {
    getNotifications.mockResolvedValue({ notifications: [], unread_count: 0 });
    render(<NotificationCenter />);
    await userEvent.click(await screen.findByRole("button", { name: /notifications/i }));
    expect(await screen.findByText(/all caught up/i)).toBeInTheDocument();
  });
});

describe("NotificationCenter — clicking a notification takes you there", () => {
  beforeEach(() => vi.clearAllMocks());

  it("navigates to the echo that was replied to, and closes the panel", async () => {
    getNotifications.mockResolvedValue(data);
    markNotificationsRead.mockResolvedValue(undefined);
    render(<NotificationCenter />);
    await userEvent.click(screen.getByRole("button", { name: /notifications/i }));

    const row = await screen.findByRole("button", { name: /replied to your echo/i });
    await userEvent.click(row);

    expect(navigate).toHaveBeenCalledWith("/echoes?echo=e1");
    await waitFor(() => expect(screen.queryByText(/mark all read/i)).toBeNull());
  });

  it("reads the item it opened — going to look at it IS the acknowledgement", async () => {
    getNotifications.mockResolvedValue(data);
    markNotificationsRead.mockResolvedValue(undefined);
    render(<NotificationCenter />);
    await userEvent.click(screen.getByRole("button", { name: /notifications/i }));
    await userEvent.click(await screen.findByRole("button", { name: /replied to your echo/i }));

    // Only that one, not the whole list.
    expect(markNotificationsRead).toHaveBeenCalledWith(["n1"]);
  });

  it("sends a security notice to account security", async () => {
    getNotifications.mockResolvedValue(data);
    render(<NotificationCenter />);
    await userEvent.click(screen.getByRole("button", { name: /notifications/i }));
    await userEvent.click(await screen.findByRole("button", { name: /password was changed/i }));
    expect(navigate).toHaveBeenCalledWith("/settings?section=security");
  });

  it("picks up notifications that arrive while the tab sits open", async () => {
    // The bug this covers: the centre used to fetch once on mount, so a reply
    // arriving afterwards was invisible until a reload.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      getNotifications.mockResolvedValue({ unread_count: 0, notifications: [] });
      const { container } = render(<NotificationCenter />);
      await waitFor(() => expect(getNotifications).toHaveBeenCalledTimes(1));
      expect(container.querySelector(".nc-dot")).toBeNull();

      getNotifications.mockResolvedValue(data);
      // act(), or the poll's state update lands outside React's batching and
      // the suite fills with warnings about it.
      await act(async () => { await vi.advanceTimersByTimeAsync(301_000); });

      await waitFor(() => expect(container.querySelector(".nc-dot")).not.toBeNull());
    } finally {
      vi.useRealTimers();
    }
  });
});
