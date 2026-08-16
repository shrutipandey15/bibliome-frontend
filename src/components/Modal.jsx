import { useEffect, useRef, useCallback } from "react";

/**
 * Accessible modal baseline. [F1.7 / P5-9]
 *
 * The reusable dialog every modal in the app should mount inside. Guarantees the
 * WCAG 2.2 AA behaviours that are definition-of-done per the design rules:
 *   - role="dialog" + aria-modal, labelled by `title` (or `ariaLabel`)
 *   - focus moves into the dialog on open and is TRAPPED (Tab/Shift+Tab cycle)
 *   - Esc closes
 *   - focus is RESTORED to the trigger element on close
 *   - backdrop click closes; content click does not
 *
 * Usage:
 *   {open && (
 *     <Modal title="Log a book" onClose={() => setOpen(false)}>
 *       ...content...
 *     </Modal>
 *   )}
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// ── Body scroll lock ──
//
// Without this, dragging a bottom sheet on a phone scrolls the page underneath
// it once the sheet's own content runs out — measured: the shelf moved 500 →
// 1256px while the filter sheet sat open on top of it. That scroll-behind is
// most of what makes a site feel like a page rather than an app, and you land
// somewhere else when the sheet closes.
//
// `overflow: hidden` on <body> is the obvious fix and is not enough: iOS Safari
// scrolls the document anyway. Pinning the body with `position: fixed` at a
// negative offset is what actually holds there, and the offset is what keeps
// the page from jumping to the top — we put the scroll back on release.
//
// Ref-counted because modals can stack (a confirm inside a drawer): only the
// first lock records the position and only the last unlock restores it.
let lockCount = 0;
let lockedScrollY = 0;

function lockScroll() {
  if (lockCount++ > 0) return;
  lockedScrollY = window.scrollY;
  const body = document.body;
  body.style.position = "fixed";
  body.style.top = `-${lockedScrollY}px`;
  body.style.left = "0";
  body.style.right = "0";
  body.style.width = "100%";
}

function unlockScroll() {
  if (--lockCount > 0) return;
  lockCount = 0; // paranoia: never go negative if an unlock is double-fired
  const body = document.body;
  body.style.position = "";
  body.style.top = "";
  body.style.left = "";
  body.style.right = "";
  body.style.width = "";
  // Instant, not smooth: this is restoring where you already were, not a
  // journey. A smooth scroll here reads as the page sliding away under you.
  window.scrollTo(0, lockedScrollY);
}

export default function Modal({
  onClose,
  title,
  ariaLabel,
  children,
  className = "",
  backdropClassName = "",
  closeOnBackdrop = true,
}) {
  const cardRef = useRef(null);
  // The element focused before the modal opened, so we can restore it on close.
  const previouslyFocused = useRef(null);

  const focusables = useCallback(() => {
    if (!cardRef.current) return [];
    return Array.from(cardRef.current.querySelectorAll(FOCUSABLE));
  }, []);

  // Move focus into the dialog on mount; restore it on unmount.
  useEffect(() => {
    previouslyFocused.current = document.activeElement;
    const els = focusables();
    (els[0] || cardRef.current)?.focus();

    return () => {
      const prev = previouslyFocused.current;
      if (prev && typeof prev.focus === "function") prev.focus();
    };
  }, [focusables]);

  // Hold the page still behind the dialog for as long as it is open.
  useEffect(() => {
    lockScroll();
    return unlockScroll;
  }, []);

  // Keyboard: Esc closes, Tab is trapped within the dialog.
  const onKeyDown = (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose?.();
      return;
    }
    if (e.key !== "Tab") return;

    const els = focusables();
    if (els.length === 0) {
      e.preventDefault();
      return;
    }
    const first = els[0];
    const last = els[els.length - 1];
    const active = document.activeElement;

    if (e.shiftKey && (active === first || !cardRef.current.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const titleId = title ? "modal-title" : undefined;

  return (
    <div
      className={`modal-backdrop ${backdropClassName}`}
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        ref={cardRef}
        className={`modal-card ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-label={titleId ? undefined : ariaLabel}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        {title && (
          <h2 id={titleId} className="modal-title">
            {title}
          </h2>
        )}
        {children}
      </div>
    </div>
  );
}
