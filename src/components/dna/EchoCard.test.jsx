import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EchoCard from "./EchoCard";

const echo = {
  entry_id: "e1", relation: "pulled",
  book_type: { id: "world_diver", name: "The World-Diver", color: "#3A7A8C", glyph: "✦" },
  extra: { kind: "first", emotion: "swoon" },
};

afterEach(() => vi.useRealTimers());

describe("EchoCard [Aliveness F1]", () => {
  it("says what the book did, politely announced, with the archetype written out", () => {
    render(<EchoCard echo={echo} />);
    const card = screen.getByRole("status");
    expect(card).toHaveTextContent("This one pulled you toward the World-Diver.");
    expect(card).toHaveTextContent("A first for you: “it gave me butterflies”.");
  });

  it("opens the DNA page and dismisses itself", async () => {
    const onOpen = vi.fn(); const onDone = vi.fn();
    render(<EchoCard echo={echo} onOpen={onOpen} onDone={onDone} />);
    await userEvent.click(screen.getByRole("button", { name: "See your DNA" }));
    expect(onOpen).toHaveBeenCalled();
    expect(onDone).toHaveBeenCalled();
  });

  it("goes away on its own", () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    render(<EchoCard echo={{ ...echo, extra: null }} onDone={onDone} duration={6000} />);
    act(() => { vi.advanceTimersByTime(6000); });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("renders nothing without a book type", () => {
    const { container } = render(<EchoCard echo={{ entry_id: "x" }} />);
    expect(container).toBeEmptyDOMElement();
  });
});
