import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// The navigate identity has to be stable across renders. Real useNavigate is;
// a `() => vi.fn()` mock is not, and AdminPage lists it in an effect's deps —
// a fresh function each render re-fires the load and spins forever.
const navigate = vi.fn();
vi.mock("react-router-dom", () => ({ useNavigate: () => navigate }));

const user = { is_admin: true };
vi.mock("../contexts/AuthContext", () => ({ useAuth: () => ({ user }) }));

vi.mock("../services/api", () => ({
  apiFetch: vi.fn(),
  getModerationQueue: vi.fn(),
  resolveReport: vi.fn(),
}));

import AdminPage from "./AdminPage";
import { apiFetch, getModerationQueue, resolveReport } from "../services/api";

const stats = {
  total_users: 3, total_entries: 9, total_echoes: 4, total_dna_generated: 1,
  users_last_7d: 1, entries_last_7d: 2, db_size_mb: 12.5,
  expired_refresh_tokens: 0, catalog_books: 40, open_reports: 2,
};

const heldEcho = {
  target_type: "echo", target_id: "e1", report_count: 3, categories: ["spam"],
  first_reported_at: "2026-08-01T10:00:00Z", target_exists: true,
  status: "held", author_handle: "opal", preview: "the reported text", truncated: false,
};

const orphan = {
  target_type: "reply", target_id: "r9", report_count: 1, categories: ["harassment"],
  first_reported_at: "2026-08-02T10:00:00Z", target_exists: false,
  status: null, author_handle: null, preview: null, truncated: false,
};

const thread = {
  target_type: "thread", target_id: "t4", report_count: 1, categories: ["harassment"],
  first_reported_at: "2026-08-03T10:00:00Z", target_exists: true,
  status: "open", author_handle: null, preview: null, truncated: false,
  participants: ["ada", "bea"], message_count: 12,
};

beforeEach(() => {
  vi.clearAllMocks();
  apiFetch.mockImplementation((path) =>
    Promise.resolve({ ok: true, json: async () => (path === "/admin/dashboard" ? stats : []) })
  );
  getModerationQueue.mockResolvedValue([heldEcho, orphan, thread]);
  resolveReport.mockResolvedValue({ status: "ok" });
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

const openQueue = async () => {
  render(<AdminPage />);
  await screen.findByText("Users");
  await userEvent.click(screen.getByRole("button", { name: /moderation/i }));
  await screen.findByText("the reported text");
};

describe("AdminPage — moderation queue", () => {
  it("badges the tab from the dashboard load, before the queue is opened", async () => {
    render(<AdminPage />);
    const tab = await screen.findByRole("button", { name: /moderation/i });
    // The badge is the point of the tab: without it you still have to remember
    // to go and look, which is what having no queue surface amounted to.
    expect(within(tab).getByText("2")).toBeInTheDocument();
    expect(getModerationQueue).not.toHaveBeenCalled();
  });

  it("shows the body preview, author and held status so a call can be made", async () => {
    await openQueue();
    expect(screen.getByText("opal")).toBeInTheDocument();
    expect(screen.getByText("held")).toBeInTheDocument();
  });

  it("never prints a private thread's transcript, only who and how many", async () => {
    await openQueue();
    expect(screen.getByText(/ada ↔ bea · 12 messages/)).toBeInTheDocument();
  });

  it("confirms before removing, and dismisses without a prompt", async () => {
    await openQueue();
    await userEvent.click(screen.getAllByRole("button", { name: "Remove" })[0]);
    expect(window.confirm).toHaveBeenCalled();
    expect(resolveReport).toHaveBeenCalledWith("echo", "e1", "remove");

    window.confirm.mockClear();
    await userEvent.click(screen.getAllByRole("button", { name: "Dismiss" })[0]);
    expect(window.confirm).not.toHaveBeenCalled();
    expect(resolveReport).toHaveBeenCalledWith("echo", "e1", "dismiss");
  });

  it("offers only 'clear' for a deleted target, since remove/dismiss would 404", async () => {
    await openQueue();
    const row = screen.getByText(/target deleted/).closest("tr");
    expect(within(row).queryByRole("button", { name: "Remove" })).toBeNull();
    await userEvent.click(within(row).getByRole("button", { name: "Clear" }));
    expect(resolveReport).toHaveBeenCalledWith("reply", "r9", "clear");
  });

  it("surfaces a failed resolve instead of silently leaving the row", async () => {
    await openQueue();
    resolveReport.mockRejectedValueOnce(new Error("Target not found"));
    await userEvent.click(screen.getAllByRole("button", { name: "Dismiss" })[0]);
    expect(await screen.findByText("Target not found")).toBeInTheDocument();
  });

  it("re-reads the badge count after resolving, so it can reach zero", async () => {
    await openQueue();
    apiFetch.mockClear();
    await userEvent.click(screen.getAllByRole("button", { name: "Dismiss" })[0]);
    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith("/admin/dashboard")
    );
  });
});
