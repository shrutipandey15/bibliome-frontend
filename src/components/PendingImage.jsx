import { useEffect, useState } from "react";

/**
 * The photo you've picked but not sent yet, in both chat surfaces.
 *
 * It used to be the filename on a pill — which tells you what you picked only
 * if you can remember what "IMG_4471.jpg" was. The thumbnail is the point: you
 * confirm it's the right photo before it's out of your hands, since neither
 * surface lets you edit a message after it's sent.
 */
export default function PendingImage({ file, onRemove, sending = false }) {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    // Guarded for jsdom, which has no object URLs — same reason as ChatImage.
    const u = URL.createObjectURL?.(file);
    setSrc(u || null);
    return () => { if (u) URL.revokeObjectURL?.(u); };
  }, [file]);

  return (
    <div className={`pending-image ${sending ? "is-sending" : ""}`}>
      <span className="pending-image-thumb">
        {src && <img src={src} alt="" />}
      </span>
      <span className="pending-image-text">
        <span className="pending-image-name">{file.name}</span>
        <span className="pending-image-size">
          {sending ? "sending…" : `${Math.max(1, Math.round(file.size / 1024))} KB · ready to send`}
        </span>
      </span>
      <button
        type="button"
        className="pending-image-remove"
        onClick={onRemove}
        disabled={sending}
        aria-label="Remove photo"
      >
        ×
      </button>
    </div>
  );
}
