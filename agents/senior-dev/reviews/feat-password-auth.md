# Senior review — feat/password-auth

- **Reviewed:** 2026-08-31
- **Head:** 430d19c
- **Verdict:** APPROVE WITH QUESTIONS

## Summary
Adds email+password sign-in as an alternative to the existing magic link, without
removing or changing the link flow. Login gets a "Sign-in link" / "Password" pill toggle
(`handleLinkSubmit` is the original `signInWithOtp` flow untouched; `handlePasswordSubmit`
calls `signInWithPassword` and leans on the existing `AuthContext` → `RootRoute` redirect).
Profile gets a "Password" card that sets/replaces the password via
`supabase.auth.updateUser({ password })`. `lib/profile.js` grows `PASSWORD_MIN`,
`validatePassword`, and a thin `savePassword` wrapper, mirroring the existing
`NAME_MIN`/`validateDisplayName`/`saveDisplayName` shape. The change is small, well-scoped,
and consistent with the file's established (token-light, hardcoded-hex) style. I traced the
redirect path — it works — and the four deliberate design decisions (no reset email, no
current-password step, client-side 8-char heads-up, generic-error copy) are sound as
described; I found no security hole hiding inside them. No blockers.

## Findings
Ranked most-severe first.

1. **(debt) Password inputs have no `autoComplete` / `name` attributes** —
   `src/pages/Login.jsx` (password field) and `src/pages/Profile.jsx` (both new-password
   fields). Plain English: browsers use these attributes to decide when to *offer to save*
   a password and *which saved value to fill in*. Without them, two things degrade for a
   feature whose entire selling point is convenience: (a) the browser/password-manager may
   not reliably prompt to save the password the user just set, and (b) on the Profile card,
   a manager may autofill the "New password" boxes with the account's *existing* saved
   password — quietly nudging the user to "re-save" their old password. The fixes are the
   standard hints: login email → `autoComplete="username"`, login password →
   `autoComplete="current-password"`; Profile's two fields → `autoComplete="new-password"`.
   This is not a correctness bug and it matches the file's current convention (the codebase
   uses `autoComplete` nowhere today), so it's low severity — but it's the one piece of
   polish that most directly affects whether the password path actually feels better than
   the link path.

2. **(nit) Profile "Save password" button isn't disabled on a blank confirm field** —
   `src/pages/Profile.jsx`, `disabled={pwSaving || !password}`. If the user fills the first
   box and leaves "Confirm password" empty, the click is allowed and falls through to the
   "Passwords don't match." error. Harmless — the validation catches it and gives feedback
   — just slightly less tidy than the Display Name card's `dirty` gating. Leave it or tighten
   it; either is fine.

## Questions for the founder
1. **One extra Supabase setting to check while you're already verifying the password
   minimum.** The Profile "Save password" card calls `updateUser({ password })`, which by
   default lets a signed-in user set a new password with no extra step — which is exactly
   what you want. But Supabase has a separate dashboard toggle (Authentication → roughly
   "Secure password change" / reauthentication) that, *if turned on*, makes that same call
   refuse unless the user re-confirms via a one-time code sent by **email**. Since the whole
   point of this PR is to avoid sending a second auth email, that toggle being on would
   silently break the Profile save (it'd return an error instead of saving). It's off by
   default, so this is almost certainly already fine — but since you're headed into that
   same Authentication settings screen anyway to confirm the min-length policy, it's a
   free 10-second check: confirm "Secure password change" / reauthentication is **off**.
   No code change either way — just a config confirm so a hidden dashboard setting can't
   quietly defeat the reset path you designed.
