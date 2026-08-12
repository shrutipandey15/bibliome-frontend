import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Book search is network — stub it so the modal renders offline.
vi.mock("../services/api", () => ({ searchBooks: vi.fn().mockResolvedValue([]) }));

import EntryModal from "./EntryModal";

describe("EntryModal full entry fields [F2.1 / B2.4]", () => {
  it("saves status, dates, and private notes in the payload", async () => {
    const onSave = vi.fn();
    const entry = {
      id: "abc",
      title: "Piranesi",
      author: "Susanna Clarke",
      status: "finished",
      started_at: "2026-01-01",
      finished_at: "2026-01-10",
      emotions: [],
    };
    render(<EntryModal entry={entry} onSave={onSave} onDelete={vi.fn()} onClose={vi.fn()} />);

    await userEvent.type(
      screen.getByPlaceholderText(/Just for you/i),
      "read it in one sitting",
    );
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const [payload, id] = onSave.mock.calls[0];
    expect(id).toBe("abc");
    expect(payload).toMatchObject({
      status: "finished",
      started_at: "2026-01-01",
      finished_at: "2026-01-10",
      notes: "read it in one sitting",
    });
  });

  it("does NOT expose a public-echo box that publishes to a global feed [P0-NEW-1]", () => {
    render(<EntryModal entry={{ id: "z", title: "X", emotions: [] }} onSave={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()} />);
    // The old "one-line verdict … for the world" textarea is gone.
    expect(screen.queryByText(/public echo/i)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/one-line verdict/i)).not.toBeInTheDocument();
  });

  it("save payload omits public_echo entirely", async () => {
    const onSave = vi.fn();
    render(<EntryModal entry={{ id: "z", title: "X", status: "finished", emotions: [] }} onSave={onSave} onDelete={vi.fn()} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));
    expect(onSave).toHaveBeenCalled();
    expect(onSave.mock.calls[0][0]).not.toHaveProperty("public_echo");
  });

  it("hides the date fields for a want-to-read book", async () => {
    const { container } = render(
      <EntryModal
        entry={{ id: "x", title: "Unread", status: "want_to_read", emotions: [] }}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole("radio", { name: /want to read/i })).toHaveAttribute("aria-checked", "true");
    // No date inputs while the book is unstarted.
    expect(container.querySelectorAll('input[type="date"]')).toHaveLength(0);
  });

  it("shows only the started date for a currently-reading book", async () => {
    const { container } = render(
      <EntryModal
        entry={{ id: "y", title: "Midway", status: "reading", emotions: [] }}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    // 'started' shows, 'finished' date does not (only one date input).
    await waitFor(() =>
      expect(container.querySelectorAll('input[type="date"]')).toHaveLength(1),
    );
    expect(screen.getByText("started")).toBeInTheDocument();
  });
});

describe("EntryModal new vocabulary + per-emotion intensity [Part A/B/C]", () => {
  const base = (over = {}) => ({ id: "a", title: "X", status: "finished", emotions: [], ...over });

  it("renders the five family doors and reveals emotions only on tap", async () => {
    render(<EntryModal entry={base()} onSave={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()} />);
    // Family doors present.
    expect(screen.getByRole("button", { name: /It hurt/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /It lost me/i })).toBeInTheDocument();
    // Emotions inside a family are hidden until the door is tapped. Chips show the
    // human phrase, never the word/slug.
    expect(screen.queryByRole("button", { name: "it wrecked me" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /It hurt/i }));
    expect(screen.getByRole("button", { name: "it wrecked me" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "it left a hole" })).toBeInTheDocument();
  });

  it("saves two emotions at independent strengths", async () => {
    const onSave = vi.fn();
    render(<EntryModal entry={base()} onSave={onSave} onDelete={vi.fn()} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /It hurt/i }));
    await userEvent.click(screen.getByRole("button", { name: "it wrecked me" }));
    await userEvent.click(screen.getByRole("button", { name: "it left a hole" }));
    fireEvent.change(screen.getByLabelText("it wrecked me strength"), { target: { value: "9" } });
    fireEvent.change(screen.getByLabelText("it left a hole strength"), { target: { value: "2" } });
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

    expect(onSave.mock.calls[0][0].emotions).toEqual(
      expect.arrayContaining([
        { emotion_id: "devastation", strength: 9 },
        { emotion_id: "grief", strength: 2 },
      ]),
    );
  });

  it("round-trips each emotion's strength from the entry on edit", () => {
    render(
      <EntryModal
        entry={base({ emotions: [{ emotion_id: "grief", strength: 3 }, { emotion_id: "rage", strength: 8 }] })}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("it left a hole strength")).toHaveValue("3");
    expect(screen.getByLabelText("I was so angry strength")).toHaveValue("8");
  });

  it("saves the verdict and leaves dnf_reason null on a non-abandoned book", async () => {
    const onSave = vi.fn();
    render(<EntryModal entry={base()} onSave={onSave} onDelete={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByText(/put it down/i)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "no" }));
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));
    expect(onSave.mock.calls[0][0]).toMatchObject({ verdict: "no", dnf_reason: null });
  });

  it("asks how far in only for an open book, and saves null until answered", async () => {
    const onSave = vi.fn();
    render(<EntryModal entry={base({ status: "finished" })} onSave={onSave} onDelete={vi.fn()} onClose={vi.fn()} />);
    // A finished book is not asked — its status is the answer.
    expect(screen.queryByLabelText(/roughly how far in/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("radio", { name: /^reading$/i }));
    expect(screen.getByText("not said")).toBeInTheDocument();  // never a default 0%
  });

  it("shows the DNF reason only when abandoned and saves it", async () => {
    const onSave = vi.fn();
    render(<EntryModal entry={base({ status: "abandoned" })} onSave={onSave} onDelete={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText(/put it down/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "just drifted" }));
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));
    expect(onSave.mock.calls[0][0]).toMatchObject({ dnf_reason: "drifted" });
  });
});

describe("EntryModal — already on your shelf", () => {
  const shelved = {
    id: "existing-1",
    title: "Piranesi",
    author: "Susanna Clarke",
    status: "finished",
    finished_at: "2026-01-12",
    emotions: [{ emotion_id: "awe", strength: 9 }],
  };
  // Stands in for App's memoised findDuplicateEntry over the live shelf.
  const finder = ({ title }) =>
    title.trim().toLowerCase() === "piranesi" ? { entry: shelved, reason: "title_author" } : null;

  it("says nothing until what's typed actually matches something", async () => {
    render(
      <EntryModal entry={null} onSave={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()} findDuplicate={finder} />,
    );
    expect(screen.queryByText(/already on your shelf/i)).toBeNull();
    expect(screen.getByRole("button", { name: /^shelve it$/i })).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText(/search for a book/i), "Piranesi");
    expect(await screen.findByText(/already on your shelf/i)).toBeInTheDocument();
  });

  it("shows what the shelved copy already holds, rather than just 'duplicate'", async () => {
    render(
      <EntryModal entry={null} onSave={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()} findDuplicate={finder} />,
    );
    await userEvent.type(screen.getByPlaceholderText(/search for a book/i), "Piranesi");
    const notice = (await screen.findByText(/already on your shelf/i)).closest(".em-dupe");
    expect(notice.textContent).toMatch(/finished/i);
    expect(notice.textContent).toMatch(/tagged awe/i);
  });

  it("offers the existing entry instead of the new one", async () => {
    const onOpenExisting = vi.fn();
    render(
      <EntryModal
        entry={null} onSave={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()}
        findDuplicate={finder} onOpenExisting={onOpenExisting}
      />,
    );
    await userEvent.type(screen.getByPlaceholderText(/search for a book/i), "Piranesi");
    await userEvent.click(await screen.findByRole("button", { name: /open that entry/i }));
    expect(onOpenExisting).toHaveBeenCalledWith(shelved);
  });

  it("still lets a reread through — it warns, it does not block", async () => {
    const onSave = vi.fn();
    render(
      <EntryModal entry={null} onSave={onSave} onDelete={vi.fn()} onClose={vi.fn()} findDuplicate={finder} />,
    );
    await userEvent.type(screen.getByPlaceholderText(/search for a book/i), "Piranesi");

    // The button states plainly what it is about to do; nothing is disabled.
    const save = await screen.findByRole("button", { name: /shelve it again/i });
    expect(save).toBeEnabled();
    await userEvent.click(save);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toMatchObject({ title: "Piranesi" });
  });

  it("never flags an entry being edited as a duplicate of itself", async () => {
    render(
      <EntryModal
        entry={shelved} onSave={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()}
        findDuplicate={() => ({ entry: shelved, reason: "title_author" })}
      />,
    );
    expect(screen.queryByText(/already on your shelf/i)).toBeNull();
    expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
  });
});
