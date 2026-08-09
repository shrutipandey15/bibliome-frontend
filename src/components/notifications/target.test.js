import { describe, it, expect } from "vitest";
import { notificationTarget } from "./target";

const n = (kind, payload = {}, tier = 1) => ({ id: "x", kind, payload, tier });

describe("notificationTarget — every notice lands somewhere real", () => {
  it("opens the exact echo that was replied to", () => {
    expect(notificationTarget(n("echo_reply", { echo_id: "e-42", book_title: "Piranesi" })))
      .toBe("/echoes?echo=e-42");
  });

  it("falls back to the feed when a reply notice has no echo id", () => {
    expect(notificationTarget(n("echo_reply", {}))).toBe("/echoes");
  });

  it("sends every resonance notice to the room, never to a card", () => {
    // The payloads carry ids, but the API withholds handle and book until both
    // readers say yes — so there is nothing honest to deep-link to.
    expect(notificationTarget(n("resonance_reach", { match_id: "m1" }))).toBe("/resonance");
    expect(notificationTarget(n("resonance_connected", { match_id: "m1", thread_id: "t1" }))).toBe("/resonance");
    expect(notificationTarget(n("resonance_message", { thread_id: "t1" }))).toBe("/resonance");
  });

  it("sends a DNA shift to the DNA tab and the digest to the shelf", () => {
    expect(notificationTarget(n("dna_shifted", { old: "A", new: "B" }))).toBe("/?view=dna");
    expect(notificationTarget(n("weekly_digest", { books_this_week: 3 }, 2))).toBe("/");
  });

  it("sends anything tier 0 to account security, whatever its kind", () => {
    expect(notificationTarget(n("password_reset", { message: "..." }, 0)))
      .toBe("/settings?section=security");
    expect(notificationTarget(n("some_future_security_kind", {}, 0)))
      .toBe("/settings?section=security");
  });

  it("returns null for an unknown kind rather than a button that goes nowhere", () => {
    expect(notificationTarget(n("mystery_kind"))).toBeNull();
    expect(notificationTarget(null)).toBeNull();
  });

  it("escapes the id it puts in the query string", () => {
    expect(notificationTarget(n("echo_reply", { echo_id: "a b&c" }))).toBe("/echoes?echo=a%20b%26c");
  });
});
