/**
 * Privacy policy and terms of service.
 *
 * Every factual claim here was written against the code, not from a template:
 *  - the journal's end-to-end encryption is journalCrypto.js + journalCryptoContract.md
 *  - self-service export is GET /api/user/export, deletion is POST /api/user/delete
 *  - the third parties named are the only outbound calls the backend makes
 *  - the moderation description matches app/services/moderation.py
 * If one of those changes, this file changes with it. A policy that overclaims
 * privacy is worse than none; a policy that overclaims *permission* — the usual
 * boilerplate move — gives away protections the product actually offers.
 *
 * ⚠ THREE FACTS ONLY THE OPERATOR CAN SUPPLY are marked TODO below. Fill them
 * before linking these pages anywhere public. This is a careful draft, not
 * legal advice, and it has not been reviewed by a lawyer.
 */

export const OPERATOR = {
  // TODO: the legal name you're operating under. If Bibliome is not a
  // registered entity, your own name is the honest answer here.
  name: "TODO_OPERATOR_NAME",
  // TODO: a working contact address you actually read. Required in practice for
  // GDPR/DPDP-style requests, and the address deletion questions will arrive at.
  email: "TODO_CONTACT_EMAIL",
  // TODO: the country/state whose law governs, normally where you live.
  jurisdiction: "TODO_JURISDICTION",
};

const UPDATED = "9 August 2026";

export const PRIVACY = {
  title: "Privacy Policy",
  updated: UPDATED,
  sections: [
    {
      heading: "The short version",
      body: [
        "Bibliome is a reading journal. It holds things people don't say out loud, so the design goal is to collect little and to make what is collected leaveable.",
        "Your private journal is encrypted in your browser before it is sent. We cannot read it. Not from the database, not from a backup, not if compelled. Everything else on this page is detail.",
        "We do not sell your data, we do not run advertising, and there are no third-party analytics or tracking scripts on this site.",
      ],
    },
    {
      heading: "What we collect",
      body: [
        "Account details you give us: an email address, a username, a pseudonymous handle, and optionally a display name and bio. The email is used to sign you in, verify the account, and reset a password.",
        "What you log: books, the emotions and intensity you record against them, reading progress, check-ins, collections, and any Echoes you post.",
        "Derived material: your Reading DNA snapshots and insights, computed from your entries.",
        "Your private journal, as ciphertext only — see the section below.",
        "Operational records: a password hash (never the password), session refresh tokens, rate-limiting counters, and server logs. Logs are for keeping the service up and safe, not for building a profile of you.",
      ],
    },
    {
      heading: "The journal is end-to-end encrypted",
      body: [
        "Journal entries are encrypted in your browser with a key derived from your password. What reaches our server is ciphertext and the wrapped key. The plaintext, and the key that opens it, never leave your device.",
        "This means: a database dump, a stolen backup, a subpoena served on us, or an administrator with full server access yields ciphertext. We have no way to decrypt it.",
        "It also means we cannot recover a journal if you lose both your password and your recovery code. That is the cost of the guarantee, and we would rather state it plainly than quietly keep a spare key.",
        "One honest limit: browser-based end-to-end encryption cannot protect you from a compromised server sending malicious JavaScript to your browser. No web-delivered E2E system can. We would rather you know that than believe in a stronger promise than exists.",
      ],
    },
    {
      heading: "What is public, and what never is",
      body: [
        "Echoes are public to the community and appear under your handle, not your email or username. Your profile is private by default; making it public is a choice you make in settings and can reverse.",
        "Reactions to Echoes are private — the author sees an aggregate, nobody sees a public count. There are no public like counts, follower counts, or leaderboards anywhere in Bibliome. That is a design decision, not an oversight.",
        "Resonance matches show no identity to either side until both people have agreed to connect. Private threads between connected readers are visible to the two of you.",
        "Your journal, your entries, your emotions, and your DNA are private unless you deliberately publish or share them.",
      ],
    },
    {
      heading: "Who else sees anything",
      body: [
        "A small number of third parties are involved in running the service, and no others:",
        [
          "Our email provider, to deliver verification, password-reset, and digest email. It sees your email address.",
          "Google Books and Open Library, queried when you search for a book. They see the search text, not who searched.",
          "Cloudflare, which fronts the site and sees standard network-level request data.",
        ],
        "We do not sell or rent personal data, and we do not share it with advertisers or data brokers. We may disclose data if legally compelled — and note that for the journal, compulsion produces ciphertext we cannot open.",
      ],
    },
    {
      heading: "Moderation",
      body: [
        "Public Echoes are scanned before publishing for threats and personal contact details, which route to review, and for language suggesting the author may be in crisis, which routes to support resources rather than any penalty.",
        "Reported content goes to a queue an administrator reviews. To decide on a report, an administrator sees the reported text and the author's handle.",
        "Reported private threads are handled differently: an administrator sees who is in the conversation and how many messages it holds, but the queue does not display the transcript. Blocking, which you control yourself, is the primary remedy for a private conversation.",
      ],
    },
    {
      heading: "How long we keep things",
      body: [
        "Your content stays until you delete it or close your account. Sign-in sessions expire after 30 days. Expired and revoked session tokens are purged periodically.",
        "Deleting your account removes your account, entries, emotions, journal ciphertext, collections, DNA snapshots, Echoes, and social records. It is immediate and it is not reversible.",
        "Encrypted backups are retained for a short window for disaster recovery, so a deleted account may persist in a backup briefly before ageing out.",
        "Administrative actions are recorded in an audit log for accountability. Those entries note what an administrator did and when.",
      ],
    },
    {
      heading: "Your controls",
      body: [
        "Export everything, at any time, as a single JSON file from your settings — account, entries, collections, DNA snapshots, Echoes, journal, and social records. No request, no waiting period.",
        "Delete your account yourself from settings. You do not have to email anyone and nobody has to approve it.",
        "Change your handle, or set your profile back to private, at any time.",
        "Depending on where you live you may also have rights to access, correct, or restrict processing of your data. The export and delete buttons already satisfy most of these directly; for anything else, write to us.",
      ],
    },
    {
      heading: "Cookies",
      body: [
        "One cookie, holding your session refresh token, set httpOnly and SameSite so scripts cannot read it and other sites cannot use it. It exists to keep you signed in.",
        "There are no advertising, analytics, or tracking cookies, so there is no consent banner to dismiss.",
      ],
    },
    {
      heading: "Children",
      body: [
        "Bibliome is not intended for children under 13, and accounts should not be created for them. If you believe a child has created an account, write to us and we will remove it.",
      ],
    },
    {
      heading: "Security",
      body: [
        "Passwords are hashed, never stored. Traffic is encrypted in transit. Sessions can be revoked. The journal is encrypted end-to-end as described above.",
        "No service is perfectly secure, and this one is run by a small operation. If you find a vulnerability, please report it to the contact address below rather than disclosing it publicly, and we will work with you.",
      ],
    },
    {
      heading: "Changes",
      body: [
        "If this policy changes materially — particularly anything affecting what is collected or who can see it — we will say so in the product rather than quietly editing this page and changing the date.",
      ],
    },
  ],
};

export const TERMS = {
  title: "Terms of Service",
  updated: UPDATED,
  sections: [
    {
      heading: "What this is",
      body: [
        `Bibliome is a personal reading journal operated by ${OPERATOR.name}. Using it means agreeing to what follows. If you disagree with any of it, the honest response is not to use the service.`,
        "You must be at least 13 years old to hold an account.",
      ],
    },
    {
      heading: "Your account",
      body: [
        "You are responsible for keeping your password and recovery code safe. Because the journal is end-to-end encrypted, losing both means losing access to your journal permanently — we have no master key and cannot restore it.",
        "One person per account. Don't impersonate someone else, and don't use a handle designed to be mistaken for another person.",
      ],
    },
    {
      heading: "Your content stays yours",
      body: [
        "You own what you write. You keep every right to it.",
        "You grant us only the narrow permission needed to run the service: to store your content, and to display it to the people you have chosen to show it to. That permission ends when you delete the content or your account. We do not claim the right to publish, license, sell, or train models on your writing.",
      ],
    },
    {
      heading: "What isn't allowed",
      body: [
        "On public surfaces and in private threads alike:",
        [
          "Harassment, threats, or targeting a person or group with abuse.",
          "Posting someone else's private information.",
          "Spam, advertising, or automated bulk posting.",
          "Content that is illegal where you or we are.",
          "Attacking the service — scraping at scale, breaking rate limits, probing for vulnerabilities without telling us, or trying to reach other people's data.",
        ],
        "Writing frankly about difficult feelings, including your own, is the point of this product and is not a violation. Our classifier routes language suggesting crisis to support resources, never to a penalty.",
      ],
    },
    {
      heading: "Moderation and enforcement",
      body: [
        "Content that draws enough reports may be hidden automatically pending review. Review can restore it — that is what the dismiss path is for — and a wrongly hidden Echo coming back is the expected outcome, not a favour.",
        "We may remove content or suspend accounts for the conduct listed above. For anything short of the clearly severe, we would rather tell you what the problem is than act silently.",
        "You can report content, and you can block another reader. Blocking closes any conversation between you and hides you from each other.",
      ],
    },
    {
      heading: "Availability",
      body: [
        "Bibliome is provided as it is, without warranty. It is a small, self-hosted service run by a small operation: it may go down, and features may change or be withdrawn.",
        "Keep your own copy of anything you would be upset to lose. The export button exists for exactly this, and takes one click.",
        "To the extent the law allows, we are not liable for indirect or consequential losses arising from using the service. Nothing here limits liability that cannot lawfully be limited.",
      ],
    },
    {
      heading: "Ending it",
      body: [
        "You can delete your account yourself, at any time, from settings. It takes effect immediately and removes your data as described in the privacy policy.",
        "We may close an account for serious or repeated breaches of these terms. Where circumstances allow, we will give you a chance to export your data first.",
      ],
    },
    {
      heading: "Governing law",
      body: [
        `These terms are governed by the laws of ${OPERATOR.jurisdiction}.`,
      ],
    },
    {
      heading: "Changes",
      body: [
        "We may update these terms. Material changes will be announced in the product, not slipped in by editing this page.",
      ],
    },
  ],
};
