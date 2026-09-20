import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../services/push", () => ({
  pushSupported: vi.fn(),
  pushPermission: vi.fn(),
  pushConfig: vi.fn(),
  currentSubscription: vi.fn(),
  enablePush: vi.fn(),
  disablePush: vi.fn(),
  sendTestPush: vi.fn(),
}));

import PushToggle from "./PushToggle";
import {
  pushSupported, pushPermission, pushConfig, currentSubscription,
  enablePush, disablePush, sendTestPush,
} from "../services/push";

describe("PushToggle [add-on to #6]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pushSupported.mockReturnValue(true);
    pushPermission.mockReturnValue("default");
    pushConfig.mockResolvedValue({ enabled: true, key: "k" });
    currentSubscription.mockResolvedValue(null);
  });

  it("never asks for permission on mount — only on the tap", async () => {
    // Browsers refuse a prompt raised on load, and Safari treats a dismissed one
    // as a permanent denial. Asking unprompted burns the single chance.
    render(<PushToggle />);
    await screen.findByRole("button", { name: /turn on/i });
    expect(enablePush).not.toHaveBeenCalled();
  });

  it("subscribes on the tap", async () => {
    enablePush.mockResolvedValue(true);
    render(<PushToggle />);
    await userEvent.click(await screen.findByRole("button", { name: /turn on/i }));

    await waitFor(() => expect(enablePush).toHaveBeenCalled());
    expect(await screen.findByRole("button", { name: /turn off/i })).toBeInTheDocument();
  });

  it("says push is per-device, not per-account", async () => {
    // A reader who enables it on a laptop and hears nothing on their phone has
    // been misled by a control that looked like an account preference.
    render(<PushToggle />);
    expect(await screen.findByText(/this device only/i)).toBeInTheDocument();
  });

  it("explains a blocked permission instead of offering a dead button", async () => {
    pushPermission.mockReturnValue("denied");
    render(<PushToggle />);

    expect(await screen.findByText(/blocked for this site/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /turn on/i })).not.toBeInTheDocument();
  });

  it("tells iPhone users what to do rather than just failing", async () => {
    pushSupported.mockReturnValue(false);
    render(<PushToggle />);
    expect(await screen.findByText(/home screen/i)).toBeInTheDocument();
  });

  it("hides the control when the server has no keys", async () => {
    pushConfig.mockResolvedValue({ enabled: false, key: null });
    render(<PushToggle />);

    expect(await screen.findByText(/aren.t set up on this server/i)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("falls back to blocked when the prompt is refused mid-flight", async () => {
    // The browser state changed underneath us; re-read it rather than assume.
    enablePush.mockRejectedValue(new Error("Notifications are blocked for this site."));
    pushPermission.mockReturnValueOnce("default").mockReturnValue("denied");
    render(<PushToggle />);

    await userEvent.click(await screen.findByRole("button", { name: /turn on/i }));
    expect(await screen.findByText(/blocked for this site/i)).toBeInTheDocument();
  });

  it("turns off again", async () => {
    currentSubscription.mockResolvedValue({ endpoint: "e" });
    disablePush.mockResolvedValue(true);
    render(<PushToggle />);

    await userEvent.click(await screen.findByRole("button", { name: /turn off/i }));
    await waitFor(() => expect(disablePush).toHaveBeenCalled());
    expect(await screen.findByRole("button", { name: /turn on/i })).toBeInTheDocument();
  });
});

describe("the test button", () => {
  beforeEach(() => {
    pushSupported.mockReturnValue(true);
    pushPermission.mockReturnValue("granted");
    pushConfig.mockResolvedValue({ enabled: true, key: "k" });
    currentSubscription.mockResolvedValue({ endpoint: "e" });
  });

  it("is offered only once notifications are on", async () => {
    currentSubscription.mockResolvedValue(null);
    render(<PushToggle />);
    await screen.findByRole("button", { name: /turn on/i });
    expect(screen.queryByRole("button", { name: /send a test/i })).toBeNull();
  });

  it("rings this device and says so", async () => {
    sendTestPush.mockResolvedValue(1);
    render(<PushToggle />);
    await userEvent.click(await screen.findByRole("button", { name: /send a test/i }));
    await waitFor(() => expect(sendTestPush).toHaveBeenCalled());
    expect(await screen.findByRole("status")).toHaveTextContent(/should appear/i);
  });

  it("admits when there is nothing registered to ring", async () => {
    // The failure this button exists to catch: the browser thinks it is
    // subscribed, the server has no row, and everything else looks fine.
    sendTestPush.mockResolvedValue(0);
    render(<PushToggle />);
    await userEvent.click(await screen.findByRole("button", { name: /send a test/i }));
    expect(await screen.findByRole("status")).toHaveTextContent(/isn't registered/i);
  });

  it("reports a refusal from the server", async () => {
    sendTestPush.mockRejectedValue(new Error("Too many tests just now."));
    render(<PushToggle />);
    await userEvent.click(await screen.findByRole("button", { name: /send a test/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/too many tests/i);
  });
});
