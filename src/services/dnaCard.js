/**
 * The card payload's shape, in one place.
 *
 * Lives beside the API contract rather than inside DNACard so that a page can ask
 * "is there a card to show?" without importing the component (and so mocking the
 * component in a test doesn't take the question with it).
 */

/**
 * The archetype block, whichever surface handed us the card.
 *
 * The backend now serves ONE card shape from one engine (`archetype`); the older
 * `personality` key is still read so a page rendering a payload cached before that
 * change doesn't blank out. Null is a legitimate answer — a reader can be past the
 * book gate and still have a tally that names nobody — so every caller has to
 * handle it rather than assume a label exists.
 */
export function cardArchetype(profile) {
  return profile?.archetype || profile?.personality || null;
}
