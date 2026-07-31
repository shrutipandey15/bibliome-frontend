import { useEffect, useMemo, useRef, useState } from "react";
import { usePrivateJournal, todayISO } from "../../contexts/PrivateJournalContext";

/**
 * Screen 1 — the blank page.
 *
 * No title field, no toolbar, no save button, no mood picker. The cursor is in
 * the text when the screen arrives. Everything a journal app usually puts here
 * is a small decision demanded before the first sentence, and the first sentence
 * is the only thing that matters.
 *
 * The page is now a bound sheet with a ruled margin, and the things that are
 * *about* writing rather than part of it — the week, the unnamed days, the
 * promise about the key — sit on a desk column beside it. They used to be either
 * floating over the viewport (the save whisper) or stacked above the text as a
 * bar you read past to get to the cursor (the unnamed-days prompt).
 *
 * The one piece of chrome on the sheet itself is the save whisper, and it is
 * chrome because it is load-bearing: an app that silently eats writing is worse
 * than one with a save button. See `SaveWhisper` for why it says what it says.
 */
export default function BlankPage({ prompt = null, onNameDay }) {
  const { byDate, openDraft, writeDraft, flushNow } = usePrivateJournal();
  const date = todayISO();

  // Today's page, if there is one. A day can hold several passes in the schema;
  // the writing surface continues the most recent one rather than starting a
  // fresh entry every visit — reopening a day should feel like turning back to
  // it, not filing a second report.
  const existing = useMemo(() => {
    const group = byDate.find((g) => g.date === date);
    return group?.items?.[group.items.length - 1] || null;
  }, [byDate, date]);

  const [text, setText] = useState("");
  const openedFor = useRef(null);
  const areaRef = useRef(null);

  useEffect(() => {
    // Open once per day, and only once. Keying this on the entry id instead
    // would re-open the moment the first save returns an id — overwriting
    // whatever was typed during the round trip with the server's older echo.
    // The autosave chain owns the id from then on.
    if (openedFor.current === date) return;
    openedFor.current = date;
    setText(existing?.text || "");
    openDraft(date, existing?.text || "", existing?.id || null);
    const el = areaRef.current;
    if (el) {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  }, [date, existing, openDraft]);

  // Autosize: the page grows with the writing instead of becoming a scrolling
  // box inside a scrolling page.
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);

  const words = countWords(text);

  return (
    <div className="jr-today">
      <div className="jr-page jr-sheet">
        <div className="jr-sheet-head">
          <span className="jr-page-date">{formatLongDate(date)}</span>
          <SaveWhisper />
        </div>
        <textarea
          ref={areaRef}
          className="jr-writing"
          value={text}
          spellCheck
          // Never autofocus-scroll the whole window; the ref handles focus.
          onChange={(e) => { setText(e.target.value); writeDraft(date, e.target.value, existing?.id || null); }}
          onBlur={() => flushNow()}
          placeholder="Start anywhere."
          aria-label={`Journal entry for ${formatLongDate(date)}`}
        />
        <div className="jr-sheet-foot">
          {/* A count, not a target. Nothing here congratulates or scolds. */}
          <span className="jr-words">{words} {words === 1 ? "word" : "words"}</span>
          {existing && (
            <button type="button" className="jr-link" onClick={() => onNameDay?.(existing)}>
              name this day
            </button>
          )}
        </div>
      </div>

      <aside className="jr-aside">
        <div className="jr-aside-label">this week</div>
        <WeekStrip byDate={byDate} today={date} />
        {prompt}
        <p className="jr-aside-note">
          No one can read this page but you — not us, not the server. Lose the key
          and it's gone for good.
        </p>
      </aside>
    </div>
  );
}

/**
 * Seven marks, one per day. Deliberately not a streak: there is no number, no
 * flame, no "you broke a 12-day run". A gap is visible and nothing comments on
 * it, which is the most a journal should say about the days you didn't write.
 */
function WeekStrip({ byDate, today }) {
  const days = useMemo(() => {
    const written = new Set(byDate.filter((g) => g.items?.length).map((g) => g.date));
    const [y, m, d] = today.split("-").map(Number);
    const end = new Date(y, m - 1, d);
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(end);
      day.setDate(end.getDate() - (6 - i));
      const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
      return {
        iso,
        label: day.toLocaleDateString(undefined, { weekday: "narrow" }),
        title: day.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" }),
        written: written.has(iso),
        isToday: iso === today,
      };
    });
  }, [byDate, today]);

  return (
    <div className="jr-week">
      {days.map((d) => (
        <div className="jr-week-day" key={d.iso}>
          <div
            className={`jr-week-mark${d.written ? " written" : ""}${d.isToday ? " today" : ""}`}
            title={`${d.title} — ${d.written ? "written" : "nothing written"}`}
          />
          <div className="jr-week-label">{d.label}</div>
        </div>
      ))}
    </div>
  );
}

/**
 * The whisper has to be true, which rules out the usual implementation.
 *
 * "Saved" appears only after the server has acknowledged the write — not when
 * the debounce fires, not when the request leaves. If the write fails, it says
 * so and stays saying so; a journal that shows "saved" over words that never
 * left the tab is the one unforgivable bug in this feature.
 */
function SaveWhisper() {
  const { saveState, saveError, flushNow } = usePrivateJournal();
  if (saveState === "idle") return <div className="jr-whisper" aria-hidden="true" />;

  if (saveState === "error") {
    return (
      <div className="jr-whisper jr-whisper-error" role="status">
        Not saved — {saveError?.kind === "offline" ? "you're offline" : "the server refused"}.
        Your words are still on this page.
        <button type="button" className="jr-link" onClick={() => flushNow()}>Try again</button>
      </div>
    );
  }

  return (
    <div className="jr-whisper" role="status" aria-live="polite">
      {saveState === "saving" ? "saving…" : "saved"}
    </div>
  );
}

export function countWords(text) {
  const t = (text || "").trim();
  return t ? t.split(/\s+/).length : 0;
}

export function formatLongDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}
