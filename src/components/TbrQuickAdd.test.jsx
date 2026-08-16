import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../services/api", () => ({ searchBooks: vi.fn() }));

import TbrQuickAdd from "./TbrQuickAdd";
import { searchBooks } from "../services/api";
import { JournalContext } from "../contexts/JournalContext";

const BOOK = { title: "Piranesi", author: "Susanna Clarke", cover_url: null, isbn: null };

function renderWith({ shelveBook = vi.fn().mockResolvedValue(true), entries = [] } = {}) {
  render(
    <JournalContext.Provider value={{ entries, shelveBook }}>
      <TbrQuickAdd onClose={vi.fn()} />
    </JournalContext.Provider>
  );
  return { shelveBook };
}

async function search(term = "piranesi") {
  await userEvent.type(screen.getByLabelText(/search books/i), term);
  return waitFor(() => screen.getByText("Piranesi"), { timeout: 3000 });
}

describe("TbrQuickAdd [B2.2 — TBR fast-add]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchBooks.mockResolvedValue([BOOK]);
  });

  it("shelves in one tap, with no form to fill in", async () => {
    const { shelveBook } = renderWith();
    await search();

    await userEvent.click(screen.getByRole("button", { name: /piranesi/i }));

    await waitFor(() => expect(shelveBook).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Piranesi", author: "Susanna Clarke" })
    ));
    // The whole point of the feature: no intensity, no emotions, no save step.
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^save$/i })).not.toBeInTheDocument();
  });

  it("stays open after an add, so shelving three books is one search", async () => {
    renderWith();
    await search();
    await userEvent.click(screen.getByRole("button", { name: /piranesi/i }));

    await screen.findByText(/on your list/i);
    expect(screen.getByLabelText(/search books/i)).toBeInTheDocument();
  });

  it("says 'already there' rather than falsely confirming an add", async () => {
    // The server reports created:false for a book already on the shelf; the row
    // must reflect that instead of claiming a new add.
    renderWith({ shelveBook: vi.fn().mockResolvedValue(false) });
    await search();
    await userEvent.click(screen.getByRole("button", { name: /piranesi/i }));

    expect(await screen.findByText(/already there/i)).toBeInTheDocument();
    expect(screen.queryByText(/on your list/i)).not.toBeInTheDocument();
  });

  it("pre-marks a book already on the shelf before it is tapped", async () => {
    const { shelveBook } = renderWith({
      entries: [{ id: "1", title: "Piranesi", author: "Susanna Clarke", status: "finished" }],
    });
    await search();

    expect(screen.getByText(/already there/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /piranesi/i }));
    expect(shelveBook).not.toHaveBeenCalled();
  });

  it("does not fire twice when the row is tapped twice quickly", async () => {
    // A one-tap surface invites double taps; the guard is here as well as on the
    // server so the second tap never becomes a second request.
    let resolve;
    const shelveBook = vi.fn(() => new Promise((r) => { resolve = r; }));
    renderWith({ shelveBook });
    await search();

    const row = screen.getByRole("button", { name: /piranesi/i });
    await userEvent.click(row);
    await userEvent.click(row);
    resolve(true);

    await waitFor(() => expect(shelveBook).toHaveBeenCalledTimes(1));
  });

  it("surfaces a failure instead of pretending the book was shelved", async () => {
    renderWith({ shelveBook: vi.fn().mockRejectedValue(new Error("offline")) });
    await search();
    await userEvent.click(screen.getByRole("button", { name: /piranesi/i }));

    expect(await screen.findByText(/try again/i)).toBeInTheDocument();
  });
});
