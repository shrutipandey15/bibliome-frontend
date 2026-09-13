import { useEffect, useState } from "react";
import { getChatAttachmentBlobUrl } from "../services/api";

/**
 * A message's photo attachment. The endpoint is Bearer-authenticated like the
 * rest of the API (no auth cookie for ordinary requests), so a plain
 * `<img src={attachmentUrl}>` would 401 — this fetches it through apiFetch as
 * a blob instead, and revokes the object URL on unmount so a long-running
 * thread doesn't leak one per photo.
 */
export default function ChatImage({ url, alt = "" }) {
  const [src, setSrc] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let blobUrl;
    let cancelled = false;
    setSrc(null);
    setFailed(false);
    getChatAttachmentBlobUrl(url)
      .then((u) => {
        if (cancelled) { URL.revokeObjectURL?.(u); return; }
        blobUrl = u;
        setSrc(u);
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
  if (!src) return <div className="chat-image chat-image-loading" aria-hidden="true" />;
  return <img className="chat-image" src={src} alt={alt} />;
}
