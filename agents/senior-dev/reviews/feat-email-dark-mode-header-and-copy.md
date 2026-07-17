# Senior review — feat/email-dark-mode-header-and-copy

- **Reviewed:** 2026-07-17
- **Head:** 1a9eed6
- **Verdict:** APPROVE WITH QUESTIONS

## Summary
Two independent changes to the sign-in flow. (1) The magic-link email header band is
swapped from live HTML text to a baked PNG (`public/email-header.png`, served at
`getpoold.app/email-header.png`), because Gmail-app / Outlook-mobile force-invert colors
in dark mode and flip the fairway band to light mint — image pixels don't get recolored,
so the brand holds. A new `scripts/og/build-email-header.mjs` + `email-header.html`
(+ `npm run og:email`) render it via headless Chrome, cloned from the existing OG-card
toolchain. (2) User-facing copy renames "magic link" → "sign-in link" in Login, Join, and
Privacy. Both changes are low-blast-radius and sound. The PNG-header fix is a legitimate,
industry-standard workaround for forced dark-mode inversion, and the copy rename is
consistent across the product surfaces. The concerns below are about the *fallback* story
and the manual deploy sequence, not the core approach.

## Findings
Ranked most-severe first.

- **[debt] Images-off fallback is weaker than the comment claims — `font-size:0` on the
  `<td>` likely zeroes the alt text** (`supabase/templates/magic_link.html:57-59`). The
  header `<td>` sets `font-size:0; line-height:0;` (a common trick to kill the whitespace
  gap under an image). But when a client blocks remote images — desktop Outlook and many
  privacy modes do so by default — the browser renders the `alt` text ("POOLD — Make it
  interesting.") *inheriting that `font-size:0`*, so it can render invisibly. The comment
  advertises "alt text names the brand" as the images-off fallback, but the styling works
  against it. Net effect with images off: a fairway-green band (the `bgcolor` does work)
  with a probably-invisible or dark-on-dark wordmark. **Not a blocker** — the header is
  decorative and the actual sign-in *button* below is real HTML that always renders, so
  sign-in never breaks; this is cosmetic degradation only. Fix direction: move the font
  styling (a small `font-size`, cream `color`) onto the `<img>` itself instead of
  `font-size:0` on the `<td>`, and use `display:block` (already present) to close the gap.

- **[debt] `build-email-header.mjs` is a near-verbatim copy of `build-og.mjs`**
  (`scripts/og/build-email-header.mjs`). The two scripts are identical except for the
  input HTML, output path, and window size — same `CHROME_CANDIDATES`, same tmp-dir
  dance, same flags. Acceptable for two files; if a third baked image ever appears,
  extract a shared `renderCard(html, out, {width,height})` helper rather than cloning a
  third time. Low priority, flagging so it's a conscious choice.

- **[nit] The primary CTA button is still vulnerable to the exact inversion the header
  fix defends against** (`supabase/templates/magic_link.html:80-84`). The "Sign in to
  Poold" button is real HTML with a fairway `#1B4332` background. In the same Gmail-app /
  Outlook-mobile clients that flip the header band to light mint, the button background
  can flip too — so the end state is a correct (image) header sitting above a
  possibly-inverted button. This is fine for *function* (dark-text-on-light-button stays
  readable after inversion) and keeping the button as real HTML is a deliberate, defensible
  choice (tappable link, not an image map). Raising it only so the "we fixed dark mode"
  claim is understood to cover the header, not the whole email.

- **[nit] Docs still say "magic link" in user-describing prose** (`docs/PAGES.md`,
  `README.md`). Out of scope for me to edit — flagging for the pm-sync handoff so the
  docs match the new "sign-in link" copy. The shipped product surfaces (Login, Join,
  Privacy, and the email *body*, which already read "sign-in link") are consistent; the
  design-prototype HTML under `docs/design_prototype/` is a frozen snapshot and not
  user-facing.

## Questions for the founder

1. **Deploy order — this one is load-bearing.** The email template lives in the Supabase
   dashboard and is updated by *hand-pasting* `supabase/templates/magic_link.html` into
   it; the repo copy is just the versioned source, nothing auto-applies it. The template
   now points at `https://getpoold.app/email-header.png`. So the safe sequence is: **merge
   this branch first → wait for Netlify to finish deploying → open that URL in a browser to
   confirm the image loads → only then paste the new template into the dashboard.** If you
   paste the template *before* the image is live, every sign-in email 404s the header for
   as long as the gap lasts. Are you set up to do it in that order (merge/deploy, verify
   URL, then dashboard)?

2. **The "images off" case — is a green band with no visible wordmark acceptable?** Some
   mail clients (notably desktop Outlook, and anyone who blocks remote images for privacy)
   won't load the header PNG. Before this change, those users still saw the "POOLD" text
   because it was real HTML. After it, they'll see a fairway-green bar and, because of a
   styling detail (finding #1), likely *no* readable wordmark — the sign-in button below
   still works fine, so nothing breaks, it just looks blank up top. Two options: (a) accept
   it as-is since most people who *just requested* a sign-in email will have images on, or
   (b) I tweak the template so the alt text ("POOLD — Make it interesting.") shows in cream
   when the image is blocked. Which do you want?

3. **Baking the header as a PNG is the right call — do you accept the maintenance cost it
   adds?** The trade: you get bulletproof brand color in dark mode (the whole reason for
   this change), but the wordmark is now pixels, not text. That means (a) if the brand
   colors or the tagline ever change, you have to re-run `npm run og:email`, re-commit the
   PNG, and re-verify the URL — it's no longer "just edit the HTML"; and (b) the header is
   slightly less accessible to screen readers than live text (mitigated by the alt text).
   This is a normal, common email-dev trade and I'd make the same one — just confirming
   you're signing up for the "regenerate + commit the image" workflow going forward.
