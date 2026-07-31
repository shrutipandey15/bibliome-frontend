import { useTheme } from "../contexts/ThemeContext";

/**
 * The one theme control, so every surface toggles the same state rather than
 * each header growing its own copy. `className` lets a host style it as its own
 * chrome (the shelf header's square, the journal bar's ruled button) without
 * forking the behaviour.
 */
export default function ThemeToggle({ className = "theme-toggle" }) {
  const { theme, toggleTheme } = useTheme();
  const to = theme === "dark" ? "Vellum" : "Lamplight";
  return (
    <button
      type="button"
      className={className}
      onClick={toggleTheme}
      title={`Switch to ${to}`}
      aria-label={`Switch to ${to}`}
    >
      {theme === "dark" ? "☀" : "☾"}
    </button>
  );
}
