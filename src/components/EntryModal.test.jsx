import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Book search is network — stub it so the modal renders offline.
vi.mock("../services/api", () => ({ searchBooks: vi.fn().mockResolvedValue([]) }));

import EntryModal, {
  DNF_OPTIONS, STATUS_OPTIONS, DNF_STATUSES, PROGRESS_STATUSES, VERDICT_OPTIONS, VERDICT_REASON_OPTIONS,
} from "./EntryModal";

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

  it("renders the six family doors and reveals emotions only on tap", async () => {
    render(<EntryModal entry={base()} onSave={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()} />);
    // Family doors present.
    for (const fam of ["it broke me", "it hooked me", "it held me", "it lit me up", "it got my heart", "it opened my eyes"]) {
      expect(screen.getByRole("button", { name: new RegExp(fam, "i") })).toBeInTheDocument();
    }
    expect(screen.queryByRole("button", { name: /it lost me/i })).not.toBeInTheDocument();
    // Emotions inside a family are hidden until the door is tapped. Chips show the
    // human phrase, never the word/slug.
    expect(screen.queryByRole("button", { name: "I cried and felt lighter" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /it broke me/i }));
    expect(screen.getByRole("button", { name: "I cried and felt lighter" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "it broke my heart" })).toBeInTheDocument();
    // Every family ends in an honest way out.
    expect(screen.getByRole("button", { name: "something else…" })).toBeInTheDocument();
  });

  it("saves the reader's own words from \"something else…\"", async () => {
    const onSave = vi.fn();
    render(<EntryModal entry={base()} onSave={onSave} onDelete={vi.fn()} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /it held me/i }));
    await userEvent.click(screen.getByRole("button", { name: "something else…" }));
    const box = screen.getByLabelText("something else, in your own words");
    expect(box).toHaveAttribute("maxLength", "80");
    await userEvent.type(box, "  quietly proud of her  ");
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));
    expect(onSave.mock.calls[0][0].other_feeling).toBe("quietly proud of her");
  });

  it("saves two emotions at independent strengths", async () => {
    const onSave = vi.fn();
    render(<EntryModal entry={base()} onSave={onSave} onDelete={vi.fn()} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /it broke me/i }));
    await userEvent.click(screen.getByRole("button", { name: "I cried and felt lighter" }));
    await userEvent.click(screen.getByRole("button", { name: "it broke my heart" }));
    fireEvent.change(screen.getByLabelText("I cried and felt lighter strength"), { target: { value: "9" } });
    fireEvent.change(screen.getByLabelText("it broke my heart strength"), { target: { value: "2" } });
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

    expect(onSave.mock.calls[0][0].emotions).toEqual(
      expect.arrayContaining([
        { emotion_id: "catharsis", strength: 9 },
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
    expect(screen.getByLabelText("it broke my heart strength")).toHaveValue("3");
    expect(screen.getByLabelText("what happened made me furious strength")).toHaveValue("8");
  });

  it("saves the verdict and leaves dnf_reason null on a non-abandoned book", async () => {
    const onSave = vi.fn();
    render(<EntryModal entry={base()} onSave={onSave} onDelete={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByText(/put it down/i)).not.toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "how did it land?" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "loved it" }));
    // A book that landed is never asked what went wrong.
    expect(screen.queryByRole("radiogroup", { name: /what went wrong/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));
    expect(onSave.mock.calls[0][0]).toMatchObject({ verdict: "loved", verdict_reason: null, dnf_reason: null });
  });

  it("asks what went wrong only after mixed or not for me, and saves it", async () => {
    const onSave = vi.fn();
    render(<EntryModal entry={base()} onSave={onSave} onDelete={vi.fn()} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole("radio", { name: "not for me" }));
    await userEvent.click(screen.getByRole("radio", { name: "overhyped" }));
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));
    expect(onSave.mock.calls[0][0]).toMatchObject({ verdict: "not_for_me", verdict_reason: "overhyped" });
  });

  it("drops the verdict for a book that was never finished", async () => {
    const onSave = vi.fn();
    render(
      <EntryModal
        entry={base({ status: "reading", verdict: "liked", verdict_reason: "overhyped" })}
        onSave={onSave} onDelete={vi.fn()} onClose={vi.fn()}
      />,
    );
    expect(screen.queryByRole("radiogroup", { name: "how did it land?" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));
    expect(onSave.mock.calls[0][0]).toMatchObject({ verdict: null, verdict_reason: null });
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

// ── DNF reasons: fixed vocabulary, not free text [B2.3 / #3] ──

describe("DNF reason vocabulary", () => {
  it("matches the backend's DnfReason literal exactly", () => {
    // Re-typed on this side, so it can drift. The backend has the mirror of this
    // assertion (test_dnf_reason_vocabulary_matches_the_client); if you change
    // one list, both tests fail and point at each other.
    expect(DNF_OPTIONS.map((o) => o.value)).toEqual([
      "bored", "too_much", "badly_written", "wrong_time", "lost_me", "drifted",
    ]);
  });

  it("offers every reason as a tap, with no free-text way in", () => {
    // The whole point of the axis: a fixed vocabulary is countable, so
    // abandonment() can say "5 bored you, 1 scared you". Free text cannot be
    // counted, and one stray "boring" would silently drop out of the tally.
    DNF_OPTIONS.forEach((o) => {
      expect(o.label).toBeTruthy();
      expect(o.value).toMatch(/^[a-z_]+$/);
    });
  });
});

// ── "How did it land?": mirrors the backend's Verdict / VerdictReason literals ──

describe("verdict vocabulary [v3]", () => {
  it("matches the backend's Verdict and VerdictReason literals exactly", () => {
    // app/utils/emotions.py VERDICTS / VERDICT_REASONS. A value offered here
    // and missing there is a 422 the reader can do nothing about.
    expect(VERDICT_OPTIONS.map((o) => o.value)).toEqual(["loved", "liked", "mixed", "not_for_me"]);
    expect(VERDICT_REASON_OPTIONS.map((o) => o.value)).toEqual([
      "ending_let_me_down", "overhyped", "didnt_connect", "badly_written", "forgettable",
    ]);
  });
});

// ── Reading status: the UI must offer every status the API accepts ──

describe("reading status vocabulary", () => {
  it("offers all six statuses, not the original three", () => {
    // The API has stored six since migration 022 while this list offered three,
    // so a reader could not say a book was abandoned — which in turn meant the
    // DNF reason axis and every abandonment insight were unreachable from the UI.
    expect(STATUS_OPTIONS.map((o) => o.value)).toEqual([
      "want_to_read", "reading", "paused", "abandoned", "finished", "reread",
    ]);
  });

  it("asks why on both ways of stopping", () => {
    // The backend's DNF tally counts `paused` as put-down, so asking only on
    // `abandoned` would leave half the pile permanently unexplained.
    expect(DNF_STATUSES).toEqual(["abandoned", "paused"]);
  });

  it("only asks how-far-in on a book that is still open", () => {
    expect(PROGRESS_STATUSES).toEqual(["reading", "paused"]);
    expect(PROGRESS_STATUSES).not.toContain("finished");
    expect(PROGRESS_STATUSES).not.toContain("abandoned");
  });
});
