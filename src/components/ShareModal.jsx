import { useState, useEffect } from "react";
import "./ShareModal.css";

/**
 * The share-link modal.
 *
 * Server-side card rendering is retired (backend `app/routers/public.py`), so
 * there is no image to fetch here — this modal hands over the revocable share
 * link and nothing else. Saving the card as an image is a separate, local
 * concern: the "Save card" action rasterises the mounted DNACard with
 * html2canvas, which is why it lives next to the card rather than in here.
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
      // Fallback for older browsers
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
      // User cancelled or share failed — not an error
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content share-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>

        <h2 className="modal-title">Share Your DNA</h2>
        <p className="modal-subtitle">
          Anyone with this link can read your card. Revoke it any time from settings.
        </p>

        {shareLink ? (
          <div className="share-link-row">
            <input
              type="text"
              readOnly
              value={shareLink}
              className="share-link-input"
              onClick={(e) => e.target.select()}
            />
            <button className="share-link-copy" onClick={handleCopyLink}>
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        ) : (
          <div className="share-error">No share link yet — generate your DNA first.</div>
        )}

        {shareLink && navigator.share && (
          <div className="modal-actions">
            <button className="action-btn primary" onClick={handleNativeShare}>
              Share Link
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
