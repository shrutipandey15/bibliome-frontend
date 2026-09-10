import { useState, useEffect } from "react";
import Modal from "./Modal";
import "./ShareModal.css";

/**
 * The share-link dialog.
 *
 * Server-side card rendering is retired (backend `app/routers/public.py`), so
 * there is no image to fetch here — this hands over the revocable share link and
 * nothing else. Saving the card as an image is a separate, local concern (the
 * "Save card" action rasterises the mounted DNACard with html2canvas), which is
 * why it lives next to the card rather than in here.
 *
 * Mounts inside the shared <Modal> so it gets the focus trap, Esc, scroll-lock
 * and (on a phone) bottom-sheet treatment every other dialog in the app has. It
 * used to render its own `.modal-overlay` div, which had no CSS at all — so it
 * laid out in the page flow and pushed the profile layout down instead of
 * floating over it.
 */
export default function ShareModal({ isOpen, onClose, shareToken }) {
  const [copied, setCopied] = useState(false);

  const shareLink = shareToken
    ? `${window.location.origin}/s/${shareToken}`
    : null;

  useEffect(() => {
    if (isOpen) setCopied(false);
  }, [isOpen]);

  const handleCopyLink = async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.createElement("input");
      input.value = shareLink;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleNativeShare = async () => {
    if (!navigator.share) return;
    try {
      await navigator.share({
        title: "My Reading DNA",
        text: "Check out my reading personality!",
        url: shareLink,
      });
    } catch {
      // cancelled — not an error
    }
  };

  if (!isOpen) return null;

  return (
    <Modal onClose={onClose} ariaLabel="Share your DNA" className="share-modal">
      <h2 className="share-modal-title">Share your DNA</h2>
      <p className="share-modal-sub">
        Anyone with this link can read your card. Revoke it any time from settings.
      </p>

      {shareLink ? (
        <div className="share-link-row">
          <input
            type="text"
            readOnly
            value={shareLink}
            className="share-link-input"
            aria-label="Your share link"
            onClick={(e) => e.target.select()}
          />
          <button className="share-link-copy" onClick={handleCopyLink}>
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      ) : (
        <p className="share-error">No share link yet — generate your DNA first.</p>
      )}

      {shareLink && navigator.share && (
        <button className="btn ghost share-native" onClick={handleNativeShare}>
          Share via…
        </button>
      )}
    </Modal>
  );
}
