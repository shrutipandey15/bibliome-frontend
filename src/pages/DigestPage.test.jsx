import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";

vi.mock("../services/api", () => ({
  getDigest: vi.fn(),
  recordDigestClick: vi.fn(),
}));

vi.mock("../components/ThemeToggle", () => ({ default: () => null }));

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { username: "ada", display_name: "Ada" } }),
}));

const editEntry = vi.fn();
vi.mock("../contexts/JournalContext", () => ({
  useJournal: () => ({
    editEntry,
    entries: [
      { id: "e1", title: "Piranesi", status: "finished", emotions: [{ emotion_id: "grief", strength: 7 }] },
      { id: "e2", title: "Already Awed", status: "finished", emotions: [{ emotion_id: "awe", strength: 5 }] },
      { id: "e3", title: "Someday", status: "want_to_read", emotions: [] },
    ],
  }),
}));

import DigestPage from "./DigestPage";
import { getDigest, recordDigestClick } from "../services/api";

const DIGEST = {
  period: "2026-41",
  subject: "Something you wrote six weeks ago",
  intro: null,
  sections: [
    { kind: "past_self", title: "a line from your past self", body: "Six weeks ago you wrote something about Piranesi.",
      link: "/digest/2026-41#past_self", data: { entry_id: "e1", book: "Piranesi" },
      reveal: { note: "the statues in the rain", finish_thought: null } },
    { kind: "emotion_of_week", title: "feeling of the week", body: "Awe is big.\nWhich book on your shelf gave you this?",
      link: "/digest/2026-41#emotion_of_week", data: { emotion: "awe" } },
    { kind: "drift", title: "the drift", body: "You've been leaning slightly more toward awe.", link: "/?view=dna", data: {} },
  ],
  action: { label: "Tag one book with awe", link: "/digest/2026-41#emotion_of_week" },
};

function renderAt(path, element, route) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes><Route path={route} element={element} /></Routes>
    </MemoryRouter>
  );
}

describe("DigestPage", () => {
  beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); editEntry.mockResolvedValue({}); });

  it("reveals what the email held back: the note itself", async () => {
    getDigest.mockResolvedValue(DIGEST);
    renderAt("/digest/2026-41", <DigestPage />, "/digest/:period");
    expect(await screen.findByText("the statues in the rain")).toBeInTheDocument();
    expect(screen.getByText("How does it feel now?")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /see your dna/i })).toHaveAttribute("href", "/?view=dna");
    expect(recordDigestClick).toHaveBeenCalledWith("2026-41", "open");
    expect(screen.getByText("for Ada")).toBeInTheDocument();
    // "In this issue" lists every section, numbered, as jump links.
    const toc = screen.getByRole("navigation", { name: /in this issue/i });
    expect([...toc.querySelectorAll("a")].map((a) => a.getAttribute("href")))
      .toEqual(["#past_self", "#emotion_of_week", "#drift"]);
  });

  it("counts a tap through a section", async () => {
    getDigest.mockResolvedValue(DIGEST);
    renderAt("/digest/2026-41", <DigestPage />, "/digest/:period");
    await userEvent.click(await screen.findByRole("link", { name: /see your dna/i }));
    expect(recordDigestClick).toHaveBeenCalledWith("2026-41", "drift");
  });

  it("tags a book with the feeling of the week in one tap, keeping its other feelings", async () => {
    getDigest.mockResolvedValue(DIGEST);
    renderAt("/digest/2026-41", <DigestPage />, "/digest/:period");
    // Not offered: a book already tagged with it, and an unopened to-read.
    await screen.findByText(/which book gave you/i);
    expect(screen.queryByRole("button", { name: "Already Awed" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Someday" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Piranesi" }));
    expect(editEntry).toHaveBeenCalledWith("e1", {
      emotions: [{ emotion_id: "grief", strength: 7 }, { emotion_id: "awe", strength: 6 }],
    });
    expect(await screen.findByText((_, el) => el?.tagName === "P" && el.textContent === "Tagged Piranesi with awe.")).toBeInTheDocument();
  });

  it("says so plainly when the week has no digest", async () => {
    getDigest.mockRejectedValue(new Error("404"));
    renderAt("/digest/1999-01", <DigestPage />, "/digest/:period");
    expect(await screen.findByText(/isn't here/i)).toBeInTheDocument();
  });
});

describe("DigestPage in the installed app", () => {
  beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });

  it("always offers a way back to the shelf", async () => {
    getDigest.mockResolvedValue(DIGEST);
    renderAt("/digest/2026-41", <DigestPage />, "/digest/:period");
    expect(await screen.findByRole("link", { name: /back to shelf/i })).toHaveAttribute("href", "/");
  });

  it("offline, shows the copy it kept from last time and says so", async () => {
    getDigest.mockResolvedValueOnce(DIGEST);
    const first = renderAt("/digest/2026-41", <DigestPage />, "/digest/:period");
    await screen.findByText("the statues in the rain");
    first.unmount();

    getDigest.mockRejectedValueOnce(Object.assign(new Error("net"), { kind: "offline" }));
    renderAt("/digest/2026-41", <DigestPage />, "/digest/:period");
    expect(await screen.findByText(/offline · showing the copy/i)).toBeInTheDocument();
    expect(screen.getByText("the statues in the rain")).toBeInTheDocument();
  });

  it("offline with nothing kept, says offline rather than 'not here'", async () => {
    getDigest.mockRejectedValueOnce(Object.assign(new Error("net"), { kind: "offline" }));
    renderAt("/digest/2026-41", <DigestPage />, "/digest/:period");
    expect(await screen.findByText(/you're offline/i)).toBeInTheDocument();
    expect(screen.queryByText(/isn't here/i)).toBeNull();
  });
});

describe("weekRange", () => {
  it("names the ISO week Monday to Sunday", async () => {
    const { weekRange } = await import("./DigestPage");
    expect(weekRange("2026-41")).toBe("5 – 11 October 2026");
    expect(weekRange("2026-44")).toBe("26 Oct – 1 Nov 2026");
    expect(weekRange("2027-01")).toBe("4 – 10 January 2027");
    expect(weekRange("nonsense")).toBeNull();
  });
});
