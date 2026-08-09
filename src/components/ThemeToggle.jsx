import { Sun, Moon } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";

/**
 * The one theme control, so every surface toggles the same state rather than
 * each header growing its own copy. `className` lets a host style it as its own
 * chrome (the shelf header's square, the journal bar's ruled button) without
 * forking the behaviour.
 *
 * Drawn rather than typeset. As a `☀` glyph it sat two buttons away from
 * Resonance's `❋` in the same weight and colour, and the pair was unreadable —
 * a line icon among typographic marks is legible precisely because it doesn't
 * match them.
 */
export default function ThemeToggle({ className = "theme-toggle" }) {
  const { theme, toggleTheme } = useTheme();
  const to = theme === "dark" ? "Vellum" : "Lamplight";
  return (
    <button
      type="button"
      className={className}
      onClick={toggleTheme}
      title={`Switch to ${to} — the ${theme === "dark" ? "light" : "dark"} theme`}
      aria-label={`Switch to ${to}`}
    >
      {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}
