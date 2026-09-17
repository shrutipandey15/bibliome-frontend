import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { getChatAttachment } from "../services/api";
import Modal from "./Modal";

const EXT = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

/**
 * A message's photo attachment. The endpoint is Bearer-authenticated like the
 * rest of the API (no auth cookie for ordinary requests), so a plain
 * `<img src={attachmentUrl}>` would 401 — this fetches it through apiFetch as
 * a blob instead, and revokes the object URL on unmount so a long-running
 * thread doesn't leak one per photo.
 *
 * In the transcript it's a small card, capped so a tall photo can't push the
 * conversation off the screen. The photo itself is the button: tapping opens it
 * full-size, which is where downloading actually belongs — a 26px icon hovering
 * over a thumbnail was the only way to get the file, and on touch it sat
 * permanently on top of the image it was covering.
 */
export default function ChatImage({ url, alt = "" }) {
  const [img, setImg] = useState(null); // { src, type }
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let blobUrl;
    let cancelled = false;
    setImg(null);
    setFailed(false);
    getChatAttachment(url)
      .then(({ url: u, type }) => {
        if (cancelled) { URL.revokeObjectURL?.(u); return; }
        blobUrl = u;
        setImg({ src: u, type });
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => {
      cancelled = true;
      // jsdom (vitest) has no revokeObjectURL — same guard style as
      // scrollIntoView elsewhere in this app for an environment gap, not a
      // real absence in any browser this ships to.
      if (blobUrl) URL.revokeObjectURL?.(blobUrl);
    };
  }, [url]);

  if (failed) return <div className="chat-image chat-image-failed">Couldn't load this image.</div>;
  if (!img) return <div className="chat-image-loading" aria-label="Loading photo" role="img" />;

  // The attachment URL is extensionless, so without this the browser saves a
  // file no OS will open by double-click.
  const filename = `photo.${EXT[img.type] || "jpg"}`;

  return (
    <>
      <button
        type="button"
        className="chat-image-wrap"
        onClick={() => setOpen(true)}
        aria-label={alt ? `${alt} — open full size` : "Open photo full size"}
      >
        <img className="chat-image" src={img.src} alt={alt} />
        <span className="chat-image-hint" aria-hidden="true">tap to open</span>
      </button>

      {open && (
        <Modal
          onClose={() => setOpen(false)}
          ariaLabel={alt || "Photo"}
          className="chat-lightbox"
          backdropClassName="chat-lightbox-backdrop"
        >
          <img className="chat-lightbox-img" src={img.src} alt={alt} />
          <div className="chat-lightbox-bar">
            {/* The blob is already on hand, so download is just handing the
                browser its own object URL under a real filename — no second
                fetch, and nothing to fail. */}
            <a className="chat-lightbox-btn" href={img.src} download={filename}>
              <Download size={15} aria-hidden="true" /> save
            </a>
            <button type="button" className="chat-lightbox-btn" onClick={() => setOpen(false)}>
              <X size={15} aria-hidden="true" /> close
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
