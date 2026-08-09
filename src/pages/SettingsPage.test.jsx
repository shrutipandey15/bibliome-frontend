import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock the router + auth so we can render SettingsPage in isolation.
vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
  // Deep links (?echo=, ?section=) are read on mount; default to none.
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}));
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { username: "alice" }, logout: vi.fn(), refreshUser: vi.fn() }),
}));
// Settings owns the change-password form, which now has to re-wrap the journal
// key in the same request. The re-wrap itself is covered in journalCrypto.test.js;
// here it just needs to exist.
vi.mock("../contexts/JournalKeyContext", () => ({
  useJournalKey: () => ({ changePasswordWithRewrap: vi.fn().mockResolvedValue({}) }),
}));

vi.mock("../services/api", () => ({
  getSettings: vi.fn().mockResolvedValue({ display_name: "Alice", profile_visibility: "private", username: "alice", reads_for: [] }),
  updateSettings: vi.fn().mockResolvedValue({}),
  changePassword: vi.fn(),
  generateShareToken: vi.fn().mockResolvedValue({ share_token: "tok123", room_unlocks_new: [] }),
  revokeShareTokens: vi.fn().mockResolvedValue(undefined),
  changeHandle: vi.fn().mockResolvedValue({}),
  getNotificationPrefs: vi.fn().mockResolvedValue({
    reply_enabled: true, digest_enabled: true, quiet_hours_start: null, quiet_hours_end: null, timezone: "UTC",
  }),
  updateNotificationPrefs: vi.fn().mockImplementation(async (patch) => ({
    reply_enabled: true, digest_enabled: true, quiet_hours_start: null, quiet_hours_end: null, timezone: "UTC", ...patch,
  })),
  setReadFor: vi.fn().mockResolvedValue({}),
}));

import SettingsPage from "./SettingsPage";
import { getSettings, updateSettings, generateShareToken, revokeShareTokens, changeHandle, updateNotificationPrefs } from "../services/api";

async function openVisibility() {
  render(<SettingsPage />);
  await userEvent.click(screen.getByRole("button", { name: /Visibility/i }));
}

describe("SettingsPage visibility control [F2.8 / B2.1]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads and reflects the current profile_visibility", async () => {
    await openVisibility();
    await waitFor(() =>
      expect(screen.getByRole("radio", { name: /Private/i })).toBeChecked(),
    );
  });

  it("writes profile_visibility (not is_public) when a new option is chosen", async () => {
    await openVisibility();
    await waitFor(() => screen.getByRole("radio", { name: /Community/i }));
    await userEvent.click(screen.getByRole("radio", { name: /Community/i }));
    expect(updateSettings).toHaveBeenCalledWith({ profile_visibility: "community" });
  });

  it("reverts the selection if the update fails", async () => {
    updateSettings.mockRejectedValueOnce(new Error("nope"));
    await openVisibility();
    await waitFor(() => screen.getByRole("radio", { name: /Community/i }));
    await userEvent.click(screen.getByRole("radio", { name: /Community/i }));
    await waitFor(() =>
      expect(screen.getByRole("radio", { name: /Private/i })).toBeChecked(),
    );
  });

  it("does not offer Public — nothing here is readable without an account", async () => {
    await openVisibility();
    await waitFor(() => screen.getByRole("radio", { name: /Community/i }));
    expect(screen.queryByRole("radio", { name: /Public/i })).not.toBeInTheDocument();
  });

  it("still shows the retired option to an account already set to it", async () => {
    // Once, not permanently: clearAllMocks resets calls but keeps implementations,
    // so a lasting override here would follow the later tests.
    getSettings.mockResolvedValueOnce({ profile_visibility: "public", username: "alice", reads_for: [] });
    await openVisibility();
    // Their real setting must stay visible and selected — we don't quietly
    // rewrite someone's privacy choice, we explain it and let them move.
    await waitFor(() => expect(screen.getByRole("radio", { name: /Public \(retired\)/i })).toBeChecked());
  });

  it("persists notification preferences and the one-tap 'fewer' shortcut [F4.3]", async () => {
    render(<SettingsPage />);
    await userEvent.click(screen.getByRole("button", { name: /Notifications/i }));

    // Toggling the reply switch persists reply_enabled=false.
    const replySwitch = await screen.findByRole("switch", { name: /replies to your echoes/i });
    await waitFor(() => expect(replySwitch).toHaveAttribute("aria-checked", "true"));
    await userEvent.click(replySwitch);
    expect(updateNotificationPrefs).toHaveBeenCalledWith({ reply_enabled: false });

    // One-tap "fewer notifications" = digest only.
    await userEvent.click(screen.getByRole("button", { name: /fewer notifications/i }));
    expect(updateNotificationPrefs).toHaveBeenCalledWith({ reply_enabled: false, digest_enabled: true });
  });

  it("changes the pseudonymous handle [F3.1 / B3.1]", async () => {
    render(<SettingsPage />);
    await waitFor(() => expect(screen.getByLabelText("Public handle")).toHaveValue("alice"));
    const input = screen.getByLabelText("Public handle");
    await userEvent.clear(input);
    await userEvent.type(input, "quiet_reader");
    await userEvent.click(screen.getByRole("button", { name: /change handle/i }));
    expect(changeHandle).toHaveBeenCalledWith("quiet_reader");
  });

  it("mints a share link and can revoke", async () => {
    await openVisibility();
    await userEvent.click(screen.getByRole("button", { name: /Create a link/i }));
    expect(generateShareToken).toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByLabelText("Your share link").value).toContain("/s/tok123"),
    );
    await userEvent.click(screen.getByRole("button", { name: /Revoke all links/i }));
    expect(revokeShareTokens).toHaveBeenCalled();
  });
});
