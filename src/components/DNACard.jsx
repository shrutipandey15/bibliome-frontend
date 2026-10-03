import Bloom from "./card/Bloom";
import {
  applyChoices, article, booksLabel, displayName, leaningLine, nameLines,
} from "./card/cardModel";
import "./DNACard.css";

/**
 * The reading DNA card, in the page (DNA card spec, "In-app card").
 *
 * The same design as the images people post — the archetype's ground, the
 * bloom, "I'm a Grief Romantic.", the share line, three numbers, the red flag —
 * at phone width, with height that grows with its content. It used to be a
 * fixed 2 : 2.92 plate with overflow hidden, which cut it off mid-word on
 * phones; nothing here can clip now. It is real text, not an image, so screen
 * readers and zoom work, and the bloom carries its own description.
 *
 * `card` is the backend's card payload (dna_card.card_payload_from). A
 * stranger's copy arrives with the reader's switches already applied; the
 * owner's carries `choices`, applied here so the DNA tab shows what strangers
 * see. `children` sit under the card (actions, the archetype's description).
 */
export default function DNACard({ card, children = null, headingLevel = 2 }) {
  if (!card?.archetype) return null;
  const c = applyChoices(card);
  const a = c.archetype;
  const pal = c.palette || {};
  const lines = nameLines(a.name);
  const leaning = leaningLine(c);
  const top = c.bloom?.top || [];
  const H = `h${headingLevel}`;

  return (
    <div className="dnacard-wrap">
      <article
        className="dnacard"
        aria-label={`Reading DNA card: ${a.name}`}
        style={{
          "--dc-top": pal.top, "--dc-bottom": pal.bottom,
          "--dc-accent": pal.accent, "--dc-ink": pal.ink,
        }}
      >
        <div className="dnacard-head">
          <span>MY READING DNA</span>
          <span>{booksLabel(c.tagged_count ?? c.book_count)}{c.year ? ` · ${c.year}` : ""}</span>
        </div>

        <div className="dnacard-bloom">
          <Bloom bloom={c.bloom} />
          {c.season && (
            <div className="dnacard-sticker" aria-label={c.season.home
              ? "In my element: my season matches my archetype"
              : `Now in ${article(c.season)} ${displayName(c.season.name)} season`}
            >
              {c.season.home ? (
                <><span>in my</span><em>element</em></>
              ) : (
                <><span>now in {article(c.season)}</span><em>{displayName(c.season.name)}</em><span>season</span></>
              )}
            </div>
          )}
        </div>

        <div className="dnacard-kicker">I'm {article(a)}</div>
        <H className="dnacard-name">
          {lines.map((l, i) => (
            i === lines.length - 1 ? <em key={i}>{l}</em> : <span key={i}>{l}</span>
          ))}
        </H>
        {leaning && <p className="dnacard-leaning">{leaning}</p>}
        {a.share_line && <p className="dnacard-line">{a.share_line}</p>}

        {top.length > 0 && (
          <div className="dnacard-numbers">
            <div className="dnacard-label">what my books did to me</div>
            <ul>
              {top.map((t) => (
                <li key={t.slug}><b>{t.count}</b> <span>{t.label}</span></li>
              ))}
            </ul>
          </div>
        )}

        {c.red_flag && (
          <p className="dnacard-flag"><span className="dnacard-chip">red flag</span> {c.red_flag}</p>
        )}
      </article>
      {children}
    </div>
  );
}
