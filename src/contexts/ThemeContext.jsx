import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/**
 * Vellum / Lamplight — one surface for the whole app.
 *
 * This used to be a hook living inside `Dashboard`, which meant `data-theme` was
 * only ever written to <html> if the shelf happened to mount. A reader who
 * landed on /journal, /echoes or the landing page got the `:root` default
 * (Vellum) no matter what they had chosen, and the attribute then stuck around
 * after a visit to the shelf — so which surface you got depended on the order
 * you'd opened pages in. Hence: one provider, at the root, above the router.
 *
 * The attribute is ALSO set by a boot script in index.html before first paint.
 * That is not redundant: an effect runs after the first paint, so a Lamplight
 * reader saw a full frame of Vellum on every hard load. The script owns the
 * first frame, this provider owns every frame after it.
 */

const KEY = "bd-theme";
const ThemeContext = createContext(null);

const systemTheme = () =>
  (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light");

/** What the reader explicitly chose, or null if they never have. */
function storedChoice() {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null; // private mode — the choice just doesn't survive the tab
  }
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    // Trust the boot script first: it already decided what is on screen, and
    // disagreeing with it here would repaint the page for no reason.
    const onRoot = document.documentElement.getAttribute("data-theme");
    if (onRoot === "light" || onRoot === "dark") return onRoot;
    return storedChoice() || systemTheme();
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Persist only on an explicit choice. Writing on mount would immediately make
  // every reader "have chosen", which kills the OS-following below.
  const setTheme = useCallback((next) => {
    setThemeState(next);
    try { localStorage.setItem(KEY, next); } catch { /* private mode */ }
  }, []);

  // Follow the OS, but only for readers who have never picked for themselves.
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq?.addEventListener) return;
    const onChange = (e) => { if (!storedChoice()) setThemeState(e.matches ? "dark" : "light"); };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme: () => setTheme(theme === "dark" ? "light" : "dark") }),
    [theme, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  // A toggle rendered outside the provider would silently do nothing, which is
  // the exact class of bug this file exists to fix.
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
