# Senior review — design-sync/claude-design-import

- **Reviewed:** 2026-07-17
- **Head:** a598d44
- **Verdict:** APPROVE

## Summary
This branch adds Claude Design sync scaffolding under `.design-sync/` so the design
agent builds against Poold's real 15 UI components and brand tokens. It touches **no
`src/` app code and no app build config** — verified against the full diff (only
`.design-sync/**` and `.gitignore` change). The two preview-only shims (supabase stub,
ASCII-safe scoring copy) are swapped in exclusively by the design-sync bundler's own
tsconfig paths; the app's Vite build cannot see them. The scoring shadow is behaviorally
faithful to source, and the "latent regex bug" NOTES flags is accurately characterized.
Clean, low-risk, self-contained tooling. Safe to merge. The findings below are minor
tech-debt notes, none blocking.

## Findings

### 1. Shims provably cannot affect the app build — verified (not a problem)
`.design-sync/tsconfig.ds.json` remaps `../lib/supabase` → the stub and
`../../utils/scoring` → the ASCII copy. That remap only happens if a bundler is told to
read that tsconfig. The app's `vite.config.js` is just `react()` + `tailwindcss()` — no
`vite-tsconfig-paths` plugin, and there's no root `tsconfig.json` — so `npm run build` /
`npm run dev` never consult those paths. The swap is scoped to the design-sync tool via
`config.json`'s `"tsconfig"` key. Claim confirmed: preview-only, no runtime bleed.

### 2. Scoring shadow is behaviorally faithful — verified
`.design-sync/scoring-preview.js` rebuilds each regex from `String.fromCharCode` instead
of literal characters. I diffed it char-for-char against `src/utils/scoring.js`:
- Atomic-letter map (`ATOMIC_CODES`/`ATOMIC_VALUES`) matches all 10 entries
  (ø→o, æ→ae, œ→oe, ð→d, þ→th, ł→l, đ→d, ß→ss, ı→i, ħ→h).
- Combining range `̀–ͯ`, punctuation `['’.]`, dash `[-–—_]`,
  and the `parseScore` / `formatScore` bodies (incl. the U+2013 en-dash null return) are
  identical. No behavior drift.

### 3. NOTES' latent-bug characterization is accurate — but real-app risk is very low (nit)
`src/utils/scoring.js:27` writes `/[̀-ͯ]/` with literal U+0300–U+036F bytes. NOTES claims
that if the bundle is decoded as non-UTF-8, that class mojibakes into an out-of-order
range and throws at parse time. That is correct under a Windows-1252 decode: the UTF-8
lead byte `0x80` maps to `€` (U+20AC), which sorts *after* the range's upper char, giving
a genuine "Range out of order in character class" SyntaxError. The recommended
`\u`-escape source fix is right and cheap. **Caveat for the founder:** the deployed app
serves these as ES modules, which browsers are *required* to decode as UTF-8 regardless
of headers — so the crash essentially can't reach production; it's a real hazard only on
the design-sync tool's own non-module load paths. The shadow already neutralizes it there.

### 4. The preview-data generator is not committed (debt)
`.design-sync/preview-data.js` (3,290 lines) and `NOTES.md` both cite
`.ds-sync/gen-preview-data.mjs` as the script that regenerates it from
`src/demo/demoData.js` — but `.gitignore` ignores `.ds-sync/`, so that generator is *not*
in the repo. The PR says committing this makes re-syncs "reproducible"; that's only partly
true — the large generated artifact is checked in, but the tool that reproduces it lives
only on the author's machine. If `demoData.js` changes, whoever re-syncs can't regenerate
without recreating the script. Cost is low (preview cosmetics, not app behavior), but the
reproducibility claim is slightly overstated. Consider committing the generator too, or
softening the NOTES wording.

## Questions for the founder

**(Optional, non-blocking — the branch is safe to merge as-is.)**

1. **The 2-line source fix.** NOTES suggests changing `src/utils/scoring.js` to write its
   regexes with `\u` escapes (e.g. `̀-ͯ`) instead of literal accented
   characters, which would let the ASCII shadow be deleted entirely. It's a genuine
   robustness improvement and harmless. But per your own boundaries this PR deliberately
   touches zero `src/` — do you want to (a) leave source alone and keep the shadow, or
   (b) file the source tweak as a tiny follow-up so the shadow can eventually go away? Not
   needed for this merge either way.

2. **The uncommitted generator (Finding 4).** Do you want the
   `gen-preview-data.mjs` script checked in so future preview-data regeneration is
   self-serve, or is this a throwaway you'll always run by hand? If the latter, worth
   softening the "reproducible" language so a future you isn't hunting for a missing file.
