// The /vs/ pages. Same contract as data/archetypes.js: dependency-free, because
// vite.config.js imports this in Node to prerender each page.
//
// Every claim about Bibliome here has to be true of the shipped app. Claims
// about the other product are deliberately descriptive rather than disparaging
// — the reader arriving on this page is usually a happy user of the other one.

export const COMPARISONS = [
  {
    slug: "goodreads",
    other: "Goodreads",
    title: "Bibliome vs Goodreads",
    blurb:
      "Goodreads catalogues that you read a book. Bibliome records what it did to you. An honest comparison of the two, including what Goodreads does better.",
    intro:
      "Both are places to put the books you have read. That is where the overlap ends. Goodreads is a catalogue with a social network attached; Bibliome is a private emotional record with no social network at all, by design rather than by omission.",
    // [feature, bibliome, other]
    table: [
      ["Rating a book", "No stars. You record which of 18 emotions it pulled, and how strongly.", "1–5 stars, plus a public average."],
      ["What it produces", "A reading archetype — one of 8, assigned from your emotional patterns after 5 books.", "A shelf, a yearly count, and a rating history."],
      ["Social layer", "None. Nobody can follow you and there are no counts on anything.", "Friends, followers, feeds, likes, comments."],
      ["Reading goals", "None. No page counts, no streaks, no yearly challenge.", "Yearly Reading Challenge, page-count tracking."],
      ["Privacy of notes", "The private journal is end-to-end encrypted in your browser. Bibliome cannot read it.", "Reviews are public by default; private notes are readable by the service."],
      ["Discovery", "Not a recommendation engine. It describes the reading you have already done.", "Recommendations, lists, giveaways, the Choice Awards."],
      ["Catalogue size", "Search via open book data. Good coverage, not exhaustive.", "The largest book database of any consumer app, by a wide margin."],
      ["Price", "Free. No ads, no third-party analytics, no data selling.", "Free, ad-supported, owned by Amazon."],
    ],
    sections: [
      {
        h: "The actual difference",
        p: [
          "Goodreads answers the question what have I read. It is very good at it — twenty years of data, the deepest catalogue in the category, and the network effect that comes with everyone else already being there.",
          "Bibliome answers a different question: what did those books do to me. You do not give a book a score. You open one emotion family at a time, pick the feelings that fit from 18, and give each one a strength. After five books the engine reads the pattern back to you as an archetype — the Grief Romantic, the Midnight Arsonist, the Comfort Architect, one of eight — worked out from what you actually recorded, never a quiz and never something you pick.",
          "A star rating is a verdict you deliver about a book. An emotional record is a description of what happened to you. The second one turns out to say considerably more about the reader.",
        ],
      },
      {
        h: "What Goodreads does better",
        p: [
          "The catalogue. If you read obscure, out of print, or non-English books, Goodreads will have them and Bibliome may not.",
          "Discovery, if you want it. Bibliome deliberately does not recommend your next book; that is not a roadmap gap, it is a design position. If you rely on recommendations, you will miss them here.",
          "Your friends are already on it. Bibliome has no follower graph at all, so if the social feed is the reason you log books, nothing here replaces it.",
        ],
      },
      {
        h: "Can I bring my Goodreads library across?",
        p: [
          "Yes. Export your library as a CSV from Goodreads and upload it; Bibliome imports the titles and tells you honestly how many parsed, imported, and were skipped. The emotional record starts empty, because Goodreads never collected it — the five-book threshold for your first archetype counts books you have logged emotionally, not books you have imported.",
          "Nothing stops you using both. A fair number of people do: Goodreads for the catalogue and the friends, Bibliome for the part that is nobody else's business.",
        ],
      },
    ],
  },

  {
    slug: "storygraph",
    other: "The StoryGraph",
    title: "Bibliome vs The StoryGraph",
    blurb:
      "The StoryGraph uses mood to recommend your next book. Bibliome uses emotion to describe the reader you already are. Where the two actually diverge.",
    intro:
      "This is the harder comparison, because on the surface the two look alike: both are Goodreads alternatives, both talk about mood, both draw charts. The difference is direction. The StoryGraph points forward at your next book. Bibliome points backward at you.",
    table: [
      ["Core question", "What did this book do to me?", "What should I read next?"],
      ["Emotional input", "18 emotions in five families, each logged with a strength, per book.", "Mood tags and pace, plus a 5-star rating with half stars."],
      ["What it produces", "A reading archetype — one of 8, assigned from your patterns after 5 books.", "Stats, charts, and mood-and-pace based recommendations."],
      ["Recommendations", "None. Not a recommendation engine and not planned as one.", "Central to the product, and genuinely good."],
      ["Social layer", "None. No followers, no counts, one small public room that ends in “you're caught up.”", "Friends, buddy reads, readalongs."],
      ["Privacy of notes", "The private journal is end-to-end encrypted in your browser. Bibliome cannot read it.", "Reviews can be private; the service can read them."],
      ["Content warnings", "Not a feature.", "Crowd-sourced content warnings, one of its best features."],
      ["Price", "Free. No ads, no third-party analytics, no data selling.", "Free tier plus a paid Plus tier."],
    ],
    sections: [
      {
        h: "Mood versus emotion",
        p: [
          "The StoryGraph asks what a book is like — dark, reflective, adventurous, fast or slow. That is a property of the book, collected so it can be matched against other books. It is the right shape of data for a recommendation engine, and The StoryGraph's is the best in the category.",
          "Bibliome asks what a book did to you — grief, dread, recognition, catharsis, amusement, and 13 more, each at a strength you set. That is a property of the reading, not of the book, and the same novel will be logged completely differently by two people. It is nearly useless for recommending your next read and it is the only kind of data from which you can derive a reader.",
          "Neither is a better version of the other. They are answers to two questions that happen to use overlapping vocabulary.",
        ],
      },
      {
        h: "What The StoryGraph does better",
        p: [
          "Recommendations, unambiguously. If you want an app to tell you what to read next, use The StoryGraph; Bibliome will never do this.",
          "Content warnings, which are crowd-sourced, detailed, and something Bibliome does not offer at all.",
          "Reading stats in the conventional sense — pace, page counts, format breakdowns, a yearly picture. Bibliome measures none of that on purpose. There are no page counts, no reading-speed stats, no yearly challenges and no streaks.",
        ],
      },
      {
        h: "Which one you actually want",
        p: [
          "If the problem is a to-read pile you cannot choose from, that is The StoryGraph's problem to solve, and it solves it.",
          "If the problem is that you have read two hundred books and could not say what any of them did to you, that is this one. Bibliome is a private mirror: the emotions you reach for, the ones you have never once recorded, what shows up together, and the archetype that falls out of it.",
          "You can import into Bibliome from The StoryGraph — export your library as a CSV and upload it — and plenty of people keep both, because they are not really competing for the same slot.",
        ],
      },
    ],
  },
];

export const compareBySlug = (slug) => COMPARISONS.find((c) => c.slug === slug);
