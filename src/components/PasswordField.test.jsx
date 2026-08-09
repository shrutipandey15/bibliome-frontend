import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import PasswordField from "./PasswordField";

describe("PasswordField", () => {
  it("hides the password until asked, then shows it", async () => {
    render(<PasswordField aria-label="Password" defaultValue="hunter2pass" />);
    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("type", "password");

    await userEvent.click(screen.getByRole("button", { name: /show password/i }));
    expect(input).toHaveAttribute("type", "text");

    await userEvent.click(screen.getByRole("button", { name: /hide password/i }));
    expect(input).toHaveAttribute("type", "password");
  });

  it("starts hidden on every mount — a reveal doesn't follow you to the next form", () => {
    const { unmount } = render(<PasswordField aria-label="Password" />);
    unmount();
    render(<PasswordField aria-label="Password" />);
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
  });

  it("keeps the caller's own class and input attributes", () => {
    render(
      <PasswordField
        aria-label="Password"
        className="set-input"
        autoComplete="new-password"
        minLength={8}
        required
      />
    );
    const input = screen.getByLabelText("Password");
    expect(input).toHaveClass("set-input");
    expect(input).toHaveAttribute("autocomplete", "new-password");
    expect(input).toHaveAttribute("minlength", "8");
    expect(input).toBeRequired();
  });

  it("stays out of the tab order, so Tab goes from the field to submit", async () => {
    render(
      <>
        <PasswordField aria-label="Password" />
        <button>sign in</button>
      </>
    );
    screen.getByLabelText("Password").focus();
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "sign in" })).toHaveFocus();
  });

  it("reports value changes to the caller like a plain input", async () => {
    const onChange = vi.fn();
    render(<PasswordField aria-label="Password" value="" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText("Password"), "a");
    expect(onChange).toHaveBeenCalled();
  });
});
