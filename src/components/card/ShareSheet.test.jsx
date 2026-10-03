import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import { GRIEF } from "./testCards";

const api = {
  getDNAProfile: vi.fn(),
  getShareToken: vi.fn(),
  generateShareToken: vi.fn(),
  revokeShareTokens: vi.fn(),
  updateSettings: vi.fn(),
  countShare: vi.fn(),
};
vi.mock("../../services/api", () => ({
  getDNAProfile: (...a) => api.getDNAProfile(...a),
  getShareToken: (...a) => api.getShareToken(...a),
  generateShareToken: (...a) => api.generateShareToken(...a),
  revokeShareTokens: (...a) => api.revokeShareTokens(...a),
  updateSettings: (...a) => api.updateSettings(...a),
  countShare: (...a) => api.countShare(...a),
}));

let releaseRender = null;
const renderCard = vi.fn();
vi.mock("./renderCard", () => ({ renderCard: (...a) => renderCard(...a) }));

import ShareSheet, { isAndroidInApp } from "./ShareSheet";

const OWNER = { ...GRIEF, choices: { season: true, red_flag: true } };
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1";
const IG_ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36 Instagram 300.0";
const FIREFOX = "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0";

function setBrowser({ ua = IPHONE, share = true, files = true, online = true } = {}) {
  Object.defineProperty(navigator, "userAgent", { value: ua, configurable: true });
  Object.defineProperty(navigator, "onLine", { value: online, configurable: true });
  Object.defineProperty(navigator, "share", { value: share ? vi.fn(() => Promise.resolve()) : undefined, configurable: true });
  Object.defineProperty(navigator, "canShare", { value: share && files ? vi.fn(() => true) : undefined, configurable: true });
  Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn(() => Promise.resolve()) }, configurable: true });
}

async function open(props = {}) {
  let utils;
  await act(async () => { utils = render(<ShareSheet onClose={() => {}} card={OWNER} {...props} />); });
  return utils;
}

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  api.getDNAProfile.mockResolvedValue({ card: OWNER, seasons: [{}, {}] });
  api.getShareToken.mockResolvedValue({ share_token: "tok", off: false });
  api.generateShareToken.mockResolvedValue({ share_token: "new" });
  api.revokeShareTokens.mockResolvedValue();
  api.updateSettings.mockResolvedValue({});
  renderCard.mockReset();
  renderCard.mockImplementation(() => Promise.resolve(new Blob(["png"], { type: "image/png" })));
  window.scrollTo = vi.fn();      // <Modal>'s scroll lock; jsdom has no layout
  URL.createObjectURL = vi.fn(() => "blob:card");
  URL.revokeObjectURL = vi.fn();
  setBrowser();
});

afterEach(() => { releaseRender = null; });

describe("ShareSheet", () => {
  it("fetches the fresh card first, then draws the story before any tap", async () => {
    api.getDNAProfile.mockResolvedValue({ card: { ...OWNER, tagged_count: 99 }, seasons: [] });
    await open();
    await waitFor(() => expect(renderCard).toHaveBeenCalled());
    const [format, card] = renderCard.mock.calls[0];
    expect(format).toBe("story");
    expect(card.tagged_count).toBe(99);
    expect(await screen.findByRole("img", { name: /preview of your story/i })).toBeInTheDocument();
  });

  it("hands the image to the system share sheet with the card's words (iOS / Android Chrome)", async () => {
    await open();
    const btn = await screen.findByRole("button", { name: "Share" });
    await waitFor(() => expect(btn).toBeEnabled());
    await act(async () => { fireEvent.click(btn); });
    expect(navigator.share).toHaveBeenCalledTimes(1);
    const arg = navigator.share.mock.calls[0][0];
    expect(arg.files[0]).toBeInstanceOf(File);
    expect(arg.files[0].type).toBe("image/png");
    expect(arg.text).toBe("I'm a Grief Romantic. What's yours? bibliome.app/s/tok");
    await waitFor(() => expect(api.countShare).toHaveBeenCalledWith("story"));
  });

  it("says Preparing… and stays disabled until the image exists", async () => {
    renderCard.mockImplementation(() => new Promise((res) => { releaseRender = res; }));
    await open();
    const btn = await screen.findByRole("button", { name: "Preparing…" });
    expect(btn).toBeDisabled();
    await act(async () => { releaseRender(new Blob(["png"], { type: "image/png" })); });
    expect(await screen.findByRole("button", { name: "Share" })).toBeEnabled();
  });

  it("does nothing when the reader cancels", async () => {
    navigator.share.mockImplementation(() => Promise.reject(Object.assign(new Error("x"), { name: "AbortError" })));
    await open();
    const btn = await screen.findByRole("button", { name: "Share" });
    await waitFor(() => expect(btn).toBeEnabled());
    await act(async () => { fireEvent.click(btn); });
    expect(api.countShare).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("offers Save image and Copy link where files can't be shared (Firefox, desktops)", async () => {
    setBrowser({ ua: FIREFOX, share: false });
    await open();
    await screen.findByRole("img", { name: /preview of your story/i });
    expect(screen.queryByRole("button", { name: "Share" })).toBeNull();
    expect(screen.getByRole("button", { name: "Save image" })).toBeEnabled();
    await waitFor(() => expect(screen.getByRole("button", { name: "Copy link" })).toBeEnabled());
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Copy link" })); });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("https://bibliome.app/s/tok");
    expect(api.countShare).toHaveBeenCalledWith("link");
  });

  it("tells Android in-app browsers to open Chrome, and still copies the link", async () => {
    setBrowser({ ua: IG_ANDROID });
    expect(isAndroidInApp(IG_ANDROID)).toBe(true);
    expect(isAndroidInApp(IPHONE)).toBe(false);
    await open();
    expect(await screen.findByText(/open in chrome to share the image/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Share" })).toBeNull();
    await waitFor(() => expect(screen.getByRole("button", { name: "Copy link" })).toBeEnabled());
  });

  it("says when the reader is offline, and still lets them save", async () => {
    setBrowser({ online: false });
    await open();
    expect(await screen.findByText(/you're offline/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Save image" })).toBeEnabled());
  });

  it("remembers a switch and redraws without it", async () => {
    await open();
    await waitFor(() => expect(renderCard).toHaveBeenCalled());
    await act(async () => { fireEvent.click(screen.getByRole("checkbox", { name: "My red flag" })); });
    expect(api.updateSettings).toHaveBeenCalledWith({ card_show_red_flag: false });
    await waitFor(() => {
      const last = renderCard.mock.calls.at(-1)[1];
      expect(last.choices.red_flag).toBe(false);
    });
  });

  it("offers the season story while a season is on, and drops it when switched off", async () => {
    await open();
    expect(await screen.findByRole("radio", { name: "Season story" })).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole("radio", { name: "Season story" })); });
    await waitFor(() => expect(renderCard.mock.calls.at(-1)[0]).toBe("season"));
    await act(async () => { fireEvent.click(screen.getByRole("checkbox", { name: "My current season" })); });
    await waitFor(() => expect(screen.queryByRole("radio", { name: "Season story" })).toBeNull());
    expect(screen.getByRole("radio", { name: "Story" })).toBeChecked();
  });

  it("reuses the one card link, and only makes one when there is none", async () => {
    await open();
    await waitFor(() => expect(api.getShareToken).toHaveBeenCalled());
    expect(api.generateShareToken).not.toHaveBeenCalled();
    expect(await screen.findByText("bibliome.app/s/tok")).toBeInTheDocument();
  });

  it("turns the link off, and doesn't quietly make a new one next time", async () => {
    const first = await open();
    await screen.findByText("bibliome.app/s/tok");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Turn off my card link" })); });
    expect(api.revokeShareTokens).toHaveBeenCalled();
    expect(screen.getByText("Your card link is off.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy link" })).toBeDisabled();
    first.unmount();

    // "Off" comes back from the account, so a second device behaves the same.
    api.getShareToken.mockResolvedValue({ share_token: null, off: true });
    await open();
    await waitFor(() => expect(api.getShareToken).toHaveBeenCalledTimes(2));
    expect(api.generateShareToken).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Make a new link" })); });
    expect(api.generateShareToken).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("bibliome.app/s/new")).toBeInTheDocument();
  });

  it("makes the link the first time a reader shares", async () => {
    api.getShareToken.mockResolvedValue({ share_token: null, off: false });
    await open();
    await waitFor(() => expect(api.generateShareToken).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("bibliome.app/s/new")).toBeInTheDocument();
  });

  it("saves switches one at a time, in order, and hands them back on close", async () => {
    const order = [];
    let release;
    api.updateSettings.mockImplementationOnce((b) => new Promise((r) => { release = () => { order.push(b); r({}); }; }));
    api.updateSettings.mockImplementation((b) => { order.push(b); return Promise.resolve({}); });
    const onClose = vi.fn();
    await open({ onClose });
    await screen.findByRole("checkbox", { name: "My red flag" });
    await act(async () => { fireEvent.click(screen.getByRole("checkbox", { name: "My red flag" })); });
    await act(async () => { fireEvent.click(screen.getByRole("checkbox", { name: "My current season" })); });
    expect(order).toEqual([]);
    await act(async () => { release(); });
    await waitFor(() => expect(order).toEqual([{ card_show_red_flag: false }, { card_show_season: false }]));
    await act(async () => { fireEvent.keyDown(document.querySelector(".modal-card"), { key: "Escape" }); });
    expect(onClose).toHaveBeenCalledWith({ season: false, red_flag: false });
  });

  it("falls back to the page's card when the fresh fetch fails", async () => {
    api.getDNAProfile.mockRejectedValue(new Error("offline"));
    await open();
    await waitFor(() => expect(renderCard).toHaveBeenCalled());
    expect(renderCard.mock.calls[0][1].archetype.id).toBe("grief_romantic");
  });
});
