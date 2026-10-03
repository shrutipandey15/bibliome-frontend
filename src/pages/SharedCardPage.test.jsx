import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { GRIEF } from "../components/card/testCards";

let authedUser = null;
vi.mock("react-router-dom", () => ({
  useParams: () => ({ token: "tok" }),
  Link: ({ children, to, ...p }) => <a href={to} {...p}>{children}</a>,
}));
vi.mock("../contexts/AuthContext", () => ({ useAuth: () => ({ user: authedUser }) }));
vi.mock("../hooks/useHead", () => ({ useHead: vi.fn() }));
vi.mock("../services/api", () => ({ getSharedDNA: vi.fn() }));

import SharedCardPage from "./SharedCardPage";
import { getSharedDNA } from "../services/api";
import { useHead } from "../hooks/useHead";

describe("SharedCardPage — /s/:token", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authedUser = null;
  });

  it("shows the card and one way in, carrying only a 'card' marker into sign-up", async () => {
    getSharedDNA.mockResolvedValue({ handle: "shruti", ...GRIEF });
    render(<SharedCardPage />);
    expect(await screen.findByRole("heading", { level: 1, name: "Grief Romantic." })).toBeInTheDocument();
    expect(screen.getByText("@shruti shared their reading DNA.")).toBeInTheDocument();
    const cta = screen.getByRole("link", { name: "Find yours" });
    // The marker says where the visitor came from, never who sent them.
    expect(cta.getAttribute("href")).toBe("/login?mode=register&via=card");
    expect(cta.getAttribute("href")).not.toContain("tok");
    expect(cta.getAttribute("href")).not.toContain("shruti");
  });

  it("is noindex, and titled with the card", async () => {
    getSharedDNA.mockResolvedValue({ handle: "shruti", ...GRIEF });
    render(<SharedCardPage />);
    await screen.findByRole("heading", { level: 1 });
    const last = useHead.mock.calls.at(-1)[0];
    expect(last.robots).toBe("noindex, nofollow");
    expect(last.title).toBe("@shruti reads like a Grief Romantic — Bibliome");
  });

  it("says the card isn't available when the link is off", async () => {
    getSharedDNA.mockResolvedValue(null);
    render(<SharedCardPage />);
    expect(await screen.findByText("This card isn't available")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Find yours" })).toBeInTheDocument();
  });

  it("sends a signed-in reader to their own card instead", async () => {
    authedUser = { id: 1 };
    getSharedDNA.mockResolvedValue({ handle: "shruti", ...GRIEF });
    render(<SharedCardPage />);
    expect(await screen.findByRole("link", { name: "See yours" })).toHaveAttribute("href", "/");
  });

  it("shows nothing of the reader's profile beyond the card", async () => {
    getSharedDNA.mockResolvedValue({ handle: "shruti", ...GRIEF, season: null, red_flag: null });
    const { container } = render(<SharedCardPage />);
    await screen.findByRole("heading", { level: 1 });
    expect(container).not.toHaveTextContent(/red flag|season|now reading|collections/i);
  });
});
