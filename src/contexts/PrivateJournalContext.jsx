import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  createJournalEntry,
  deleteJournalEntry,
  getAllJournalEntries,
  setJournalEntryTags,
  updateJournalEntry,
} from "../services/api";
import { decryptEntry, encryptEntry } from "../services/journalCrypto";
import { useJournalKey } from "./JournalKeyContext";

/**
 * The journal's pages, decrypted, in memory.
 *
 * Everything here holds plaintext, which is the reason it is a separate file
 * from JournalKeyContext: the key never enters this module except as a value
 * fetched from `getDek()` at the instant of an encrypt or decrypt call.
 *
 * Nothing in here is cached to disk. The book-entry cache in services/offline.js
 * writes to localStorage — appropriate for book titles, catastrophic for journal
 * prose, because localStorage survives the tab and is readable by any XSS. The
 * pages live in React state and die with the tab, same as the key.
 */

const PrivateJournalContext = createContext(null);

export function usePrivateJournal() {
  const ctx = useContext(PrivateJournalContext);
  if (!ctx) throw new Error("usePrivateJournal must be used inside PrivateJournalProvider");
  return ctx;
}

// Long enough that it isn't saving mid-word, short enough that closing the tab
// after a thought doesn't lose it.
const AUTOSAVE_MS = 1200;

export function todayISO() {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function PrivateJournalProvider({ children }) {
  const { status, getDek, keyEpoch } = useJournalKey();
  const unlocked = status === "unlocked";

  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  // Pages whose ciphertext this key could not open — sealed under a rotated key,
  // or damaged. Surfaced, never silently dropped: a journal that quietly loses
  // days is worse than one that admits it.
  const [unreadable, setUnreadable] = useState([]);

  // "idle" | "saving" | "saved" | "error". The whisper on screen renders this
  // directly, and it only says "saved" after the server has acknowledged the
  // write — never optimistically, because the one thing a journal must not lie
  // about is whether the words survived.
  const [saveState, setSaveState] = useState("idle");
  const [saveError, setSaveError] = useState(null);

  // ── Load + decrypt ──
  const load = useCallback(async () => {
    const dek = getDek();
    if (!dek) return;
    setLoading(true);
    setLoadError(null);
    try {
      const { entries } = await getAllJournalEntries();
      const opened = [];
      const failed = [];
      for (const e of entries) {
        try {
          opened.push({
            id: e.id,
            entry_date: e.entry_date,
            text: await decryptEntry(dek, e.ciphertext, e.nonce),
            emotions: e.emotions || [],
            key_version: e.key_version,
            updated_at: e.updated_at,
          });
        } catch {
          failed.push({ id: e.id, entry_date: e.entry_date, key_version: e.key_version });
        }
      }
      setPages(opened);
      setUnreadable(failed);
    } catch (err) {
      setLoadError(err);
    }
    setLoading(false);
  }, [getDek]);

  useEffect(() => {
    if (!unlocked) {
      // Locking drops the plaintext too. Leaving decrypted prose in state behind
      // a lock screen would make the lock decorative.
      setPages([]);
      setUnreadable([]);
      setSaveState("idle");
      return;
    }
    load();
  }, [unlocked, keyEpoch, load]);

  // ── Autosave ──
  // Writes are serialized through one promise chain. Without it, the first
  // keystroke's POST and the second's PUT race, and a slow POST means two
  // entries for the same day — a duplicate the schema permits (a day can hold
  // several passes) and so would never catch.
  const chainRef = useRef(Promise.resolve());
  const timerRef = useRef(null);
  const draftRef = useRef({ date: null, text: "", id: null });
  const savedTextRef = useRef("");

  const flushNow = useCallback(async () => {
    clearTimeout(timerRef.current);
    const dek = getDek();
    const { date, text } = draftRef.current;
    if (!dek || !date) return;
    if (text === savedTextRef.current) return;

    chainRef.current = chainRef.current.then(async () => {
      const pending = draftRef.current.text;
      if (pending === savedTextRef.current) return;
      setSaveState("saving");
      try {
        const { ciphertext, nonce } = await encryptEntry(dek, pending);
        let saved;
        if (draftRef.current.id) {
          saved = await updateJournalEntry(draftRef.current.id, {
            ciphertext, nonce, entry_date: date,
          });
        } else if (pending.trim() === "") {
          // Nothing written yet. An empty page is not a page; don't create one.
          setSaveState("idle");
          return;
        } else {
          saved = await createJournalEntry({
            entry_date: date, ciphertext, nonce, key_version: 1, emotions: [],
          });
          draftRef.current.id = saved.id;
        }
        savedTextRef.current = pending;
        setPages((prev) => {
          const page = {
            id: saved.id,
            entry_date: saved.entry_date,
            text: pending,
            emotions: saved.emotions || [],
            key_version: saved.key_version,
            updated_at: saved.updated_at,
          };
          const idx = prev.findIndex((p) => p.id === saved.id);
          if (idx === -1) return [page, ...prev];
          const next = [...prev];
          next[idx] = page;
          return next;
        });
        // Only now. The whisper is a claim about the server, not about intent.
        setSaveState(draftRef.current.text === pending ? "saved" : "saving");
        setSaveError(null);
      } catch (err) {
        setSaveError(err);
        setSaveState("error");
      }
    });
    return chainRef.current;
  }, [getDek]);

  /** Called on every keystroke. Debounced; the caller owns the textarea. */
  const writeDraft = useCallback((date, text, entryId = null) => {
    if (draftRef.current.date !== date) {
      draftRef.current = { date, text, id: entryId };
      savedTextRef.current = entryId ? text : "";
    } else {
      draftRef.current.text = text;
      if (entryId) draftRef.current.id = entryId;
    }
    if (text !== savedTextRef.current) setSaveState("saving");
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flushNow, AUTOSAVE_MS);
  }, [flushNow]);

  /** Point the draft at an existing page (or a fresh one) without marking it
   *  dirty — used when the writing surface opens onto a day already written. */
  const openDraft = useCallback((date, text, entryId) => {
    clearTimeout(timerRef.current);
    draftRef.current = { date, text: text || "", id: entryId || null };
    savedTextRef.current = text || "";
    setSaveState("idle");
  }, []);

  // Unsaved words at teardown get one last chance. Nothing here can await, so
  // this is best-effort by nature — the 1.2s debounce is what actually keeps the
  // window small.
  useEffect(() => {
    const onHide = () => {
      if (draftRef.current.text !== savedTextRef.current) flushNow();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
      clearTimeout(timerRef.current);
    };
  }, [flushNow]);

  // ── Tags ──
  // Plaintext, by design (contract §2): the DNA runs on tags and never on prose.
  // No decrypt/re-encrypt round trip, which is what makes naming a day cheap.
  const tagPage = useCallback(async (id, emotions) => {
    const saved = await setJournalEntryTags(id, emotions);
    setPages((prev) => prev.map((p) => (p.id === id ? { ...p, emotions: saved.emotions || [] } : p)));
    return saved;
  }, []);

  const removePage = useCallback(async (id) => {
    await deleteJournalEntry(id);
    setPages((prev) => prev.filter((p) => p.id !== id));
    if (draftRef.current.id === id) {
      draftRef.current = { date: null, text: "", id: null };
      savedTextRef.current = "";
    }
  }, []);

  // ── Derived ──
  const byDate = useMemo(() => {
    const groups = new Map();
    for (const p of [...pages].sort((a, b) => (a.entry_date < b.entry_date ? 1 : -1))) {
      if (!groups.has(p.entry_date)) groups.set(p.entry_date, []);
      groups.get(p.entry_date).push(p);
    }
    return [...groups.entries()].map(([date, items]) => ({ date, items }));
  }, [pages]);

  const untagged = useMemo(
    () => pages.filter((p) => !p.emotions?.length && p.text.trim() !== ""),
    [pages]
  );

  /** Client-side search — the only kind there is or can be (contract §4). Runs
   *  over the pages already decrypted in this tab, which is exactly the honest
   *  scope: this device, this session, what's been loaded. */
  const search = useCallback((query) => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return pages
      .filter((p) => p.text.toLowerCase().includes(q))
      .sort((a, b) => (a.entry_date < b.entry_date ? 1 : -1));
  }, [pages]);

  return (
    <PrivateJournalContext.Provider value={{
      pages, byDate, untagged, unreadable,
      loading, loadError, saveState, saveError,
      writeDraft, openDraft, flushNow, tagPage, removePage, search, reload: load,
    }}>
      {children}
    </PrivateJournalContext.Provider>
  );
}
