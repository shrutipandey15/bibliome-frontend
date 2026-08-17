import { describe, it, expect, beforeEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { useHead } from "./useHead";

/**
 * The head tags are the whole point of the hook, and nothing else asserts them:
 * a route could silently stop setting its canonical and every other test would
 * still pass. [#2]
 */

const canonical = () => document.head.querySelector('link[rel="canonical"]')?.getAttribute("href");
const meta = (sel) => document.head.querySelector(sel)?.getAttribute("content");

function Page({ head }) {
  useHead(head);
  return null;
}

describe("useHead", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    document.title = "";
  });

  it("sets title, description and an absolute canonical from a path", () => {
    render(<Page head={{ title: "Privacy — Bibliome", canonical: "/privacy", description: "What we store." }} />);
    expect(document.title).toBe("Privacy — Bibliome");
    expect(canonical()).toBe("https://bibliome.app/privacy");
    expect(meta('meta[name="description"]')).toBe("What we store.");
  });

  it("points og:url at the route, not at the site root", () => {
    // The bug this guards: every route inheriting index.html's canonical of "/"
    // told search engines the landing page was the canonical version of itself.
    render(<Page head={{ title: "Terms", canonical: "/terms" }} />);
    expect(meta('meta[property="og:url"]')).toBe("https://bibliome.app/terms");
  });

  it("defaults og:title to the page title rather than the site default", () => {
    render(<Page head={{ title: "Sign in — Bibliome", canonical: "/login" }} />);
    expect(meta('meta[property="og:title"]')).toBe("Sign in — Bibliome");
    expect(meta('meta[name="twitter:title"]')).toBe("Sign in — Bibliome");
  });

  it("honours an explicit noindex", () => {
    render(<Page head={{ robots: "noindex, nofollow", title: "A reader's DNA" }} />);
    expect(meta('meta[name="robots"]')).toBe("noindex, nofollow");
  });

  it("restores defaults on unmount so one route's title can't leak into the next", () => {
    render(<Page head={{ title: "Privacy — Bibliome", canonical: "/privacy", robots: "noindex" }} />);
    cleanup();
    expect(document.title).toBe("Bibliome — The Emotional Fingerprint of Your Reading Life");
    expect(canonical()).toBe("https://bibliome.app/");
    expect(meta('meta[name="robots"]')).toBe("index, follow");
  });

  it("updates index.html's existing tags instead of appending duplicates", () => {
    // A second <link rel=canonical> is worse than none: crawlers pick one.
    const link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    link.setAttribute("href", "https://bibliome.app/");
    document.head.appendChild(link);

    render(<Page head={{ title: "Terms", canonical: "/terms" }} />);
    expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    expect(document.head.querySelectorAll('meta[name="description"]')).toHaveLength(1);
  });
});
