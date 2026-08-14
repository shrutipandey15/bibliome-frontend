import { useNavigate } from "react-router-dom";
import { Library, Dna, MessageCircle, NotebookPen } from "lucide-react";

/**
 * The four top-level destinations.
 *
 * This used to live inside ReadingRoomHeader, which was fine while it was a
 * ribbon attached to the top of the Dashboard's content. It stopped being fine
 * when it became a fixed bottom bar: Echo and Journal are separate ROUTES, not
 * Dashboard tabs, so tapping either made the bar navigate away from itself.
 * A persistent bar that disappears on half its items isn't navigation.
 *
 * So it's shared chrome now. Two shapes, one component:
 *
 *   - Dashboard renders it plainly. Above 640 that's the folder ribbon it has
 *     always been; below, the fixed bottom bar.
 *   - Echo and Journal pass `barOnly`, which hides it above 640 — those pages
 *     carry their own mastheads and a ribbon would be a second, competing
 *     header. On a phone they get the bar like everyone else.
 *
 * Styles stay in App.css beside the rest of the .rr-* chrome, deliberately: that
 * sheet is global and already loads before any lazy page, so moving them into a
 * TabBar.css would only introduce a cascade-order question with nothing to gain.
 */
const TABS = [
  { id: "shelf",   label: "Shelf",   Icon: Library,       to: "/" },
  { id: "dna",     label: "DNA",     Icon: Dna,           to: "/?view=dna" },
  { id: "echoes",  label: "Echo",    Icon: MessageCircle, to: "/echoes" },
  // Deliberately unadorned: no streak, no count, no "you haven't written in
  // 4 days". A journal that nags is a journal you start lying to.
  { id: "journal", label: "Journal", Icon: NotebookPen,   to: "/journal" },
];

export default function TabBar({ active, shelfCount, barOnly = false }) {
  const navigate = useNavigate();

  return (
    <nav className={`rr-tabs ${barOnly ? "rr-tabs-baronly" : ""}`} aria-label="Sections">
      {TABS.map((t) => {
        const on = active === t.id;
        return (
          <button
            key={t.id}
            className={`rr-tab ${on ? "active" : ""}`}
            onClick={() => navigate(t.to)}
            aria-current={on ? "page" : undefined}
          >
            <t.Icon size={19} className="rr-tab-icon" aria-hidden="true" />
            {t.label}
            {t.id === "shelf" && shelfCount !== undefined && (
              <span className="rr-tab-count">{String(shelfCount).padStart(2, "0")}</span>
            )}
            {on && <span className="rr-tab-mark">✦</span>}
          </button>
        );
      })}
    </nav>
  );
}
