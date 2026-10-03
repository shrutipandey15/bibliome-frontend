// The 12 reading archetypes, as content.
//
// SOURCE OF TRUTH for id / name / tagline / primary / anti / blindSpots /
// tropes is the backend's app/services/dna_engine.py PERSONALITY_TYPES. Those
// fields are copied verbatim — do not paraphrase them here, and do not invent a
// thirteenth archetype: a reader can only ever be assigned one the engine returns.
// Eleven are assigned from feelings; the Discerning Reader is assigned from
// verdicts, which is why its primary and anti arrays are empty.
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
    primary: ["grief", "catharsis", "haunted"],
    anti: ["joy", "amusement"],
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
          "It is the most misread of Bibliome's archetypes, mostly by the people who get it. From outside it looks like a taste for sad books. From inside it is closer to an appetite for proof: proof that a feeling can be that large, that a loss can be rendered exactly, that someone else went there first and came back with the words. The sadness is the evidence, not the point.",
        ],
      },
      {
        h: "The emotions that produce it",
        p: [
          "Bibliome does not ask what you read. It asks what the book did to you, across 21 feelings grouped into six families, and the archetype falls out of the pattern rather than out of a quiz.",
          "The Grief Romantic is built on three feelings from a single family, the one Bibliome calls it broke me. Grief is it broke my heart. Haunted is the scene that keeps coming back to you weeks after the book ended. Catharsis is I cried and felt lighter — and that one is what separates this reader from someone who simply logs a lot of dark books. The Grief Romantic doesn't only get hurt. They get released.",
          "The engine also watches what is missing. Joy and amusement sit as this archetype's anti-emotions, and a shelf that keeps closing books happy or laughing will be scored away from this label no matter how much grief is on it.",
        ],
      },
      {
        h: "What they reach for",
        p: [
          "Unrequited love, beautiful suffering, bittersweet endings. The long literary heartbreak, the war novel that refuses a hero, the love story that was never going to work and knew it on page one. Translated fiction does well here — something about the extra distance makes the grief land cleaner.",
          "They re-read the ending before they re-read the book. They keep the line, not the plot. Ask a Grief Romantic what a novel was about and you will get a feeling and a single scene, usually the last one — which is haunted, logged honestly.",
        ],
      },
      {
        h: "What they avoid",
        p: [
          "The neat happy ending, which reads as a flinch. The comedy that is only a comedy. The romance that arrives with its outcome already guaranteed on the cover.",
          "Bibliome names two blind spots for this archetype, and they are not compliments: you avoid books with neat happy endings, and you mistake emotional pain for depth. The second one is the sharper of the two. A book can break your heart and still be shallow, and this reader is the least well equipped of any to notice when that has happened.",
        ],
      },
      {
        h: "The nearest archetype",
        p: [
          "If the books that reach you are hot rather than cold — if what you log is rage and desire rather than grief and catharsis — you are closer to the Soft Masochist, who is being come at rather than bereaved. If the grief is there but the release never is, and you keep reaching for the book that explains the loss rather than the one that performs it, look at the Control-Seeking Intellectual. And if the hurt comes specifically from how much you cared about one character rather than from the loss itself, that is the Obsessive Romantic. The Sunshine Romantic is the mirror image: its anti-emotions include grief, and it reads for exactly the joy and laughter this archetype refuses. All of these shelves can look alike from the outside. Bibliome separates them on which feelings you recorded, and at what strength.",
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
    primary: ["insight", "dread", "awe"],
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
          "Insight, dread and awe — a triple drawn from two of Bibliome's six feeling families, and the reason this archetype is so distinctive.",
          "Dread comes from it hooked me: it had me scared or on edge, the low hum of something-bad-is-coming that you read the whole book with. Insight and awe both come from it opened my eyes — it changed how I think, and a scale so vast it made you go quiet. Read together, that is the signature: this reader is drawn to what unsettles them, and rewarded when it resolves into something comprehensible.",
          "The anti-emotions are grief and catharsis, and their absence is the tell. This reader will happily log dread for four hundred pages and never once record the release. The tension is tolerable. Being undone by it is not.",
        ],
      },
      {
        h: "What they reach for",
        p: [
          "Unreliable narrators, philosophical fiction, systems and structures. Books with an architecture you can see from above. Long non-fiction about the thing that has been worrying them. Novels whose pleasure is partly the pleasure of working out how they are built.",
          "They finish books at a high rate, annotate more than any other archetype, and are the most likely to follow one book straight into its bibliography.",
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
          "The Emotional Archaeologist also logs insight and reads with the same intensity, but points it inward — digging for recognition and longing rather than drawing a map of the outside world. The Midnight Arsonist shares insight and the appetite for a difficult book but wants to be argued out of something, not handed a structure. The Adrenaline Seeker shares dread and wants none of the resolution: the fear is the point, not the thing to be understood. If you recognise the analysis but also keep logging grief, you are probably not here — grief is one of this archetype's two anti-emotions, and a shelf that records it honestly gets scored elsewhere no matter how much theory is on it.",
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
    primary: ["rage", "conflicted", "desire"],
    anti: ["joy", "hope"],
    blindSpots: [
      "You equate suffering with authenticity",
      "You distrust books that feel too safe",
    ],
    tropes: ["Dark romance", "Moral ambiguity", "Villains you shouldn't root for"],
    sections: [
      {
        h: "What this reader is",
        p: [
          "Every reader who gets this archetype asks the same question: how is this different from the Grief Romantic? The difference is the temperature. Grief is cold and slow and arrives after. This is hot and immediate and arrives during.",
          "The Soft Masochist is not mourning anything. They are being come at, and they like it. The pull is toward the book that has designs on them — the antagonist with a case, the love that is clearly a bad idea, the betrayal that was set up two hundred pages ago specifically to hurt. Sorrow is not the register. Teeth are.",
        ],
      },
      {
        h: "The emotions that produce it",
        p: [
          "Rage, conflicted and desire. Rage is from it hooked me — what happened made you furious. Conflicted and desire are both from it got my heart: I shouldn't love this but I do, and the chemistry that nearly killed you.",
          "That combination is doing precise work. Conflicted is the load-bearing one, and no other archetype has it as a primary: being drawn to the thing you disapprove of is this reader in one sentence. An earlier version of Bibliome's engine anchored this archetype on grief, which made it the catch-all for any dark shelf; it was over-assigned, and it kept colliding with the Grief Romantic. Anchoring it on wanting rather than mourning narrowed it to the reader who is attracted to the thing that hurts rather than bereaved by it. If you hold rage but log no desire and nothing conflicted, you are somewhere else on this map.",
          "Joy and hope are the anti-emotions. This reader has no objection to a good time; what they distrust is the book that sends them off uplifted, which usually means it went easy on somebody.",
        ],
      },
      {
        h: "What they reach for",
        p: [
          "Dark romance, moral ambiguity, villains you shouldn't root for. Enemies who mean it. The villain whose logic holds. Stories that do not let anyone off. Books where the wanting and the danger are the same thing, because for this reader they usually are.",
          "They are the most likely of any archetype to describe a book as worth it in the same breath as describing how much it hurt.",
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
          "The Grief Romantic is the confusion worth resolving first: both shelves are dark, but that reader logs grief and catharsis where this one logs rage and desire. The Obsessive Romantic shares desire and takes the same damage, but out of attachment rather than appetite — they were wrecked because they loved someone, not because the book had teeth. The Midnight Arsonist shares rage and enjoys the provocation too, but intellectually; they want a position dismantled, where this reader wants to be got at. And the Adrenaline Seeker wants the pulse without the wanting — scared and shocked, never conflicted.",
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
    primary: ["comfort", "attachment", "hope"],
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
          "Comfort, attachment and hope. Comfort and attachment come from the family Bibliome calls it held me — like a hug on a rainy day, and characters who felt like your friends. Hope comes from it lit me up: closing the book feeling inspired.",
          "Hope is the underrated third. It is what distinguishes a Comfort Architect from a reader who simply logs a lot of comfort. This shelf is not only a place to hide, it is a place to recover in. The books send you back out into your own life a little better equipped for it.",
          "Rage and dread are the anti-emotions. Not sadness, notably — a Comfort Architect can take a sad book. What they will not take is a hostile one.",
        ],
      },
      {
        h: "What they reach for",
        p: [
          "Found family, slow-burn romance, cozy settings. Series they can live inside. Books where the stakes are real but bounded, where nobody is cruel for the structure's sake, and where the ending has been quietly promised from the first chapter.",
          "The re-read is not a failure of ambition here, it is the mechanism. Bibliome counts a re-read as a real entry, because for this reader it is one: the second pass usually logs different feelings than the first.",
        ],
      },
      {
        h: "What they avoid",
        p: [
          "The book that might destabilise something. The one everybody says is brilliant and shattering. Ambiguity about whether the cruelty is being endorsed.",
          "The blind spots Bibliome names — you avoid books that might destabilize you, and you re-read instead of risking new things — are the real cost, and they are a cost this reader has usually already priced in. The question the archetype page cannot answer for you is whether the shelf is a home or a perimeter.",
        ],
      },
      {
        h: "The nearest archetype",
        p: [
          "The Quiet Witness is the near neighbour and the common mix-up. Both shelves are gentle, but that reader logs recognition, nostalgia and beauty — being seen, and being somewhere in the past — where this one logs comfort, attachment and hope. The Quiet Witness is being quietly understood; the Comfort Architect is being looked after, and is having a much better time. If your gentle books keep sending you out hopeful, you are here. If they keep making you remember something, you are next door. And if the soft shelf is mostly butterflies and laughing out loud, look at the Sunshine Romantic, who is being swept off their feet rather than tucked in.",
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
    primary: ["amusement", "rage", "insight"],
    anti: ["attachment", "swoon"],
    blindSpots: [
      "You conflate discomfort with growth",
      "You dismiss gentle books as boring",
    ],
    tropes: ["Boundary-pushing fiction", "Satire", "Provocative themes"],
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
          "Amusement, rage and insight, taken from three separate families — one of only two archetypes whose primaries span three families, and the reason it is hard to fake. (The other is the World-Diver, which could hardly be less alike.)",
          "Amusement is from it lit me up, rage from it hooked me, insight from it opened my eyes. Read as one gesture: the book was funny, the book made you want to throw it across the room, the book changed how you think, and all three happened to the same person in the same week. That is not a contradiction. That is a reader who is enjoying being provoked.",
          "The anti-emotions are attachment and swoon. Not grief and not dread — this reader will go to dark places happily. What they will not log is being charmed: characters who feel like friends, butterflies on cue.",
        ],
      },
      {
        h: "What they reach for",
        p: [
          "Boundary-pushing fiction, satire, provocative themes. Satire with something actually at stake. The novel with no quotation marks. The polemic they disagree with, read attentively. The book that was banned somewhere, less for the frisson than because a book worth banning usually has a load-bearing argument in it.",
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
          "The Control-Seeking Intellectual reads the same difficult shelf and shares insight, but for the opposite reason: to build a structure rather than to knock one down, and logs dread where this reader logs amusement. The Soft Masochist shares rage and also enjoys being provoked, but wants it aimed at them personally rather than at their positions. The clean test is amusement. This archetype finds the demolition genuinely funny, and that is the emotion that separates it from every other reader of difficult books.",
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
    primary: ["recognition", "nostalgia", "beauty"],
    anti: ["thrill", "amusement"],
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
          "Recognition, nostalgia and beauty — the most introspective triple in the engine, and the quietest.",
          "Recognition and beauty are from it opened my eyes: it knew me, and the writing was so beautiful. Nostalgia is from it held me — it took me back to a younger me. Together they describe a reader who is being carefully seen by a book, who notices how the sentences are made, and who is somewhere slightly in the past while it happens.",
          "The anti-emotions are thrill and amusement. Thrill is the read-it-in-one-sitting pace this reader routes around; they do not want to be hurried through anything. Amusement is the giveaway: they do not read for laughs, and a shelf logging a lot of it made me laugh belongs to someone else.",
        ],
      },
      {
        h: "What they reach for",
        p: [
          "Introspective narrators, literary fiction, quiet revelations. Short story collections. Novels where very little happens and all of it matters. Memoir, especially about childhood. The book that turns out to be about a house.",
          "They read slowly, finish nearly everything they start, and are the least likely of any archetype to talk about a book while they are still inside it.",
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
          "The Comfort Architect is the closest shelf and the most common confusion — both are gentle, but that reader is being looked after where this one is being seen. The Emotional Archaeologist shares recognition and the inwardness and goes much harder at it, logging longing and insight where this reader logs nostalgia and beauty: digging rather than sitting with. If your quiet books keep changing how you think rather than simply knowing you, check that page instead. The Adrenaline Seeker is the true opposite — its two anti-emotions are recognition and beauty.",
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
    primary: ["desire", "longing", "attachment"],
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
          "Desire, longing and attachment. Desire and longing are both from it got my heart — the chemistry that nearly killed you, and a soft ache for what you can't have. Attachment is from it held me: they felt like my friends.",
          "That third one is what makes this an obsession rather than a crush. This reader is not only in love with the romance; they have moved in with the characters, and losing them at the last page is a real loss. Attachment is the one primary this archetype shares with the Comfort Architect, and it is shared for opposite reasons: there it is company, here it is devotion.",
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
          "The Soft Masochist shares desire and the willingness to be hurt, but is drawn to the antagonism rather than the attachment. The Grief Romantic can look the same after the last page, but mourns the book rather than falls for it. The Sunshine Romantic reads the same love stories in the opposite key — swoon, joy and laughter, two of which are this archetype's anti-emotions. The Comfort Architect is the true opposite: same re-reading, same small trusted shelf, completely inverted reason — safety versus the fact that nothing since has been that good. If you re-read constantly and log comfort while doing it, you are there, not here.",
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
    primary: ["recognition", "longing", "insight"],
    anti: ["amusement", "rage"],
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
          "Recognition, longing and insight, spanning two families. Recognition and insight are from it opened my eyes — it knew me, and it changed how I think. Longing is from it got my heart: a soft ache for what you can't have.",
          "Read in order, it is almost a method. Longing is the sense that something is missing. Recognition is finding it on a page. Insight is what you carry back out — not only this is me, but now I understand why. The digging is the method; the insight is the payload.",
          "The anti-emotions are amusement and rage. This reader does not excavate for delight and does not go down there angry, and a shelf that keeps logging the easy laugh or the furious one is being scored somewhere else.",
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
          "The Control-Seeking Intellectual is the near miss. Both read analytically and both log insight, but that reader is mapping territory outside themselves, driven by dread rather than longing, and rarely records the recognition that is this archetype's whole starting point. The Quiet Witness shares recognition and the inwardness at a lower intensity — sitting with what a book noticed rather than going in after it. The Obsessive Romantic shares longing but spends it on the characters rather than on the self. And if what you find down there is mostly grief rather than understanding, the Grief Romantic is the closer page.",
        ],
      },
    ],
  },

  {
    slug: "world-diver",
    id: "world_diver",
    name: "The World-Diver",
    color: "#3A7A8C",
    glyph: "✦",
    tagline:
      "You read to live somewhere else. Vast worlds, long histories, maps in the front pages — you want to be swallowed whole and come back glowing.",
    blurb:
      "The World-Diver is the Bibliome reading archetype for readers who want to be swallowed by a world and come back glowing. What produces it, what it reaches for, and the quiet books it skips.",
    primary: ["awe", "thrill", "joy"],
    anti: ["recognition", "grief"],
    blindSpots: [
      "You escape into worlds instead of looking at your own",
      "You skip the quiet books that don't transport you",
    ],
    tropes: ["Epic fantasy", "Deep worldbuilding", "Maps and histories"],
    sections: [
      {
        h: "What this reader is",
        p: [
          "The World-Diver reads for a change of address. The best book is one with a border you cross on page one and a map you keep flipping back to, a place with its own weather, its own politics and three thousand years of history that mostly happens offstage. The plot matters. The place matters more.",
          "It is the most openly joyful archetype on the map, and it is easy to mistake for escapism, which is only half right. This reader is not running from something so much as running toward scale. They want to stand somewhere enormous for a while and come home with the feeling still on them, and the coming home is part of it.",
        ],
      },
      {
        h: "The emotions that produce it",
        p: [
          "Awe, thrill and joy, from three separate families — one of only two archetypes whose primaries span three, alongside the Midnight Arsonist, which uses the same breadth for the opposite purpose.",
          "Awe is from it opened my eyes: so vast it made you go quiet. Thrill is from it hooked me — I read it in one sitting. Joy is from it lit me up: it made me so happy. Read as one gesture, that is a world big enough to stop you, fast enough to keep you, and generous enough that you close it smiling. Take away any one of the three and the shelf reads as something else.",
          "The anti-emotions are recognition and grief. This reader is not looking to be seen by a book, and not looking to be broken by one either. A shelf that keeps logging it knew me or it broke my heart is doing a different kind of reading, however many maps are in it.",
        ],
      },
      {
        h: "What they reach for",
        p: [
          "Epic fantasy, deep worldbuilding, maps and histories. The first book of a long series, bought with the full intention of reading all nine. Space opera with a working economy. Invented languages, appendices, family trees. Historical fiction that builds a century from the ground up.",
          "They read the glossary for pleasure, argue about in-world politics as if they were real ones, and are the most likely of any archetype to start a re-read purely to live there again.",
        ],
      },
      {
        h: "What they avoid",
        p: [
          "The domestic novel set in one kitchen. Autofiction. The slim literary book whose entire world is the inside of one person's head.",
          "Bibliome names two blind spots: you escape into worlds instead of looking at your own, and you skip the quiet books that don't transport you. They are the same habit seen from two sides. The book that stays put and looks hard at an ordinary life is sometimes the one with the most to say, and this reader rarely gives it the chance.",
        ],
      },
      {
        h: "The nearest archetype",
        p: [
          "The Obsessive Romantic reaches for the same immersive worlds and long series, but falls for the people rather than the place, logging desire, longing and attachment where this reader logs awe, thrill and joy. The Control-Seeking Intellectual shares awe but wants to master the structure rather than live inside it, and reads with dread instead of delight. The Adrenaline Seeker shares thrill and none of the wonder — a page-turner for the pulse, not the place. If the thing you keep coming back to is a character rather than a world, you are probably not here.",
        ],
      },
    ],
  },

  {
    slug: "adrenaline-seeker",
    id: "adrenaline_seeker",
    name: "The Adrenaline Seeker",
    color: "#8C3A3A",
    glyph: "✶",
    tagline:
      "You read for the pulse. Twists, fear, the 3am chapter — a book has to grab you by the collar and not let go.",
    blurb:
      "The Adrenaline Seeker is the Bibliome reading archetype for readers who want a book to grab them by the collar. What produces it, what it reaches for, and the quiet parts it rushes past.",
    primary: ["thrill", "dread", "shock"],
    anti: ["recognition", "beauty"],
    blindSpots: [
      "You rush past the quiet parts",
      "You trust a twist more than a feeling",
    ],
    tropes: ["Thrillers", "Horror", "Twists you didn't see coming"],
    sections: [
      {
        h: "What this reader is",
        p: [
          "The Adrenaline Seeker reads with their body. Pulse up, shoulders up, one more chapter and then one more after that, and suddenly it is three in the morning and the alarm is going to be a problem. The book is not something they sit with. It is something that happens to them, at speed.",
          "It is the archetype most often waved away as a taste for airport fiction, which misses how demanding it is. This reader can tell within ten pages whether a writer knows how to build tension, and they will not forgive a twist that was cheated. They are not reading less closely than anyone else. They are reading for a different thing, and it is much harder to fake.",
        ],
      },
      {
        h: "The emotions that produce it",
        p: [
          "Thrill, dread and shock, all three from the family Bibliome calls it hooked me — one of only two archetypes built from a single family, alongside the Grief Romantic, and the two could hardly be further apart in temperature.",
          "Thrill is I read it in one sitting. Dread is it had me scared or on edge. Shock is I did NOT see that coming. Together they are the whole mechanism of a page-turner, logged from the inside: the pull, the fear and the floor dropping away. What this reader records is not what the book meant but what it did to their heart rate.",
          "The anti-emotions are recognition and beauty. This reader is not looking to be seen and is not stopping to admire a sentence; a shelf that keeps logging it knew me or the writing was so beautiful is being read more slowly than this archetype ever reads.",
        ],
      },
      {
        h: "What they reach for",
        p: [
          "Thrillers, horror, twists you didn't see coming. Locked-room mysteries. The unreliable narrator whose reveal rearranges everything before it. Short chapters that end on a door opening. Horror that commits.",
          "They finish books faster than any other archetype, and are the most likely to go straight back to page one to see how the trick was done.",
        ],
      },
      {
        h: "What they avoid",
        p: [
          "The slow literary novel. The book where the tension is entirely internal. Anything that spends forty pages on the light through a window.",
          "Bibliome's two blind spots here: you rush past the quiet parts, and you trust a twist more than a feeling. The second is the one to watch. A twist can be engineered by anyone patient enough; a feeling that stays after the last page is harder to build, and this reader sometimes mistakes the first for the second.",
        ],
      },
      {
        h: "The nearest archetype",
        p: [
          "The Control-Seeking Intellectual shares dread but wants it resolved into something comprehensible; this reader wants the next chapter, not the explanation. The Soft Masochist likes being got at too, but through rage and desire — being wanted by a dangerous book rather than chased by one. The World-Diver shares thrill and spends it on a place rather than a pulse. The Quiet Witness is the true opposite: its primaries include the recognition and beauty this archetype avoids, and it has thrill as an anti-emotion.",
        ],
      },
    ],
  },

  {
    slug: "sunshine-romantic",
    id: "sunshine_romantic",
    name: "The Sunshine Romantic",
    color: "#D4876B",
    glyph: "☼",
    tagline:
      "You read for the swoon. Banter, butterflies and the happy ending you were promised — you believe in love stories and you're not embarrassed about it.",
    blurb:
      "The Sunshine Romantic is the Bibliome reading archetype for readers who read for the swoon and the happy ending. What produces it, what it reaches for, and when it bails.",
    primary: ["swoon", "joy", "amusement"],
    anti: ["grief", "dread"],
    blindSpots: [
      "You bail when a story turns dark",
      "You read for the ending you already know",
    ],
    tropes: ["Romcoms", "Banter", "Happily ever after"],
    sections: [
      {
        h: "What this reader is",
        p: [
          "The Sunshine Romantic reads for the moment two people finally stop pretending. The meet-cute, the banter that is obviously flirting, the grand gesture in the rain, and then the ending the cover promised. None of it is a surprise and none of it needs to be. The pleasure is in watching it arrive.",
          "It is the archetype people are most likely to be sheepish about and have the least reason to be. Writing a romance that actually delivers the butterflies is a craft, and reading for it is a kind of expertise: this reader can tell you, precisely, the difference between chemistry and two characters who were simply told to be in love.",
        ],
      },
      {
        h: "The emotions that produce it",
        p: [
          "Swoon, joy and amusement. Swoon is from it got my heart — it gave me butterflies. Joy and amusement are from it lit me up: it made me so happy, and it made me laugh.",
          "The laughter is what makes this archetype. Plenty of readers log a romance; this one logs the romance and the banter together, and a love story that is not also funny rarely gets their highest marks. The butterflies and the jokes are doing the same job.",
          "The anti-emotions are grief and dread. Sadness in passing is fine, even welcome, as long as it is the dark moment before the ending turns. What this reader will not log is a book that means it.",
        ],
      },
      {
        h: "What they reach for",
        p: [
          "Romcoms, banter, happily ever after. Fake dating. Rivals to lovers. The small town and the stubborn newcomer. Anything with a meet-cute in the first chapter and a guaranteed landing in the last.",
          "They read fast, re-read favourite scenes rather than favourite books, and are the most likely of any archetype to recommend a book entirely on the strength of one line of dialogue.",
        ],
      },
      {
        h: "What they avoid",
        p: [
          "The love story that ends in a funeral. The literary romance that withholds the kiss for the sake of it. Anything shelved as romance that turns out, three hundred pages in, to be a tragedy.",
          "Bibliome's blind spots here: you bail when a story turns dark, and you read for the ending you already know. The first costs more than it looks. Some of the best love stories get their happy ending only because they went somewhere hard first, and this reader tends to close them just before they turn back toward the light.",
        ],
      },
      {
        h: "The nearest archetype",
        p: [
          "The Comfort Architect shares the soft shelf and the promised ending, but is being looked after rather than swept away, logging comfort, attachment and hope where this reader logs swoon, joy and laughter. The Obsessive Romantic reads the same love stories in the opposite key: desire and longing instead of butterflies, and joy and amusement are its two anti-emotions. The Grief Romantic is the mirror image — grief is this archetype's anti-emotion, and joy and amusement are that one's.",
        ],
      },
    ],
  },

  {
    slug: "discerning-reader",
    id: "discerning_reader",
    name: "The Discerning Reader",
    color: "#6E6E6E",
    glyph: "◌",
    tagline:
      "You have high standards. Most books don't reach you — and when one does, it matters.",
    blurb:
      "The Discerning Reader is the one Bibliome archetype assigned from verdicts rather than feelings. How it is produced, why it is not an insult, and how it usually ends.",
    primary: [],
    anti: [],
    blindSpots: [
      "You decide a book has failed you before it has finished",
      "You might be reading the wrong shelf, not the wrong books",
    ],
    tropes: ["Books that earn it", "Hidden gems", "Writers who never waste a page"],
    sections: [
      {
        h: "What this reader is",
        p: [
          "The Discerning Reader is someone for whom most books are not landing. They start plenty, finish a fair number, and close a lot of them feeling nothing much. It is not that they dislike reading. It is that they know exactly what it feels like when a book works, and they are not getting it often enough.",
          "When one does get through, it matters out of all proportion. This reader remembers the hits with unusual clarity, because there are fewer of them, and will press a book they loved on everyone they know. High standards are not the same as a closed door; they are a door that opens rarely and all the way.",
        ],
      },
      {
        h: "The emotions that produce it",
        p: [
          "None, and that is the honest answer. This is the one archetype Bibliome does not build from feelings. Its lists of defining and anti-emotions are empty on purpose. It comes instead from the other question Bibliome asks when you finish a book: how did it land? Loved it, liked it, mixed, or not for me.",
          "The engine assigns it once you have judged at least 8 books, finished or abandoned, and 60 per cent or more of them didn't land. A not for me counts fully, and so does an abandoned book; a mixed counts as half; paused books are not counted at all. Until both of those are true, the feelings you logged decide your archetype as usual.",
          "It is not an insult, and it is not a verdict on you as a reader. More often than not it means you are on the wrong shelf — reading what you think you should, or what everyone else loved — rather than that books have stopped working for you. The pattern is information, and it is pointing somewhere.",
        ],
      },
      {
        h: "What they reach for",
        p: [
          "Books that earn it, hidden gems, writers who never waste a page. The slim novel with no filler. The backlist title nobody is talking about. The author whose every sentence looks load-bearing.",
          "They trust a specific recommendation from a specific person far more than a bestseller list, and they are more likely than most to abandon a book early and feel fine about it.",
        ],
      },
      {
        h: "What they avoid",
        p: [
          "Hype. The book of the season. Anything that seems to have been assembled from a list of what readers like.",
          "Bibliome's two blind spots here: you decide a book has failed you before it has finished, and you might be reading the wrong shelf, not the wrong books. The second is the useful one. A run of books that didn't land is often a run of books picked for the wrong reasons, and the fix is usually a different section of the shop rather than a harder heart.",
        ],
      },
      {
        h: "The nearest archetype",
        p: [
          "There isn't one in the usual sense — this archetype sits beside the map rather than on it. Keep logging how books made you feel, including the ones that didn't land, because the engine is still reading those feelings underneath. Once more of your books land, a feeling archetype takes over, and the feelings you logged along the way decide which one. Often it turns out to be a shelf that was waiting for you all along.",
        ],
      },
    ],
  },
];

export const bySlug = (slug) => ARCHETYPES.find((a) => a.slug === slug);
