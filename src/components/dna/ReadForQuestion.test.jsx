import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReadForQuestion from "./ReadForQuestion";

// Options come from the shared emotion vocabulary (grief, comfort, awe, …).
describe("ReadForQuestion [F7.7]", () => {
  it("explains WHY it asks, and is skippable", async () => {
    const onSkip = vi.fn();
    render(<ReadForQuestion onSave={vi.fn()} onSkip={onSkip} />);
    expect(screen.getByText(/whether the feelings you reach for match/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /skip for now/i }));
    expect(onSkip).toHaveBeenCalled();
  });

  it("caps the selection at two feelings", async () => {
    render(<ReadForQuestion onSave={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /^comfort$/i }));
    await userEvent.click(screen.getByRole("button", { name: /^heartbreak$/i }));
    // A third option is now disabled — pick 1–2.
    expect(screen.getByRole("button", { name: /^awe$/i })).toBeDisabled();
  });

  it("saves the picked emotion slugs", async () => {
    const onSave = vi.fn().mockResolvedValue();
    render(<ReadForQuestion onSave={onSave} />);
    await userEvent.click(screen.getByRole("button", { name: /^comfort$/i }));
    await userEvent.click(screen.getByRole("button", { name: /^save$/i }));
    expect(onSave).toHaveBeenCalledWith(["comfort"]);
  });
});
