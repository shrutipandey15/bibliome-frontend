// The 8 reading archetypes, as content.
//
// SOURCE OF TRUTH for id / name / tagline / primary / anti / blindSpots /
// tropes is the backend's app/services/dna_engine.py PERSONALITY_TYPES. Those
// fields are copied verbatim — do not paraphrase them here, and do not invent a
// ninth archetype: a reader can only ever be assigned one the engine returns.
// `sections` is original page copy and is owned by this file.
//
// Deliberately dependency-free (no React, no lucide, no CSS): vite.config.js
// imports this module in Node to prerender each page, so anything it pulls in
// has to survive outside a browser.

export const ARCHETYPES = [
  {
    slug: "grief-romantic",
    id: "grief_romantic",
    name: "The Grief Romantic",
    color: "#3A5A6B",
    glyph: "◈",
    tagline:
      "You seek books that break your heart because feeling deeply is how you know you're alive. Loss isn't your enemy — numbness is.",
    blurb:
      "The Grief Romantic is the Bibliome reading archetype for readers who go looking for the book that will break them. What produces it, what it reaches for, and what it quietly refuses.",
    primary: ["grief", "catharsis", "devastation"],
    anti: ["comfort", "joy"],
    blindSpots: [
      "You avoid books with neat happy endings",
      "You mistake emotional pain for depth",
    ],
    tropes: ["Unrequited love", "Beautiful suffering", "Bittersweet endings"],
    sections: [
      {
        h: "What this reader is",
        p: [
          "The Grief Romantic reads toward the wound. Not out of masochism and not out of gloom — out of a conviction, usually unexamined, that the books which hurt are the ones telling the truth. A story that leaves you intact is a story that held something back.",
          "It is the most misread of the eight archetypes, mostly by the people who get it. From outside it looks like a taste for sad books. From inside it is closer to an appetite for proof: proof that a feeling can be that large, that a loss can be rendered exactly, that someone else went there first and came back with the words. The sadness is the evidence, not the point.",
        ],
      },
      {
        h: "The emotions that produce it",
        p: [
          "Bibliome does not ask what you read. It asks what the book did to you, across 18 emotions grouped into five families, and the archetype falls out of the pattern rather than out of a quiz.",
          "The Grief Romantic is built on three emotions from two families. Grief and devastation come from the family Bibliome calls it messed me up — the ache that doesn't leave when the book ends, and the finish-and-just-sit-there kind of wreckage. Catharsis comes from it hit different: the cry that leaves you lighter. That third one is what separates this reader from someone who simply logs a lot of dark books. The Grief Romantic doesn't only get hurt. They get released.",
          "The engine also watches what is missing. Comfort and joy sit as this archetype's anti-emotions, and a shelf that keeps reaching for the soft place to land will be scored away from this label no matter how much grief is on it.",
        ],
      },
      {
        h: "What they reach for",
        p: [
          "Unrequited love, beautiful suffering, bittersweet endings. The long-form literary devastation, the war novel that refuses a hero, the love story that was never going to work and knew it on page one. Translated fiction does well here — something about the extra distance makes the grief land cleaner.",
          "They re-read the ending before they re-read the book. They keep the line, not the plot. Ask a Grief Romantic what a novel was about and you will get a feeling and a single scene, usually the last one.",
        ],
      },
      {
        h: "What they avoid",
        p: [
          "The neat happy ending, which reads as a flinch. The comedy that is only a comedy. The romance that arrives with its outcome already guaranteed on the cover.",
          "Bibliome names two blind spots for this archetype, and they are not compliments: you avoid books with neat happy endings, and you mistake emotional pain for depth. The second one is the sharper of the two. A book can devastate you and still be shallow, and this reader is the least well equipped of the eight to notice when that has happened.",
        ],
      },
      {
        h: "The nearest archetype",
        p: [
          'If the books that reach you are hot rather than cold — if what you log is rage and desire rather than grief and catharsis — you are closer to the Soft Masochist, who is being come at rather than bereaved. If the grief is there but the release never is, and you keep reaching for the book that explains the loss rather than the one that performs it, look at the Control-Seeking Intellectual. And if the devastation comes specifically from how much you cared about one character rather than from the loss itself, that is the Obsessive Romantic. All three shelves look identical from the outside. Bibliome separates them on which emotions you recorded, and at what strength.',
        ],
      },
    ],
  },

  {
    slug: "control-seeking-intellectual",
    id: "control_intellectual",
    name: "The Control-Seeking Intellectual",
    color: "#5A5A8A",
    glyph: "◇",
    tagline:
      "You read to master what unsettles you. Understanding is your armor, and every book is a new piece of territory mapped.",
    blurb:
      "The Control-Seeking Intellectual is the Bibliome reading archetype for readers who metabolise fear by understanding it. What produces it, what it reaches for, and the vulnerability it routes around.",
    primary: ["recognition", "dread", "awe"],
    anti: ["grief", "catharsis"],
    blindSpots: [
      "You intellectualize emotions instead of feeling them",
      "You abandon books that make you vulnerable",
    ],
    tropes: ["Unreliable narrators", "Philosophical fiction", "Systems and structures"],
    sections: [
      {
        h: "What this reader is",
        p: [
          "This reader turns unease into a subject. Something in the world is frightening or illegible, and the response is not to look away and not to sit in it — it is to go and find the book that explains it, and then the next one, until the thing has a shape and the shape can be held.",
          "It is genuinely effective. It is also, as an emotional strategy, a way of standing slightly to the side of your own feelings while writing an excellent essay about them. Bibliome assigns this archetype from the emotional record rather than from subject matter, which means you can get it from a shelf of novels. Reading literary fiction analytically is still reading analytically.",
        ],
      },
      {
        h: "The emotions that produce it",
        p: [
          "Recognition, dread and awe — a triple that spans three of Bibliome's five emotion families and is the reason this archetype is so distinctive.",
          "Dread comes from it messed me up: the low hum of something-bad-is-coming that you read the whole book with. Recognition and awe both come from it hit different — being seen by a book that already knew you, and the wonder at sheer scale that makes you put it down and sit there. Read together, that is the signature: this reader is drawn to what unsettles them, and rewarded when it resolves into something comprehensible.",
          "The anti-emotions are grief and catharsis, and their absence is the tell. This reader will happily log dread for four hundred pages and never once record the release. The tension is tolerable. Being undone by it is not.",
        ],
      },
      {
        h: "What they reach for",
        p: [
          "Unreliable narrators, philosophical fiction, systems and structures. Books with an architecture you can see from above. Long non-fiction about the thing that has been worrying them. Novels whose pleasure is partly the pleasure of working out how they are built.",
          "They finish books at a high rate, annotate more than the other seven archetypes, and are the most likely to follow one book straight into its bibliography.",
        ],
      },
      {
        h: "What they avoid",
        p: [
          "The memoir that asks you to feel with it rather than think about it. The book with no argument. The one that is going to make you cry in a way you did not schedule.",
          "The two blind spots Bibliome names — you intellectualize emotions instead of feeling them, and you abandon books that make you vulnerable — describe the same move from two angles. The abandoned book is usually abandoned around the point where understanding stops being enough.",
        ],
      },
      {
        h: "The nearest archetype",
        p: [
          "The Emotional Archaeologist reads inward with the same intensity but is digging for a release rather than a map, and logs the catharsis this reader never does. The Midnight Arsonist shares the appetite for a difficult book but wants to be argued out of something, not handed a structure. If you recognise the analysis but also keep logging grief, you are probably not here — grief is one of this archetype's two anti-emotions, and a shelf that records it honestly gets scored elsewhere no matter how much theory is on it.",
        ],
      },
    ],
  },

  {
    slug: "soft-masochist",
    id: "soft_masochist",
    name: "The Soft Masochist",
    color: "#6B3A5D",
    glyph: "◆",
    tagline:
      "You choose pain on purpose. Not sorrow — teeth. You're drawn to the book that comes at you over the one that holds you.",
    blurb:
      "The Soft Masochist is the Bibliome reading archetype for readers drawn to the book with teeth. How it differs from the Grief Romantic, what produces it, and what it distrusts.",
    primary: ["rage", "dread", "desire"],
    anti: ["comfort", "joy"],
    blindSpots: [
      "You equate suffering with authenticity",
      "You distrust books that feel too safe",
    ],
    tropes: ["Tragic love", "Moral ambiguity", "Devastating plot twists"],
    sections: [
      {
        h: "What this reader is",
        p: [
          "Every reader who gets this archetype asks the same question: how is this different from the Grief Romantic? The difference is the temperature. Grief is cold and slow and arrives after. This is hot and immediate and arrives during.",
          "The Soft Masochist is not mourning anything. They are being come at, and they like it. The pull is toward the book that has designs on them — the antagonist with a case, the love that is clearly a bad idea, the twist that was set up two hundred pages ago specifically to hurt. Sorrow is not the register. Teeth are.",
        ],
      },
      {
        h: "The emotions that produce it",
        p: [
          "Rage, dread and desire. Rage and dread are from it messed me up — the injustice you can't let go of and the shoulders-up-by-your-ears tension. Desire is from the yearning: the pull toward, the ache of almost.",
          "That combination is doing precise work. An earlier version of Bibliome's engine anchored this archetype on grief and devastation, which made it the catch-all for any dark shelf; it was over-assigned, and it kept colliding with the Grief Romantic. Swapping in desire narrowed it to the reader who is attracted to the thing that hurts rather than bereaved by it. If you hold rage and dread but log no desire, you are somewhere else on this map.",
          "Comfort and joy are the anti-emotions, shared with the Grief Romantic — the one place the two archetypes genuinely agree.",
        ],
      },
      {
        h: "What they reach for",
        p: [
          "Tragic love, moral ambiguity, devastating plot twists. Dark romance and enemies who mean it. The villain whose logic holds. Thrillers that do not let anyone off. Books where the wanting and the danger are the same thing, because for this reader they usually are.",
          "They are the most likely of the eight to finish something in one sitting, and the most likely to describe a book as worth it in the same breath as describing how much it hurt.",
        ],
      },
      {
        h: "What they avoid",
        p: [
          "Anything that feels managed. The romance with the guaranteed landing. The gentle book, not because it is bad but because it does not seem to want anything from them.",
          "Bibliome's two blind spots here: you equate suffering with authenticity, and you distrust books that feel too safe. Both are worth sitting with. A book being hard on you is not, by itself, a book being honest with you.",
        ],
      },
      {
        h: "The nearest archetype",
        p: [
          'The Grief Romantic is the confusion worth resolving first: both shelves are dark, but that reader logs grief and catharsis where this one logs rage and desire. The Obsessive Romantic shares desire and takes the same damage, but out of attachment rather than appetite — they were wrecked because they loved someone, not because the book had teeth. The Midnight Arsonist enjoys the provocation too, but intellectually; they want a position dismantled, where this reader wants to be got at.',
        ],
      },
    ],
  },

  {
    slug: "comfort-architect",
    id: "comfort_architect",
    name: "The Comfort Architect",
    color: "#7A8B6F",
    glyph: "○",
    tagline:
      "You build emotional safety through stories. Your bookshelf isn't a collection — it's a home you can always return to.",
    blurb:
      "The Comfort Architect is the Bibliome reading archetype for readers who build a shelf like a home. What produces it, why the re-read counts, and what it never risks.",
    primary: ["comfort", "joy", "amusement"],
    anti: ["rage", "dread"],
    blindSpots: [
      "You avoid books that might destabilize you",
      "You re-read instead of risking new things",
    ],
    tropes: ["Found family", "Slow-burn romance", "Cozy settings"],
    sections: [
      {
        h: "What this reader is",
        p: [
          "Architect is the right word and it is doing the work in the name. This is not passive reading. A Comfort Architect has built something — a shelf assembled over years to be reliably survivable, where every spine is a known quantity and the known quantity is the entire point.",
          "It is the archetype most often apologised for by the people who get it, and the apology is unnecessary. Choosing what to feel is a skill. Most people find out what a book will do to them only after it has done it; this reader decided in advance.",
        ],
      },
      {
        h: "The emotions that produce it",
        p: [
          "Comfort, joy and amusement — all three from the same family, the one Bibliome calls it held me. It is the only archetype of the eight built from a single family, which is why it reads as so coherent: the soft place to land, closing the book smiling, and actually laughing out loud.",
          "Amusement is the underrated third. It is what distinguishes a Comfort Architect from a reader who simply logs a lot of comfort. This shelf is not only warm, it is funny. The books know when to let you off.",
          "Rage and dread are the anti-emotions. Not sadness, notably — a Comfort Architect can take a sad book. What they will not take is a hostile one.",
        ],
      },
      {
        h: "What they reach for",
        p: [
          "Found family, slow-burn romance, cozy settings. Series they can live inside. Books where the stakes are real but bounded, where nobody is cruel for the structure's sake, and where the ending has been quietly promised from the first chapter.",
          "The re-read is not a failure of ambition here, it is the mechanism. Bibliome counts a re-read as a real entry, because for this reader it is one: the second pass usually logs different emotions than the first.",
        ],
      },
      {
        h: "What they avoid",
        p: [
          "The book that might destabilise something. The one everybody says is brilliant and devastating. Ambiguity about whether the cruelty is being endorsed.",
          "The blind spots Bibliome names — you avoid books that might destabilize you, and you re-read instead of risking new things — are the real cost, and they are a cost this reader has usually already priced in. The question the archetype page cannot answer for you is whether the shelf is a home or a perimeter.",
        ],
      },
      {
        h: "The nearest archetype",
        p: [
          'The Quiet Witness is the near neighbour and the common mix-up. Both shelves are gentle, but that reader logs tenderness, recognition and nostalgia — being seen, and being somewhere in the past — where this one logs comfort, joy and amusement. The Quiet Witness is being quietly understood; the Comfort Architect is being looked after, and is having a much better time. If your gentle books keep making you laugh out loud, you are here. If they keep making you remember something, you are next door.',
        ],
      },
    ],
  },

  {
    slug: "midnight-arsonist",
    id: "midnight_arsonist",
    name: "The Midnight Arsonist",
    color: "#C47A3A",
    glyph: "△",
    tagline:
      "You read like you're setting fire to your own beliefs. Comfort zones are for people who haven't found the right book yet.",
    blurb:
      "The Midnight Arsonist is the Bibliome reading archetype for readers who use books to dismantle their own positions. What produces it, and the one register it dismisses.",
    primary: ["amusement", "awe", "rage"],
    anti: ["comfort", "tenderness"],
    blindSpots: [
      "You conflate discomfort with growth",
      "You dismiss gentle books as boring",
    ],
    tropes: ["Boundary-pushing fiction", "Experimental structure", "Provocative themes"],
    sections: [
      {
        h: "What this reader is",
        p: [
          "The Midnight Arsonist reads to be argued out of something. A book that agrees with them has wasted their evening. The ideal read leaves a position they held that morning no longer available to them, and they will describe this as fun, because to them it is.",
          "The arson is aimed inward, which is the part the name can obscure. This is not a reader who wants to burn down other people's books. It is a reader who keeps handing matches to strangers and asking them to start with the foundations.",
        ],
      },
      {
        h: "The emotions that produce it",
        p: [
          "Amusement, awe and rage, taken from three separate families — the widest emotional spread of any archetype in the engine, and the reason it is hard to fake.",
          "Amusement is from it held me, awe from it hit different, rage from it messed me up. Read as one gesture: the book was funny, the book was enormous, the book made you want to throw it across the room, and all three happened to the same person in the same week. That is not a contradiction. That is a reader who is enjoying being provoked.",
          "The anti-emotions are comfort and tenderness. Not grief and not dread — this reader will go to dark places happily. What they will not log is being handled carefully.",
        ],
      },
      {
        h: "What they reach for",
        p: [
          "Boundary-pushing fiction, experimental structure, provocative themes. The novel with no quotation marks. The polemic they disagree with, read attentively. Satire with something actually at stake. The book that was banned somewhere, less for the frisson than because a book worth banning usually has a load-bearing argument in it.",
          "They abandon more books than any other archetype and feel no guilt about it. A book that is not going to change anything gets closed at page forty.",
        ],
      },
      {
        h: "What they avoid",
        p: [
          "The gentle book. The consoling one. Anything whose project is to be kind to the reader.",
          "Bibliome's blind spots for this archetype: you conflate discomfort with growth, and you dismiss gentle books as boring. The first is the dangerous one. Being provoked feels identical to being changed, and only one of them leaves anything behind.",
        ],
      },
      {
        h: "The nearest archetype",
        p: [
          'The Control-Seeking Intellectual reads the same difficult shelf for the opposite reason: to build a structure rather than to knock one down, and logs dread where this reader logs amusement. The Soft Masochist also enjoys being provoked, but wants it aimed at them personally rather than at their positions. The clean test is amusement. This archetype finds the demolition genuinely funny, and that is the emotion that separates it from every other reader of difficult books.',
        ],
      },
    ],
  },

  {
    slug: "quiet-witness",
    id: "quiet_witness",
    name: "The Quiet Witness",
    color: "#B8964E",
    glyph: "□",
    tagline:
      "You absorb everything and process in silence. Books are your confessional — the only place you don't perform.",
    blurb:
      "The Quiet Witness is the Bibliome reading archetype for readers who use books as the one room where they don't perform. What produces it, and what it uses reading to avoid.",
    primary: ["tenderness", "recognition", "nostalgia"],
    anti: ["dread", "amusement"],
    blindSpots: [
      "You observe more than you feel",
      "You use reading to avoid confrontation",
    ],
    tropes: ["Introspective narrators", "Literary fiction", "Quiet revelations"],
    sections: [
      {
        h: "What this reader is",
        p: [
          "The Quiet Witness reads the way other people keep a diary. The book is where the reaction is allowed to be the actual size it is, because there is nobody in the room to manage it for.",
          "This archetype tends to land with people who are described by others as good listeners, and it is worth noticing that a good listener is also someone who has arranged not to be the one speaking. The reading is genuine. It is also, sometimes, a very comfortable place to put a feeling instead of saying it out loud.",
        ],
      },
      {
        h: "The emotions that produce it",
        p: [
          "Tenderness, recognition and nostalgia — the tightest introspective triple in the engine, and one this archetype owns outright with no shared primary anywhere else.",
          "Tenderness is from it held me: handle-with-care kind of love. Recognition is from it hit different — it read my mind. Nostalgia is from the yearning — it smelled like a memory. Together they describe a reader who is being carefully seen by a book, and who is somewhere slightly in the past while it happens.",
          "The anti-emotions are dread and amusement. Dread is the confrontation this reader routes around. Amusement is the giveaway: they do not read for laughs, and a shelf logging a lot of actually laughed out loud belongs to someone else.",
        ],
      },
      {
        h: "What they reach for",
        p: [
          "Introspective narrators, literary fiction, quiet revelations. Short story collections. Novels where very little happens and all of it matters. Memoir, especially about childhood. The book that turns out to be about a house.",
          "They read slowly, finish nearly everything they start, and are the least likely of the eight to talk about a book while they are still inside it.",
        ],
      },
      {
        h: "What they avoid",
        p: [
          "The thriller. The loud comedy. Anything that wants a reaction out of them on a schedule.",
          "Bibliome names two blind spots: you observe more than you feel, and you use reading to avoid confrontation. Both are the shadow of the same strength. The ability to sit with something without needing to act on it is the reason this reader notices so much, and also the reason some things stay unsaid for years.",
        ],
      },
      {
        h: "The nearest archetype",
        p: [
          'The Comfort Architect is the closest shelf and the most common confusion — both are gentle, but that reader is being looked after where this one is being seen. The Emotional Archaeologist shares the inwardness and goes much harder at it, logging awe and catharsis where this reader logs tenderness and nostalgia: digging rather than sitting with. If your quiet books keep producing a release rather than a recognition, check that page instead.',
        ],
      },
    ],
  },

  {
    slug: "obsessive-romantic",
    id: "obsessive_romantic",
    name: "The Obsessive Romantic",
    color: "#C4553A",
    glyph: "♡",
    tagline:
      "You don't read books — you fall into them. Every story is a love affair, and you don't do casual.",
    blurb:
      "The Obsessive Romantic is the Bibliome reading archetype for readers who cannot do casual. What produces it, the hangover it causes, and why the light read never lands.",
    primary: ["desire", "longing", "devastation"],
    anti: ["amusement", "joy"],
    blindSpots: [
      "You abandon books you can't fall in love with",
      "You chase the high of a new obsession",
    ],
    tropes: ["Consuming love stories", "Immersive worlds", "Characters you'd die for"],
    sections: [
      {
        h: "What this reader is",
        p: [
          "There is no middle setting. A book is either the only thing happening to them or it is not happening at all, and the ratio between those two states is roughly one to twenty.",
          "When it lands, it fully lands: three days gone, other commitments quietly rescheduled, a real grief at the last page that is not about the plot but about it being over. Then the hangover, where nothing else will do, which can run for weeks. This archetype's reading year is a small number of total immersions separated by long stretches of starting things and putting them down.",
        ],
      },
      {
        h: "The emotions that produce it",
        p: [
          "Desire, longing and devastation. Desire and longing are both from the yearning — the pull toward, and wanting something you can't quite name. Devastation is from it messed me up: the book you finish and then just sit there after.",
          "That third one is what makes this an obsession rather than a preference. This reader is not soothed by the books they love. They are wrecked by how much they cared, and they log it. An earlier version of the engine had comfort in this slot, which never fit a reader defined by being consumed, and it collided with the Comfort Architect besides.",
          "The anti-emotions are amusement and joy — the light, easy, happy read, which is precisely the casual this archetype refuses.",
        ],
      },
      {
        h: "What they reach for",
        p: [
          "Consuming love stories, immersive worlds, characters you'd die for. Long series. Doorstop fantasy. The romance that takes itself entirely seriously. Anything with enough room to move into.",
          "They re-read the same six books more than the Comfort Architect does, for an opposite reason: not because it is safe, but because nothing since has been that good.",
        ],
      },
      {
        h: "What they avoid",
        p: [
          "The pleasant novel. The clever short one. The book that is good but does not want anything from them.",
          "Bibliome's blind spots here: you abandon books you can't fall in love with, and you chase the high of a new obsession. The second one is the expensive one. Reading for the hit means an enormous number of perfectly good books get closed at chapter two for the crime of not being overwhelming yet.",
        ],
      },
      {
        h: "The nearest archetype",
        p: [
          'The Soft Masochist shares desire and the willingness to be hurt, but is drawn to the antagonism rather than the attachment. The Grief Romantic shares devastation but mourns the book rather than falls for it. The Comfort Architect is the true opposite: same re-reading, same small trusted shelf, completely inverted reason — safety versus the fact that nothing since has been that good. If you re-read constantly and log comfort while doing it, you are there, not here.',
        ],
      },
    ],
  },

  {
    slug: "emotional-archaeologist",
    id: "emotional_archaeologist",
    name: "The Emotional Archaeologist",
    color: "#7A5A9B",
    glyph: "◎",
    tagline:
      "You dig into stories looking for buried parts of yourself. Every book is an excavation site.",
    blurb:
      "The Emotional Archaeologist is the Bibliome reading archetype for readers who use books to excavate themselves. What produces it, and the meaning it finds where there isn't any.",
    primary: ["awe", "longing", "catharsis"],
    anti: ["amusement", "joy"],
    blindSpots: [
      "You over-analyze what you read",
      "You search for meaning even when there's none",
    ],
    tropes: ["Psychological depth", "Identity exploration", "Hidden truths"],
    sections: [
      {
        h: "What this reader is",
        p: [
          "This reader is not looking for a story. They are looking for a thing about themselves they have not been able to get at directly, and they have worked out that fiction will sometimes hand it over when nothing else will.",
          "Every book is a site. They go in, they find the one passage that is somehow about them, and they carry it out. Ask them about a novel six months later and they will not remember the ending, but they will remember exactly where they were sitting when the sentence landed.",
        ],
      },
      {
        h: "The emotions that produce it",
        p: [
          "Awe, longing and catharsis, spanning three families. Awe and catharsis are from it hit different — the wonder at what gets uncovered, and the cry that leaves you lighter. Longing is from the yearning.",
          "It is a distinctly hopeful set for a reader working in the dark. This archetype is not down there for grief. It is down there because it believes something is buried and that finding it will be a release. Catharsis is the payload; the digging is the method.",
          "The anti-emotions are amusement and joy. This reader does not excavate for delight, and a shelf that keeps logging the easy pleasures is being scored somewhere else.",
        ],
      },
      {
        h: "What they reach for",
        p: [
          "Psychological depth, identity exploration, hidden truths. Novels of interiority. Autofiction. The family book with a secret in it. Second-person narration, which for most readers is a gimmick and for this one is an invitation.",
          "They mark up their books heavily and asymmetrically — three pages covered, then ninety untouched.",
        ],
      },
      {
        h: "What they avoid",
        p: [
          "The plot-forward book. The one that is exactly what it is. Anything with nothing under it.",
          "Bibliome names two blind spots, and they are the two halves of one habit: you over-analyze what you read, and you search for meaning even when there's none. Some books are just books. This reader is constitutionally unable to accept that, which is both the gift and the bill.",
        ],
      },
      {
        h: "The nearest archetype",
        p: [
          "The Control-Seeking Intellectual is the near miss. Both read analytically and both log awe, but that reader is mapping territory outside themselves and never records the catharsis, which is this archetype's whole payload. The Quiet Witness shares the inwardness at a lower intensity — sitting with what a book noticed rather than going in after it. And if what you find down there is mostly grief rather than release, the Grief Romantic is the closer page.",
        ],
      },
    ],
  },
];

export const bySlug = (slug) => ARCHETYPES.find((a) => a.slug === slug);
