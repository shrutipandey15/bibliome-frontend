import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../../services/api", () => ({
  createCollection: vi.fn(), deleteCollection: vi.fn(),
  addCollectionItem: vi.fn(), removeCollectionItem: vi.fn(), reorderCollection: vi.fn(),
  // The drawer now carries the sharing panel [#5], which reads members and the
  // viewer. Stubbed to an empty list so these tests stay about the editor.
  getCollectionMembers: vi.fn().mockResolvedValue([]),
  createCollectionInvite: vi.fn(), revokeCollectionInvite: vi.fn(), leaveCollection: vi.fn(),
}));

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "me" } }),
}));

import CollectionsEditor from "./CollectionsEditor";
import { createCollection, addCollectionItem, reorderCollection, deleteCollection } from "../../services/api";

const shelf = [
  { id: "e1", title: "Piranesi", author: "Susanna Clarke" },
  { id: "e2", title: "The Employees", author: "Olga Ravn" },
];

const ordered = [{
  id: "c1", title: "Ordered", visibility: "private", position: 0,
  books: [
    { entry_id: "e1", title: "First", dominant_emotion: "grief" },
    { entry_id: "e2", title: "Second", dominant_emotion: "awe" },
  ],
}];

describe("CollectionsEditor [F2.8]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a new collection", async () => {
    createCollection.mockResolvedValue({ id: "c1" });
    const onChanged = vi.fn().mockResolvedValue();
    render(<CollectionsEditor collections={[]} shelf={shelf} onChanged={onChanged} />);

    await userEvent.click(screen.getByRole("button", { name: /start a shelf/i }));
    await userEvent.type(screen.getByLabelText(/collection name/i), "books that ruined me");
    await userEvent.click(screen.getByRole("button", { name: /^create$/i }));

    expect(createCollection).toHaveBeenCalledWith({
      title: "books that ruined me", description: null, visibility: "private",
    });
    expect(onChanged).toHaveBeenCalled();
  });

  it("adds a book from the shelf, via the card's drawer", async () => {
    addCollectionItem.mockResolvedValue();
    const onChanged = vi.fn().mockResolvedValue();
    const collections = [{ id: "c1", title: "Comfort reads", visibility: "private", position: 0, books: [] }];
    render(<CollectionsEditor collections={collections} shelf={shelf} onChanged={onChanged} />);

    await userEvent.click(screen.getByRole("button", { name: /Comfort reads/i }));
    await userEvent.click(screen.getByLabelText(/choose a book from your shelf/i));
    await userEvent.click(screen.getByRole("option", { name: /Piranesi/i }));
    await userEvent.click(screen.getByRole("button", { name: /^add$/i }));

    expect(addCollectionItem).toHaveBeenCalledWith("c1", "e1");
  });

  it("searches the shelf from inside the picker, by title or author", async () => {
    addCollectionItem.mockResolvedValue();
    const onChanged = vi.fn().mockResolvedValue();
    const collections = [{ id: "c1", title: "Comfort reads", visibility: "private", position: 0, books: [] }];
    render(<CollectionsEditor collections={collections} shelf={shelf} onChanged={onChanged} />);

    await userEvent.click(screen.getByRole("button", { name: /Comfort reads/i }));
    await userEvent.click(screen.getByLabelText(/choose a book from your shelf/i));
    expect(screen.getAllByRole("option")).toHaveLength(2);

    // Author, not title — the field matches both.
    await userEvent.type(screen.getByLabelText(/search your shelf/i), "ravn");
    const only = screen.getAllByRole("option");
    expect(only).toHaveLength(1);
    expect(only[0]).toHaveAccessibleName(/The Employees/i);

    // Enter takes the highlighted match without touching the mouse, and the
    // choice shows on the closed trigger.
    await userEvent.keyboard("{Enter}");
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/choose a book from your shelf/i)).toHaveTextContent(/The Employees/i);

    await userEvent.click(screen.getByRole("button", { name: /^add$/i }));
    expect(addCollectionItem).toHaveBeenCalledWith("c1", "e2");
  });

  it("says so when nothing matches, rather than showing an empty list", async () => {
    const collections = [{ id: "c1", title: "Comfort reads", visibility: "private", position: 0, books: [] }];
    render(<CollectionsEditor collections={collections} shelf={shelf} onChanged={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /Comfort reads/i }));
    await userEvent.click(screen.getByLabelText(/choose a book from your shelf/i));
    await userEvent.type(screen.getByLabelText(/search your shelf/i), "zzzz");

    expect(screen.queryByRole("option")).not.toBeInTheDocument();
    expect(screen.getByText(/nothing matches/i)).toBeInTheDocument();
  });

  it("reorders books with keyboard-operable up/down (not drag-only) [a11y]", async () => {
    reorderCollection.mockResolvedValue();
    const onChanged = vi.fn().mockResolvedValue();
    render(<CollectionsEditor collections={ordered} shelf={shelf} onChanged={onChanged} />);

    await userEvent.click(screen.getByRole("button", { name: /Ordered/i }));
    await userEvent.click(screen.getByRole("button", { name: /move Second up/i }));
    expect(reorderCollection).toHaveBeenCalledWith("c1", ["e2", "e1"]);
  });

  it("the card is a single control — the grid has no nested buttons", async () => {
    render(<CollectionsEditor collections={ordered} shelf={shelf} onChanged={vi.fn()} />);
    const card = screen.getByRole("button", { name: /Ordered/i });
    expect(card.querySelector("button")).toBeNull();
    // The count and who-can-see-it are on the card, not hidden in the drawer.
    expect(card).toHaveAccessibleName(/2 volumes, private/i);
  });

  it("asks before deleting a collection", async () => {
    deleteCollection.mockResolvedValue();
    const onChanged = vi.fn().mockResolvedValue();
    render(<CollectionsEditor collections={ordered} shelf={shelf} onChanged={onChanged} />);

    await userEvent.click(screen.getByRole("button", { name: /Ordered/i }));
    await userEvent.click(screen.getByRole("button", { name: /delete collection/i }));
    expect(deleteCollection).not.toHaveBeenCalled();  // one click is not enough

    await userEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    expect(deleteCollection).toHaveBeenCalledWith("c1");
  });

  it("offers the rest rather than scrolling once the grid is full", async () => {
    const many = Array.from({ length: 9 }, (_, i) => ({
      id: `c${i}`, title: `Shelf ${i}`, visibility: "private", position: i, books: [],
    }));
    render(<CollectionsEditor collections={many} shelf={shelf} onChanged={vi.fn()} />);

    expect(screen.queryByRole("button", { name: /Shelf 7/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /all 9 collections/i }));
    expect(screen.getByRole("button", { name: /Shelf 7/i })).toBeInTheDocument();
  });
});
