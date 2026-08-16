import { useEffect, useRef, useState } from "react";
import Modal from "../Modal";
import CollectionSharing from "./CollectionSharing";
import { Link } from "react-router-dom";
import { EMOTIONS } from "../../services/emotions";
import {
  createCollection, deleteCollection, addCollectionItem, removeCollectionItem, reorderCollection,
  addCollectionBook, removeCollectionBook,
} from "../../services/api";
import "./CollectionsEditor.css";

/**
 * Curated collections — self-expression, not metrics. [F2.8 / §Feature 2]
 *
 * Two objects, deliberately separated: the CARD is what a collection looks like
 * on the shelf (spines, name, count, who can see it), and the DRAWER is where you
 * work on it. They used to be one component, which meant a collection with twelve
 * books was a metre of page and no grid could hold it.
 *
 * Reorder stays keyboard-operable (up/down buttons), NOT drag-only — the
 * blueprint's a11y requirement, and the reason the editing UI moved into a Modal
 * rather than a bespoke popover: focus trap, Esc, and focus restore come with it.
 */
// "public" is deliberately absent. Nothing anonymous can read a profile — the
// only unauthenticated route in the API is the share-token DNA card, which is a
// capability link and ignores visibility entirely — so `public` selected exactly
// the same audience as `community` while implying a wider one. Collections
// already stored as public keep working and still render their own badge; this
// only stops new ones being created under a label that promises more than it does.
const VIS = [
  { value: "private", label: "private", sub: "only you" },
  { value: "community", label: "community", sub: "any signed-in reader" },
];

// How many collections the study shows before it offers the rest. Past this the
// grid stops being a shelf you can take in at a glance.
const VISIBLE = 6;
// The spine strip is a glance, not an inventory.
const MAX_SPINES = 8;

function move(arr, from, to) {
  const next = arr.slice();
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x);
  return next;
}

const emoColor = (slug) => (slug && EMOTIONS[slug]?.color) || "var(--ink-ghost)";

/** The shelf view of a collection: its spines and its name. No controls — the
 *  whole card is one button, so there is no nested-interactive ambiguity. */
function CollectionCard({ collection, onOpen }) {
  const books = collection.books || [];
  const spines = books.slice(0, MAX_SPINES);
  const n = books.length;

  return (
    <button
      type="button"
      className="col-card"
      onClick={onOpen}
      aria-label={`${collection.title} — ${n} ${n === 1 ? "volume" : "volumes"}, ${collection.visibility}. Open to edit.`}
    >
      <span className="col-spines" aria-hidden="true">
        {spines.length > 0 ? spines.map((b, i) => (
          <span
            key={b.entry_id || b.book_id}
            className="col-spine"
            style={{ background: emoColor(b.dominant_emotion), height: `${72 + ((i * 37) % 29)}%` }}
          />
        )) : <span className="col-spines-empty" />}
      </span>

      <span className="col-title">{collection.title}</span>
      {collection.description && <span className="col-desc">{collection.description}</span>}

      <span className="col-foot">
        <span>{n} {n === 1 ? "volume" : "volumes"}</span>
        <span className={`col-vis col-vis--${collection.visibility}`}>{collection.visibility}</span>
      </span>
    </button>
  );
}

/**
 * The add-a-book picker: a listbox with its own search field INSIDE the popup.
 *
 * A native `<select>` cannot hold a text input, and a shelf of any size turns it
 * into a scroll-and-squint exercise — which is the whole reason this is hand-
 * built rather than the one-liner it replaces. A filter box sitting outside the
 * control was the wrong shape: you type in one place and hunt in another, and
 * the closed select still says nothing about what you narrowed it to.
 *
 * So: trigger button → popup containing the search field and the filtered list.
 * The field takes focus on open, which makes typing the default action; the
 * arrow keys and Enter work from inside it, so the list never needs focus of its
 * own. Matching is over title AND author — "yarros" is as likely a way to look
 * for a book as its title is.
 */
function BookPicker({ options, value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  const q = query.trim().toLowerCase();
  const matches = q
    ? options.filter((e) => `${e.title || ""} ${e.author || ""}`.toLowerCase().includes(q))
    : options;
  const selected = options.find((e) => String(e.id) === String(value)) || null;
  const empty = options.length === 0;

  // Pointerdown, not click: a mousedown inside the drawer that ends elsewhere
  // should still count as "went somewhere else". Capture phase so a stray
  // stopPropagation in between cannot leave the popup stuck open.
  useEffect(() => {
    if (!open) return;
    const away = (e) => { if (!rootRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", away, true);
    return () => document.removeEventListener("pointerdown", away, true);
  }, [open]);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  const choose = (book) => {
    onChange(String(book.id));
    setOpen(false);
    setQuery("");
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (matches.length === 0) return;
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (i + step + matches.length) % matches.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (matches[active]) choose(matches[active]);
    } else if (e.key === "Escape") {
      // The drawer is a Modal and Escape closes it. Closing the popup is the
      // narrower, more recent thing the reader opened, so it eats the key.
      e.stopPropagation();
      setOpen(false);
    }
  };

  const label = empty
    ? "every book is already here"
    : selected
      ? `${selected.title}${selected.author ? ` — ${selected.author}` : ""}`
      : "choose a book from your shelf…";

  return (
    <div className="col-picker" ref={rootRef}>
      <button
        type="button"
        className={`col-picker-trigger ${selected ? "" : "is-empty"}`}
        onClick={() => { setActive(0); setOpen((v) => !v); }}
        disabled={disabled || empty}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Choose a book from your shelf"
      >
        <span className="col-picker-label">{label}</span>
        <span className="col-picker-caret" aria-hidden="true">▾</span>
      </button>

      {open && (
        <div className="col-picker-pop">
          <input
            ref={inputRef}
            type="text"
            className="col-picker-search"
            placeholder="search by title or author…"
            aria-label="Search your shelf by title or author"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0); }}
            onKeyDown={onKeyDown}
          />
          {matches.length === 0 ? (
            <p className="col-picker-none">nothing matches “{query.trim()}”</p>
          ) : (
            <ul className="col-picker-list" role="listbox" aria-label="Books on your shelf">
              {matches.map((e, i) => (
                <li key={e.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={String(e.id) === String(value)}
                    className={`col-picker-opt ${i === active ? "is-active" : ""}`}
                    // Mouse over should move the highlight the keyboard uses,
                    // or the two disagree about what Enter would pick.
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(e)}
                  >
                    <span className="col-picker-opt-title">{e.title}</span>
                    {e.author && <span className="col-picker-opt-author">{e.author}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/** The working view. Everything that changes a collection lives in here. */
function CollectionDrawer({ collection, shelf, onChanged, onClose }) {
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const books = collection.books || [];
  // A card added by a member has no entry_id here, so identity is "whichever id
  // it has". Without this the same book could be offered for adding twice.
  const inIds = new Set(books.flatMap((b) => [b.entry_id, b.book_id].filter(Boolean)));
  const addable = shelf.filter(
    (e) => !inIds.has(e.id) && !inIds.has(String(e.id)) && !inIds.has(e.book_id),
  );

  const run = async (fn) => { setBusy(true); try { await fn(); await onChanged(); } finally { setBusy(false); } };

  const addBook = async () => {
    if (!pick) return;
    // Add by CANONICAL book id when the entry resolved to one (#5). An item
    // keyed only by entry_id belongs to one reader's library: members can't see
    // it, and it never appears in the collection's discussion, because that is
    // anchored to books. Entries that never matched the catalog (book_id null)
    // still take the legacy path — it is the only identity they have.
    const entry = shelf.find((e) => String(e.id) === String(pick));
    await run(() => (entry?.book_id
      ? addCollectionBook(collection.id, entry.book_id)
      : addCollectionItem(collection.id, pick)));
    setPick("");
  };

  const reorder = (from, to) => {
    if (to < 0 || to >= books.length) return;
    // Reorder is still entry-keyed server-side; member-added books have no
    // entry to name, so they hold their position rather than being dropped.
    const ids = books.map((b) => b.entry_id).filter(Boolean);
    if (ids.length === books.length) {
      run(() => reorderCollection(collection.id, move(ids, from, to)));
    }
  };

  const remove = async () => {
    await run(() => deleteCollection(collection.id));
    onClose();
  };

  return (
    <Modal title={collection.title} onClose={onClose} className="col-drawer">
      <div className="col-drawer-head">
        <span className={`col-vis col-vis--${collection.visibility}`}>{collection.visibility}</span>
        {collection.description && <span className="col-drawer-desc">{collection.description}</span>}
      </div>

      {books.length > 0 ? (
        <ul className="col-books">
          {books.map((b, i) => (
            <li key={b.entry_id || b.book_id} className="col-book">
              <span className="col-book-dot" style={{ background: emoColor(b.dominant_emotion) }} />
              <span className="col-book-title">{b.title}</span>
              {b.author && <span className="col-book-author">{b.author}</span>}
              <span className="col-book-actions">
                <button disabled={busy || i === 0} onClick={() => reorder(i, i - 1)} aria-label={`Move ${b.title} up`}>↑</button>
                <button disabled={busy || i === books.length - 1} onClick={() => reorder(i, i + 1)} aria-label={`Move ${b.title} down`}>↓</button>
                {/* Mirror of the add path: remove by book when the item has
                    one, by entry for legacy rows. */}
                <button disabled={busy} onClick={() => run(() => (b.book_id
                  ? removeCollectionBook(collection.id, b.book_id)
                  : removeCollectionItem(collection.id, b.entry_id)))} aria-label={`Remove ${b.title}`}>remove</button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="col-empty">Nothing on this shelf yet.</p>
      )}

      <div className="col-add">
        <BookPicker
          options={addable}
          value={pick}
          onChange={setPick}
          disabled={busy}
        />
        <button className="btn brass" disabled={busy || !pick} onClick={addBook}>add</button>
      </div>

      {/* A LINK, not the conversation itself [#6]. Chats grow; this drawer is a
          fold inside a modal on the profile page, and hosting a long thread in
          it meant a message list boxed into a few hundred pixels. The room gets
          its own page, which scrolls like any other page of text. */}
      <div className="col-chat-link-row">
        <Link
          className="col-chat-link"
          to={`/collections/${collection.id}/discussion`}
          state={{ title: collection.title }}
        >
          Discussion →
        </Link>
        <span className="col-chat-link-hint">Talk about these books with the others here.</span>
      </div>

      {/* Who's in it and the link that lets more people in [#5]. */}
      <CollectionSharing
        collection={collection}
        onLeft={() => { onChanged(); onClose(); }}
      />

      <div className="col-drawer-foot">
        {confirmDelete ? (
          <>
            <span className="col-drawer-warn">Delete “{collection.title}”? The books stay on your shelf.</span>
            <button className="btn ghost" disabled={busy} onClick={() => setConfirmDelete(false)}>keep it</button>
            <button className="col-del" disabled={busy} onClick={remove}>delete</button>
          </>
        ) : (
          <>
            <button className="col-del" onClick={() => setConfirmDelete(true)}>delete collection</button>
            <button className="btn ghost" onClick={onClose}>done</button>
          </>
        )}
      </div>
    </Modal>
  );
}

function NewCollection({ onClose, onChanged }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState("private");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    try {
      await createCollection({ title: title.trim(), description: description.trim() || null, visibility });
      await onChanged();
      onClose();
    } finally { setBusy(false); }
  };

  return (
    <Modal title="Start a shelf" onClose={onClose} className="col-drawer">
      <div className="cols-new">
        <input
          className="cols-new-title"
          placeholder="Name it badly on purpose — e.g. “books that ruined me”"
          value={title}
          maxLength={120}
          aria-label="Collection name"
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          className="cols-new-title"
          placeholder="A line about it (optional)"
          value={description}
          maxLength={280}
          aria-label="Collection description"
          onChange={(e) => setDescription(e.target.value)}
        />
        <label className="cols-new-vislabel">
          who sees it
          <select className="cols-new-vis" value={visibility} onChange={(e) => setVisibility(e.target.value)} aria-label="Collection visibility">
            {VIS.map((v) => <option key={v.value} value={v.value}>{v.label} — {v.sub}</option>)}
          </select>
        </label>
      </div>
      <div className="col-drawer-foot">
        <button className="btn ghost" disabled={busy} onClick={onClose}>cancel</button>
        <button className="btn brass" disabled={busy || !title.trim()} onClick={create}>create</button>
      </div>
    </Modal>
  );
}

export default function CollectionsEditor({ collections, shelf, onChanged }) {
  const [openId, setOpenId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Read the open collection back out of the LIVE list rather than holding a
  // copy: every edit reloads the profile, and a copy would show the drawer its
  // own stale contents. If it was deleted underneath us, the drawer closes.
  const open = collections.find((c) => c.id === openId) || null;
  const shown = expanded ? collections : collections.slice(0, VISIBLE);
  const hidden = collections.length - shown.length;

  return (
    <div className="cols">
      {collections.length === 0 && (
        <p className="cols-empty">
          Collections are where your personality lives — “books that rearranged me,” “comfort re-reads.”
          Curate a shelf of your own.
        </p>
      )}

      <div className="cols-grid">
        {shown.map((c) => (
          <CollectionCard key={c.id} collection={c} onOpen={() => setOpenId(c.id)} />
        ))}

        <button type="button" className="cols-new-card" onClick={() => setCreating(true)}>
          <span className="cols-new-card-label">+ start a shelf</span>
          <span className="cols-new-card-blurb">Name it badly on purpose. Nobody sees it unless you say so.</span>
        </button>
      </div>

      {/* Expanding was one-way; the same control now closes it again. */}
      {(hidden > 0 || expanded) && (
        <button type="button" className="cols-more" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
          {expanded ? "← show fewer" : `all ${collections.length} collections →`}
        </button>
      )}

      {open && (
        <CollectionDrawer
          collection={open}
          shelf={shelf}
          onChanged={onChanged}
          onClose={() => setOpenId(null)}
        />
      )}
      {creating && <NewCollection onClose={() => setCreating(false)} onChanged={onChanged} />}
    </div>
  );
}
