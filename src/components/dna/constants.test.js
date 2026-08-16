import { describe, it, expect } from "vitest";
import { OPENED_STATUSES, openedBooks } from "./constants";

const book = (status) => ({ id: status, title: status, status });

// The Read / To Read toggle shows two lists derived from this one rule. There is
// no stored "to read list" to keep in sync — which list a book appears in is a
// function of its status, and nothing else.
describe("openedBooks — the Read / To Read split [B2.2]", () => {
  it("puts only want_to_read behind the To Read tab", () => {
    const all = [...OPENED_STATUSES, "want_to_read"].map(book);
    const opened = openedBooks(all).map((e) => e.status);

    expect(opened).toEqual(OPENED_STATUSES);
    expect(opened).not.toContain("want_to_read");
  });

  it("moves a book out of To Read and into the Stacks when it is filled in", () => {
    // The crossover: filling a to-read book in EntryModal changes its status,
    // and that alone moves it. It leaves To Read in the same render it joins
    // The Stacks, because both lists read the same field.
    const shelved = book("want_to_read");
    const pile = (list) => list.filter((e) => e.status === "want_to_read");

    expect(openedBooks([shelved])).toHaveLength(0);
    expect(pile([shelved])).toHaveLength(1);

    const read = { ...shelved, status: "finished" };
    expect(openedBooks([read])).toHaveLength(1);
    expect(pile([read])).toHaveLength(0);
  });

  it("counts a book once — it can never sit in both lists", () => {
    const all = [...OPENED_STATUSES, "want_to_read"].map(book);
    const inRead = openedBooks(all).length;
    const inPile = all.filter((e) => e.status === "want_to_read").length;

    expect(inRead + inPile).toBe(all.length);
  });

  it("treats a missing status as read, not as To Read", () => {
    // Older entries predate the status column and default to finished
    // server-side. Defaulting them into the pile would empty a reader's shelf.
    expect(openedBooks([{ id: "x", title: "Old" }])).toHaveLength(1);
  });

  it("tolerates a null entry list", () => {
    expect(openedBooks(null)).toEqual([]);
  });
});
