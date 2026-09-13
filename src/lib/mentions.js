// @handle parsing shared between the compose autocomplete and message
// rendering in CollectionChat — a group room's only chat surface with more
// than two people to address by name.

const MENTION_TOKEN = /@([A-Za-z0-9_]{1,32})/g;

// Splits `body` into plain-text and mention segments, for rendering. A token
// only counts as a mention if it matches a real member — `@something` typed
// by someone who isn't a member (a typo, a stray "@" in prose) renders as
// plain text rather than a false highlight.
export function splitMentions(body, memberHandles) {
  const known = new Set([...memberHandles].filter(Boolean).map((h) => h.toLowerCase()));
  const parts = [];
  let last = 0;
  if (known.size) {
    for (const m of body.matchAll(MENTION_TOKEN)) {
      if (!known.has(m[1].toLowerCase())) continue;
      if (m.index > last) parts.push({ text: body.slice(last, m.index) });
      parts.push({ text: m[0], mention: true });
      last = m.index + m[0].length;
    }
  }
  if (last < body.length) parts.push({ text: body.slice(last) });
  return parts;
}

// The `@partial` token immediately before `caret`, if the reader is mid-typing
// one — null otherwise. Used to drive the autocomplete: it only opens right
// after an unbroken "@word" run, not for any "@" anywhere in the draft.
export function activeMentionQuery(text, caret) {
  const upTo = text.slice(0, caret);
  const m = upTo.match(/(?:^|\s)@([A-Za-z0-9_]{0,32})$/);
  return m ? m[1] : null;
}

// Replace that trailing "@partial" with the full "@handle " — cursor lands
// right after the inserted space, ready to keep typing.
export function insertMention(text, caret, handle) {
  const upTo = text.slice(0, caret);
  const start = upTo.lastIndexOf("@");
  const inserted = `@${handle} `;
  return {
    text: text.slice(0, start) + inserted + text.slice(caret),
    caret: start + inserted.length,
  };
}
