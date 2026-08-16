import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../services/push", () => ({
  pushSupported: vi.fn(),
  pushPermission: vi.fn(),
  pushConfig: vi.fn(),
  currentSubscription: vi.fn(),
  enablePush: vi.fn(),
}));

import PushPrompt from "./PushPrompt";
import { pushSupported, pushPermission, pushConfig, currentSubscription, enablePush } from "../services/push";

describe("PushPrompt [add-on to #6]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    pushSupported.mockReturnValue(true);
    pushPermission.mockReturnValue("default");
    pushConfig.mockResolvedValue({ enabled: true, key: "k" });
    currentSubscription.mockResolvedValue(null);
  });

  it("asks, but never prompts on its own", async () => {
    // The browser dialog must come from the tap. Chrome refuses a prompt raised
    // on mount and Safari treats a dismissal as permanent.
    render(<PushPrompt />);
    expect(await screen.findByRole("button", { name: /turn them on/i })).toBeInTheDocument();
    expect(enablePush).not.toHaveBeenCalled();
  });

  it("subscribes on the tap", async () => {
    enablePush.mockResolvedValue(true);
    render(<PushPrompt />);
    await userEvent.click(await screen.findByRole("button", { name: /turn them on/i }));
    await waitFor(() => expect(enablePush).toHaveBeenCalled());
  });

  it("never asks twice once dismissed", async () => {
    // A banner that reappears until obeyed is a dark pattern, not a default.
    const { unmount } = render(<PushPrompt />);
    await userEvent.click(await screen.findByRole("button", { name: /not now/i }));
    unmount();

    render(<PushPrompt />);
    await waitFor(() => expect(screen.queryByRole("button", { name: /turn them on/i })).not.toBeInTheDocument());
  });

  it("stays quiet when permission was already granted", async () => {
    pushPermission.mockReturnValue("granted");
    render(<PushPrompt />);
    await waitFor(() => expect(screen.queryByRole("region")).not.toBeInTheDocument());
  });

  it("stays quiet when permission was denied — it cannot be re-asked", async () => {
    pushPermission.mockReturnValue("denied");
    render(<PushPrompt />);
    await waitFor(() => expect(screen.queryByRole("region")).not.toBeInTheDocument());
  });

  it("stays quiet when the server has no push keys", async () => {
    pushConfig.mockResolvedValue({ enabled: false, key: null });
    render(<PushPrompt />);
    await waitFor(() => expect(screen.queryByRole("region")).not.toBeInTheDocument());
  });

  it("does not ask again after a refused prompt", async () => {
    enablePush.mockRejectedValue(new Error("denied"));
    const { unmount } = render(<PushPrompt />);
    await userEvent.click(await screen.findByRole("button", { name: /turn them on/i }));
    await waitFor(() => expect(screen.queryByRole("region")).not.toBeInTheDocument());
    unmount();

    render(<PushPrompt />);
    await waitFor(() => expect(screen.queryByRole("button", { name: /turn them on/i })).not.toBeInTheDocument());
  });
});
