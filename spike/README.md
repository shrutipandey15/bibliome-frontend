# Capacitor spike

Throwaway. It exists to answer the four go/no-go questions in
[`../docs/mobile-plan.md`](../docs/mobile-plan.md) §4 **before** any mobile layout work
starts, so a dealbreaker surfaces at hour one rather than after eleven screens.

It touches nothing in `../src`. Its own `package.json` and `node_modules` are separate
from the app's.

---

## The three ways to run it, cheapest first

### 1. Phone browser — no tooling at all

```sh
cd spike && python3 serve-https.py
```

It prints a `https://<lan-ip>:8443/` URL. Open it on any phone on the same Wi-Fi, tap
**Run Q1–Q3**, work through the Q4 checklist. Results **POST back automatically** to
`spike/result-<platform>.json`; the terminal prints a one-line summary as they arrive.
For an unattended run, use the `?autorun=1&post=1` URL it also prints.

HTTPS matters here and isn't optional: on a plain `http://` LAN address `crypto.subtle`
is unavailable (non-secure origin) and **Q1 fails for the wrong reason**. The script
generates a self-signed cert, so the phone warns once — Android Chrome: *Advanced →
Proceed*; iOS Safari: *Show Details → visit this website*.

(`npm run serve` still exists for plain http on :5050. Only useful from `localhost`.)

What this tier is good for: Android Chrome and Android System WebView share the Blink
engine, so Q2's number is representative there. iOS Safari and WKWebView both run
JavaScriptCore/WebKit, so iOS Safari is a *decent* proxy for Q1/Q2 — but not for the
Q4 feel questions, where Safari's chrome and a WKWebView differ exactly where it
matters (keyboard insets, bottom bar, overscroll).

### 2. Android WebView — needs Android Studio

```sh
cd spike
npx cap sync android
npx cap run android          # or: npx cap open android, then Run
```

`spike/android/` is already scaffolded. You need the Android SDK + a device or
emulator; this machine has neither, so this step was not executed here.

**Run Q2 on the worst phone you can find**, not a flagship. That is the whole point of
the question.

### 3. iOS WKWebView — needs a Mac

```sh
cd spike && npx cap add ios && npx cap open ios
```

Not possible from Linux. This is the only tier that tests WKWebView, and WKWebView is
the one that would actually surprise you — so it cannot be skipped before committing
to Capacitor.

### Optional: the real app, for the Q4 feel test

```sh
cd spike && npm run overlay-app
```

Builds `../dist` and overlays it into `www/`, moving the probe to `/probe.html`. Use
this to judge scroll and keyboard behaviour on the actual journal and echo composers.
The app's `/api` calls will fail — expected; a working session needs the A2 auth path
from Phase 1. Restore with `git checkout spike/www`.

---

## What each question decides

| | Question | Reverses the Capacitor decision if… |
|---|---|---|
| **Q1** | Does `crypto.subtle` work, exactly as `journalCrypto.js` uses it? | It's absent or partial. Then §1 Blocker B reappears and React Native's cost gap narrows sharply. |
| **Q2** | How long is PBKDF2 @ 600k on a real phone? | It's slow. **This does not by itself reverse anything** — the fix is lower `kdf_params` on a per-user re-wrap, and params already travel with each bundle. But it must be known now, because §5a re-locks the journal on *every app close*, so the cost is paid constantly, not once. |
| **Q3** | Is the native bridge live, and what's registered? | Nothing here reverses it; it's the starting point for the A2 Keychain/Keystore work, which needs its plugin installed in Phase 1 before the auth path is genuinely proven. |
| **Q4** | Do scroll and keyboard survive the two composers? | They don't. This is the honest failure mode for a WebView app and the least fakeable — hence a checklist you fill in by hand, not a number. |

Q1 mirrors `src/services/journalCrypto.js` line for line: PBKDF2 → `wrapKey`, both
unlock paths, DEK identity across them, an AES-GCM entry round trip with non-ASCII, and
a wrong-password case that **must** be rejected by the AEAD tag.

## Reference numbers — desktop, already measured

Run headlessly in Chrome 147 (Blink, the same engine as Android System WebView) on
x86_64:

```
Q1  all 8 steps pass
    crypto.subtle · generateKey · deriveKey · wrapKey ×2 · unwrapKey both paths
    · both paths recover the same DEK · AES-GCM round trip · wrong password rejected
Q2  PBKDF2 600k → 132, 130, 125 ms   (median 130 ms)
```

Cross-checked under Node 18's WebCrypto: same three correctness results, 266 ms median
— Chrome's BoringSSL path is about 2× faster than Node's, which is worth knowing when
comparing numbers across runs.

Treat **130 ms as the floor**. A mid-range Android phone typically lands 4–8× slower
and a low-end one worse — plausibly 0.5–1.5 s, i.e. the boundary between the probe's
"fine" and "usable but felt" bands. Getting the real number is Q2's entire job; do not
infer it from this line.

## Reading the verdict

- **Q1 fails** → stop, reopen the framework decision.
- **Q1 passes, Q2 slow** → Capacitor still fine; open a separate ticket on `kdf_params`
  calibration (the probe's *Calibrate to 500ms* button gives you the target iteration
  count for that device).
- **Q4 checklist mostly unchecked on iOS** → the serious warning sign. Capacitor's
  weakness is feel, not capability.

Paste the copied JSON back into the conversation and the plan gets updated against real
numbers.
