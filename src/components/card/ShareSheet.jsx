import { useEffect, useMemo, useRef, useState } from "react";
import Modal from "../Modal";
import {
  countShare, generateShareToken, getDNAProfile, getShareToken, revokeShareTokens, updateSettings,
} from "../../services/api";
import {
  FORMAT_LABELS, applyChoices, cardUrl, displayName, fileName, imageFormats, seasonJustTurned, shareText,
} from "./cardModel";
import { renderCard } from "./renderCard";
import "./ShareSheet.css";

/** Instagram, Facebook, WhatsApp and other in-app browsers on Android can't
 *  hand a file to the system share sheet. */
export function isAndroidInApp(ua = typeof navigator !== "undefined" ? navigator.userAgent : "") {
  return /Android/i.test(ua) && (/; wv\)/.test(ua) || /Instagram|FBAN|FBAV|FB_IAB|WhatsApp|Line\//i.test(ua));
}

function canShareFile(file) {
  try {
    return !!file && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const input = document.createElement("input");
    input.value = text;
    document.body.appendChild(input);
    input.select();
    const ok = document.execCommand?.("copy");
    input.remove();
    return !!ok;
  }
}

/**
 * The share sheet (DNA card spec, "Share flows").
 *
 * One Share button, the best handover the browser allows, and always a way out:
 *   - iOS Safari 14+ / Android Chrome / installed app: the system share sheet
 *     with the image (Instagram, WhatsApp and Save Image appear there).
 *   - Android in-app browsers: "Open in Chrome to share the image", plus Copy link.
 *   - Firefox and desktops without file sharing: Save image and Copy link.
 *   - Cancelled: nothing happens.
 *
 * The image is rendered when the sheet opens and again whenever the format or a
 * switch changes — never when Share is tapped, because Safari only lets a page
 * share a file straight from a tap, with no waiting in between.
 *
 * `card` is the page's copy of the owner's card; the sheet fetches the fresh
 * profile first so the image matches the DNA page, and uses `card` only if that
 * fetch fails (offline, say). `onClose(choices)` hands back the switches as the
 * reader left them, so the page's card can follow.
 */
export default function ShareSheet({ onClose, card: pageCard = null, initialFormat = "story" }) {
  const [card, setCard] = useState(null);
  const [seasons, setSeasons] = useState([]);
  const [choices, setChoices] = useState(null);
  const [loading, setLoading] = useState(true);
  const [format, setFormat] = useState(initialFormat);
  const [image, setImage] = useState(null);
  const [failed, setFailed] = useState(false);
  const [token, setToken] = useState(null);
  // The reader turned their link off. Remembered on the account (GET
  // /user/share-token says so), so no device quietly makes a new one.
  const [linkOff, setLinkOff] = useState(false);
  const [status, setStatus] = useState("");
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine !== false);
  const [previewRev, setPreviewRev] = useState(0);
  const imageUrl = useRef(null);
  // Switch saves go one at a time, in the order they were made, so two quick
  // taps can't land out of order and leave the server disagreeing with the UI.
  const saving = useRef(Promise.resolve());

  // The fresh card, so the image matches what the DNA page shows right now.
  useEffect(() => {
    let alive = true;
    getDNAProfile()
      .then((p) => {
        if (!alive) return;
        const fresh = p?.card || pageCard;
        setCard(fresh);
        setChoices(fresh?.choices || { season: true, red_flag: true });
        setSeasons(p?.seasons || []);
      })
      .catch(() => {
        if (!alive) return;
        setCard(pageCard);
        setChoices(pageCard?.choices || { season: true, red_flag: true });
      })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
    // The page's card is a fallback only; refetching when it changes would loop.
  }, []);

  // The one card link: the same link every time, until the reader turns it off.
  useEffect(() => {
    let alive = true;
    getShareToken()
      .then(({ share_token, off }) => {
        if (!alive) return null;
        if (share_token) return setToken(share_token);
        if (off) return setLinkOff(true);
        // Never had one: the first share makes it.
        return generateShareToken().then((d) => alive && setToken(d.share_token));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  const view = useMemo(() => (card ? { ...card, choices } : null), [card, choices]);
  const shown = useMemo(() => applyChoices(view), [view]);
  const formats = useMemo(() => (shown ? [...imageFormats(shown), "link"] : ["story", "square", "link"]), [shown]);
  const justTurned = seasonJustTurned(shown, seasons);

  // A format that stopped existing (the season was switched off) falls back.
  useEffect(() => {
    if (!formats.includes(format)) setFormat("story");
  }, [formats, format]);

  // Draw the image ahead of the tap.
  useEffect(() => {
    if (!view || format === "link" || !formats.includes(format)) return undefined;
    let alive = true;
    setImage(null);
    setFailed(false);
    renderCard(format, view, { justTurned })
      .then((blob) => {
        if (!alive) return;
        const url = URL.createObjectURL(blob);
        if (imageUrl.current) URL.revokeObjectURL(imageUrl.current);
        imageUrl.current = url;
        const file = typeof File === "function" ? new File([blob], fileName(view, format), { type: "image/png" }) : null;
        setImage({ format, blob, url, file });
      })
      .catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [view, format, formats, justTurned]);

  useEffect(() => () => {
    if (imageUrl.current) URL.revokeObjectURL(imageUrl.current);
  }, []);

  const url = cardUrl(token);
  const isImage = format !== "link";
  const ready = isImage ? image?.format === format : !!url;
  const fileShare = isImage && canShareFile(image?.file);
  const inApp = isAndroidInApp();

  const setSwitch = (key, field) => (e) => {
    const value = e.target.checked;
    setChoices((c) => ({ ...c, [key]: value }));
    saving.current = saving.current
      .then(() => updateSettings({ [field]: value }))
      .then(() => setPreviewRev((n) => n + 1))
      .catch(() => setStatus("Couldn't save that choice. It applies to this image only."));
  };

  // No awaits before navigator.share: Safari drops the tap otherwise.
  const onShare = () => {
    if (!ready) return;
    if (!isImage) {
      const a = shown.archetype;
      navigator.share({
        title: "My reading DNA",
        text: `I'm ${a.article || "a"} ${displayName(a.name)}. What's yours?`,
        url,
      }).then(() => countShare("link")).catch(() => {});
      return;
    }
    navigator.share({ files: [image.file], text: shareText(shown, token, format) })
      .then(() => countShare(format))
      .catch((err) => {
        if (err?.name !== "AbortError") setStatus("Sharing didn't work here. Save the image instead.");
      });
  };

  const onSave = () => {
    if (!image) return;
    const a = document.createElement("a");
    a.href = image.url;
    a.download = fileName(view, format);
    document.body.appendChild(a);
    a.click();
    a.remove();
    countShare(format);
    setStatus("Image saved.");
  };

  const onCopy = async () => {
    if (!url) return;
    if (await copyText(url)) {
      countShare("link");
      setStatus("Link copied.");
    } else {
      setStatus("Couldn't copy. Press and hold the link to copy it.");
    }
  };

  const onTurnOff = async () => {
    try {
      await revokeShareTokens();
      setToken(null);
      setLinkOff(true);
      setStatus("Your card link is off. Old previews now show a plain Bibliome image.");
    } catch {
      setStatus("Couldn't turn the link off. Try again.");
    }
  };

  const onNewLink = async () => {
    try {
      const d = await generateShareToken();
      setToken(d.share_token);
      setLinkOff(false);
      setStatus("New card link ready.");
    } catch {
      setStatus("Couldn't make a link. Try again.");
    }
  };

  // The page's own card shows what strangers see, so it needs the switches the
  // reader just set.
  const close = () => onClose?.(choices);

  const preview = (() => {
    if (loading) return <div className="share-preview-wait">Getting your card…</div>;
    if (!shown) return <div className="share-preview-wait">Your card isn't ready yet.</div>;
    if (!isImage) {
      return url ? (
        <img
          className="share-preview-img share-preview-img--link"
          src={`/s/${token}/card.jpg?r=${previewRev}`}
          alt={`How your link looks in a chat: ${shown.archetype.name}`}
        />
      ) : <div className="share-preview-wait">Your card link is off.</div>;
    }
    if (failed) return <div className="share-preview-wait">Couldn't make the image. Close and try again.</div>;
    if (!ready) return <div className="share-preview-wait">Preparing…</div>;
    return (
      <img
        className={`share-preview-img share-preview-img--${format}`}
        src={image.url}
        alt={`Preview of your ${FORMAT_LABELS[format].toLowerCase()}: ${shareText(shown, null, format)}`}
      />
    );
  })();

  // Until the image exists, assume a browser that can share files can share
  // this one (so the button reads "Preparing…" rather than appearing late).
  const filesSupported = typeof navigator.canShare === "function";
  const canShareHere = isImage
    ? (image?.format === format ? fileShare : filesSupported)
    : typeof navigator.share === "function";
  const shareLabel = isImage && !ready ? "Preparing…" : "Share";

  return (
    <Modal onClose={close} ariaLabel="Share your reading DNA card" className="share-sheet">
      <h2 className="share-sheet-title">Share your card</h2>

      <div className="share-preview">{preview}</div>

      <fieldset className="share-formats">
        <legend className="share-legend">Format</legend>
        {formats.map((f) => (
          <label key={f} className={`share-format${format === f ? " is-on" : ""}`}>
            <input type="radio" name="share-format" value={f} checked={format === f}
              onChange={() => setFormat(f)} />
            {FORMAT_LABELS[f]}
          </label>
        ))}
      </fieldset>

      {card && (
        <fieldset className="share-switches">
          <legend className="share-legend">On the card you share</legend>
          {card.season && (
            <label className="share-switch">
              <input type="checkbox" checked={!!choices?.season} onChange={setSwitch("season", "card_show_season")} />
              My current season
            </label>
          )}
          <label className="share-switch">
            <input type="checkbox" checked={!!choices?.red_flag} onChange={setSwitch("red_flag", "card_show_red_flag")} />
            My red flag
          </label>
        </fieldset>
      )}

      {!online && <p className="share-note">You're offline. You can still save the image.</p>}
      {isImage && inApp && (
        <p className="share-note">Open in Chrome to share the image. You can copy the link from here.</p>
      )}

      <div className="share-actions">
        {canShareHere && !(isImage && inApp) && (
          <button type="button" className="share-primary" onClick={onShare}
            disabled={!ready || (!isImage && !url)}>
            {shareLabel}
          </button>
        )}
        <div className="share-secondary">
          {isImage && (
            <button type="button" className="share-btn" onClick={onSave} disabled={!ready}>Save image</button>
          )}
          <button type="button" className="share-btn" onClick={onCopy} disabled={!url}>Copy link</button>
        </div>
      </div>

      <div className="share-link">
        {url ? (
          <>
            <span className="share-link-url">{url.replace("https://", "")}</span>
            <button type="button" className="share-text-btn" onClick={onTurnOff}>Turn off my card link</button>
          </>
        ) : linkOff ? (
          <>
            <span className="share-link-url">Your card link is off.</span>
            <button type="button" className="share-text-btn" onClick={onNewLink}>Make a new link</button>
          </>
        ) : null}
      </div>

      <p className="share-status" role="status" aria-live="polite">{status}</p>
    </Modal>
  );
}
