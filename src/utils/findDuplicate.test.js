import { describe, it, expect } from "vitest";
import { findDuplicateEntry, authorsMatch, normalizeTitle, normalizeIsbn } from "./findDuplicate";

const shelf = [
  { id: "1", title: "Piranesi", author: "Susanna Clarke", isbn: "9781635575637" },
  { id: "2", title: "The Secret History", author: "Donna Tartt" },
  { id: "3", title: "Beloved", author: "Toni Morrison" },
];

const find = (candidate, opts) => findDuplicateEntry(shelf, candidate, opts);

describe("findDuplicateEntry — what counts as the same book", () => {
  it("matches on ISBN even when the title was typed differently", () => {
    const hit = find({ title: "Piranesi: A Novel", isbn: "978-1-63557-563-7" });
    expect(hit).toMatchObject({ entry: { id: "1" }, reason: "isbn" });
  });

  it("matches on title + author through case, accents, articles and 'Last, First'", () => {
    expect(find({ title: "  piranesi ", author: "SUSANNA CLARKE" })).toMatchObject({ reason: "title_author" });
    expect(find({ title: "the secret history", author: "Tartt, Donna" })).toMatchObject({ entry: { id: "2" } });
    // A leading article is noise; a surname alone is enough.
    expect(find({ title: "Secret History", author: "Tartt" })).toMatchObject({ entry: { id: "2" } });
  });

  it("does NOT match two different books that share a title", () => {
    // Same title, two named and different authors — genuinely different books.
    expect(find({ title: "Beloved", author: "Someone Else" })).toBeNull();
  });

  it("reports a title-only hit as the weaker 'title' when an author is missing", () => {
    // Worth asking about, but the copy must hedge — this may be a different book.
    expect(find({ title: "Beloved" })).toMatchObject({ entry: { id: "3" }, reason: "title" });
  });

  it("never flags the entry being edited as its own duplicate", () => {
    expect(find({ title: "Piranesi", author: "Susanna Clarke" }, { excludeId: "1" })).toBeNull();
  });

  it("ignores the optimistic row of a save already in flight", () => {
    const withTemp = [{ id: "temp-999", title: "Piranesi", author: "Susanna Clarke" }];
    expect(findDuplicateEntry(withTemp, { title: "Piranesi", author: "Susanna Clarke" })).toBeNull();
  });

  it("says nothing until there is a title to match on", () => {
    expect(find({ title: "" })).toBeNull();
    expect(find({ title: "   ", author: "Susanna Clarke" })).toBeNull();
  });

  it("prefers the ISBN match over a weaker title-only one", () => {
    const messy = [
      { id: "a", title: "Piranesi" },                              // title-only
      { id: "b", title: "Something Else", isbn: "9781635575637" }, // isbn
    ];
    expect(findDuplicateEntry(messy, { title: "Piranesi", isbn: "9781635575637" }))
      .toMatchObject({ entry: { id: "b" }, reason: "isbn" });
  });
});

describe("the normalisers", () => {
  it("strips leading articles but never subtitles", () => {
    expect(normalizeTitle("The Secret History")).toBe("secret history");
    // "Dune" and "Dune: Messiah" must stay different books.
    expect(normalizeTitle("Dune: Messiah")).not.toBe(normalizeTitle("Dune"));
  });

  it("only accepts a plausible ISBN length", () => {
    expect(normalizeIsbn("978-1-63557-563-7")).toBe("9781635575637");
    expect(normalizeIsbn("0-306-40615-X")).toBe("030640615X");
    expect(normalizeIsbn("12345")).toBe(""); // junk must not become a match key
  });

  it("treats a missing author as unknown, not as a match", () => {
    expect(authorsMatch("", "Susanna Clarke")).toBe(false);
    expect(authorsMatch("Susanna Clarke", "Susanna Clarke")).toBe(true);
  });
});
