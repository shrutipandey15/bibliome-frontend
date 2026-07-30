import { useDeferredValue, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { usePrivateJournal } from "../../contexts/PrivateJournalContext";
import { formatLongDate } from "./BlankPage";

/**
 * Search — client-side, and the UI says so out loud.
 *
 * There is no server search endpoint and there cannot be one: the server holds
 * ciphertext and no key, so "search my journal" is not a feature we haven't
 * built, it's an operation that is arithmetically impossible for us to perform
 * (contract §4). What runs below is a substring filter over the pages this tab
 * has already decrypted.
 *
 * The scope line under the box is not a disclaimer to be tucked away. A user who
 * thinks they searched their whole journal and got nothing will conclude they
 * never wrote it. Better to be plain about what was actually searched.
 */
export default function JournalSearch({ onOpenDay }) {
  const { search, pages, loading } = usePrivateJournal();
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const results = useMemo(() => search(deferred), [search, deferred]);

  return (
    <div className="jr-search">
      <label className="jr-search-box">
        <Search size={16} />
        <input
          className="jr-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a word you wrote"
          autoComplete="off"
          aria-label="Search your journal"
        />
      </label>

      <p className="jr-fineprint">
        {loading
          ? "Decrypting your pages…"
          : `Searching ${pages.length} ${pages.length === 1 ? "page" : "pages"} decrypted on this device. ` +
            "Nothing is sent to the server — it holds only sealed text and couldn't search it if we asked."}
      </p>

      {deferred.trim() && (
        <div className="jr-search-results">
          {results.length === 0 ? (
            <div className="jr-quiet">No page on this device contains that.</div>
          ) : (
            results.map((page) => (
              <button
                key={page.id}
                type="button"
                className="jr-result"
                onClick={() => onOpenDay?.(page)}
              >
                <span className="jr-result-date">{formatLongDate(page.entry_date)}</span>
                <span className="jr-result-snippet">{snippet(page.text, deferred)}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/** A window around the first hit, so the result shows the sentence rather than
 *  the opening of the day. */
function snippet(text, query, radius = 90) {
  const at = text.toLowerCase().indexOf(query.trim().toLowerCase());
  if (at === -1) return text.slice(0, radius * 2);
  const start = Math.max(0, at - radius);
  const end = Math.min(text.length, at + query.length + radius);
  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}
