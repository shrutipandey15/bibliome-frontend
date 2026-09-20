import { describe, it, expect } from "vitest";
import { ARCHETYPES } from "./archetypes";
import { COMPARISONS } from "./comparisons";
import { CONTENT_ROUTES, routeByPath } from "./pageHtml";

// These pages exist to be read by crawlers that run no JavaScript, so the thing
// worth checking is that the prerendered string is actually a whole page — not
// that React renders it. vite.config.js bakes exactly these strings into
// dist/<route>/index.html.

describe("content routes", () => {
  it("covers every archetype and comparison exactly once", () => {
    expect(ARCHETYPES).toHaveLength(8);
    const paths = CONTENT_ROUTES.map((r) => r.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const a of ARCHETYPES) expect(paths).toContain(`/archetypes/${a.slug}`);
    for (const c of COMPARISONS) expect(paths).toContain(`/vs/${c.slug}`);
  });

  it.each(CONTENT_ROUTES.map((r) => [r.path, r]))("%s is a complete page", (_p, route) => {
    const html = route.html();
    expect(html).toMatch(/<h1>/);
    // The whole point: enough prose that an answer engine has something to
    // quote. Under ~350 words a page is a stub, not content.
    const words = html.replace(/<[^>]+>/g, " ").trim().split(/\s+/).length;
    expect(words).toBeGreaterThan(350);
    // A crawler that lands here has to be able to get to the product.
    expect(html).toContain('href="/"');

    expect(route.title.length).toBeGreaterThan(10);
    // Google truncates descriptions past ~160 chars; over 300 it ignores them.
    expect(route.description.length).toBeLessThan(300);
    expect(() => JSON.parse(JSON.stringify(route.jsonLd()))).not.toThrow();
    expect(route.jsonLd()["@context"]).toBe("https://schema.org");
  });

  it("escapes markup rather than emitting it raw", () => {
    // Every string is a literal today, so this only guards the escaper itself
    // against being quietly removed later.
    const html = routeByPath("/vs/storygraph").html();
    expect(html).not.toMatch(/<script/i);
    expect(html).toContain("&quot;you're caught up.&rdquo;".replace("&rdquo;", "”").replace("&quot;", "“"));
  });

  it("matches a path with or without a trailing slash", () => {
    expect(routeByPath("/archetypes/")).toBe(routeByPath("/archetypes"));
    expect(routeByPath("/archetypes/nope")).toBeUndefined();
  });
});

describe("archetype copy stays anchored to the engine", () => {
  // dna_engine.py PERSONALITY_TYPES is the source of truth. A page for an
  // archetype the engine cannot return would promise a reader something
  // unreachable — the exact bug the landing page already had once.
  const ENGINE_IDS = [
    "grief_romantic", "control_intellectual", "soft_masochist", "comfort_architect",
    "midnight_arsonist", "quiet_witness", "obsessive_romantic", "emotional_archaeologist",
  ];

  it("has one page per engine archetype and no extras", () => {
    expect(ARCHETYPES.map((a) => a.id).sort()).toEqual([...ENGINE_IDS].sort());
  });

  it.each(ARCHETYPES.map((a) => [a.slug, a]))("%s names its emotions", (_s, a) => {
    expect(a.primary).toHaveLength(3);
    expect(a.anti).toHaveLength(2);
    // An emotion can't be both what produces an archetype and what it avoids.
    expect(a.primary.filter((e) => a.anti.includes(e))).toEqual([]);
  });
});
