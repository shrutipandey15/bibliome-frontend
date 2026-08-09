import { useState } from "react";
import Modal from "../Modal";
import { EMOTIONS } from "../../services/emotions";
import {
  createCollection, deleteCollection, addCollectionItem, removeCollectionItem, reorderCollection,
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
const VIS = [
  { value: "private", label: "private" },
  { value: "community", label: "community" },
  { value: "public", label: "public" },
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
            key={b.entry_id}
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

/** The working view. Everything that changes a collection lives in here. */
function CollectionDrawer({ collection, shelf, onChanged, onClose }) {
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const books = collection.books || [];
  const inIds = new Set(books.map((b) => b.entry_id));
  const addable = shelf.filter((e) => !inIds.has(e.id) && !inIds.has(String(e.id)));

  const run = async (fn) => { setBusy(true); try { await fn(); await onChanged(); } finally { setBusy(false); } };

  const addBook = async () => {
    if (!pick) return;
    await run(() => addCollectionItem(collection.id, pick));
    setPick("");
  };

  const reorder = (from, to) => {
    if (to < 0 || to >= books.length) return;
    run(() => reorderCollection(collection.id, move(books.map((b) => b.entry_id), from, to)));
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
            <li key={b.entry_id} className="col-book">
              <span className="col-book-dot" style={{ background: emoColor(b.dominant_emotion) }} />
              <span className="col-book-title">{b.title}</span>
              {b.author && <span className="col-book-author">{b.author}</span>}
              <span className="col-book-actions">
                <button disabled={busy || i === 0} onClick={() => reorder(i, i - 1)} aria-label={`Move ${b.title} up`}>↑</button>
                <button disabled={busy || i === books.length - 1} onClick={() => reorder(i, i + 1)} aria-label={`Move ${b.title} down`}>↓</button>
                <button disabled={busy} onClick={() => run(() => removeCollectionItem(collection.id, b.entry_id))} aria-label={`Remove ${b.title}`}>remove</button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="col-empty">Nothing on this shelf yet.</p>
      )}

      <div className="col-add">
        <select className="col-add-select" value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Choose a book from your shelf" disabled={addable.length === 0}>
          <option value="">{addable.length === 0 ? "every book is already here" : "choose a book from your shelf…"}</option>
          {addable.map((e) => <option key={e.id} value={e.id}>{e.title}{e.author ? ` — ${e.author}` : ""}</option>)}
        </select>
        <button className="btn brass" disabled={busy || !pick} onClick={addBook}>add</button>
      </div>

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
            {VIS.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
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

      {hidden > 0 && (
        <button type="button" className="cols-more" onClick={() => setExpanded(true)}>
          all {collections.length} collections →
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
