import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import { usePrivateJournal } from "../../contexts/PrivateJournalContext";
import { getEmotionFamilies } from "../../services/emotions";
import { formatLongDate } from "./BlankPage";

/**
 * Screen 3 — naming days, afterwards.
 *
 * Two rules this component exists to obey (VISION §6):
 *
 *   Tagging is never a gate. There is no mood picker before writing, no
 *   requirement to tag before leaving, and every screen here can be dismissed
 *   with the page still untagged. "Skip" is a real button and it does what it
 *   says. Days can stay unnamed forever.
 *
 *   Naming works better in retrospect. Asking "what was that?" about last
 *   Tuesday gets a truer answer than asking on Tuesday — and the friction is
 *   lower, because the writing is already done.
 *
 * The eighteen emotions arrive collapsed into their five families. Eighteen
 * options at once is a menu; five is a question.
 *
 * These tags go to the server in plaintext, and that is the deliberate half of
 * the split (contract §2): DNA runs on tags, never on prose. Nothing here
 * encrypts, and it should stay that way — an encrypted tag is a tag the DNA
 * pipeline can't use, which would leave the journal with no reason to live
 * inside Bibliome at all.
 */
export default function BatchTag({ pages, onClose }) {
  const { tagPage } = usePrivateJournal();
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const page = pages[index];
  const remaining = pages.length - index;

  const advance = () => {
    setSelected([]);
    setError(null);
    if (index + 1 >= pages.length) onClose?.();
    else setIndex(index + 1);
  };

  const save = async () => {
    if (!selected.length) return advance();
    setBusy(true);
    try {
      await tagPage(page.id, selected.map((slug) => ({ emotion_id: slug, strength: 7 })));
      advance();
    } catch (err) {
      setError(err.message || "Couldn't save these tags.");
    } finally {
      setBusy(false);
    }
  };

  if (!page) return null;

  return (
    <div className="jr-tagger">
      <header className="jr-tagger-head">
        <span className="jr-quiet">
          {remaining} {remaining === 1 ? "day" : "days"} unnamed
        </span>
        <button type="button" className="jr-icon-btn" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
      </header>

      <div className="jr-tagger-excerpt">
        <div className="jr-page-date">{formatLongDate(page.entry_date)}</div>
        {/* An excerpt, not the whole page — enough to remember the day by. */}
        <p>{page.text.slice(0, 320)}{page.text.length > 320 ? "…" : ""}</p>
      </div>

      <FamilyPicker selected={selected} onToggle={(slug) =>
        setSelected((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]))
      } />

      {error && <div className="jr-error">{error}</div>}

      <div className="jr-tagger-actions">
        {/* Skip is first and is not a lesser button. */}
        <button type="button" className="jr-ghost" onClick={advance} disabled={busy}>
          Skip this day
        </button>
        <button type="button" className="jr-primary" onClick={save} disabled={busy}>
          {selected.length ? (busy ? "Saving…" : "Name it") : "Leave unnamed"}
        </button>
      </div>
      <p className="jr-fineprint">
        Emotion tags are stored unencrypted — they're what your DNA reads. The
        writing above never leaves this device unsealed.
      </p>
    </div>
  );
}

function FamilyPicker({ selected, onToggle }) {
  const families = useMemo(() => getEmotionFamilies(), []);
  const [open, setOpen] = useState(null);

  return (
    <div className="jr-families">
      {families.map(({ family, emotions }) => {
        const isOpen = open === family;
        const chosen = emotions.filter(([slug]) => selected.includes(slug));
        return (
          <div key={family} className="jr-family">
            <button
              type="button"
              className="jr-family-head"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : family)}
            >
              {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
              <span>{family}</span>
              {chosen.length > 0 && !isOpen && (
                <span className="jr-family-chosen">
                  {chosen.map(([, e]) => e.label).join(", ")}
                </span>
              )}
            </button>
            {isOpen && (
              <div className="jr-family-body">
                {emotions.map(([slug, e]) => (
                  <button
                    key={slug}
                    type="button"
                    className={`jr-emo${selected.includes(slug) ? " is-on" : ""}`}
                    style={{ "--tag": e.color }}
                    onClick={() => onToggle(slug)}
                  >
                    {e.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
