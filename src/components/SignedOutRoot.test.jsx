import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

vi.mock("../pages/LandingPage", () => ({ default: () => <div>landing</div> }));

import SignedOutRoot from "./SignedOutRoot";
import { stashReturn, takeReturn } from "../services/pendingInvite";

function visit(url) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/login" element={<div>login page</div>} />
        <Route path="/*" element={<SignedOutRoot onGetStarted={() => {}} />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("signed-out deep links come back after sign-in", () => {
  beforeEach(() => sessionStorage.clear());

  it.each([
    "/digest/2026-41#weather",
    "/?view=dna&letter=2026-41",
    "/?entry=abc",
    "/settings?section=notifications",
    "/collections/c1/discussion/b2",
  ])("parks %s and sends them to sign in", (url) => {
    visit(url);
    expect(screen.getByText("login page")).toBeInTheDocument();
    expect(takeReturn()).toBe(url);
    expect(takeReturn()).toBeNull();      // used exactly once
  });

  it.each(["/", "/?utm_source=insta", "/#faq"])("%s is just the landing page", (url) => {
    visit(url);
    expect(screen.getByText("landing")).toBeInTheDocument();
    expect(takeReturn()).toBeNull();
  });

  it("never parks a path that leaves the app", () => {
    stashReturn("//evil.com");
    stashReturn("https://evil.com");
    expect(takeReturn()).toBeNull();
  });
});
