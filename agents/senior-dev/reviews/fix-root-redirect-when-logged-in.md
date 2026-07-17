# Senior review — fix/root-redirect-when-logged-in

- **Reviewed:** 2026-07-16
- **Head:** af416b5
- **Verdict:** APPROVE

## Summary
One-file, 12-line change to `src/App.jsx`. The root route `/` used to render `<Login />`
unconditionally, so a signed-in visitor typing `getpoold.app` always landed on the login
screen. This adds a `RootRoute` guard that reads the auth session, renders nothing while
the session is still resolving, sends signed-in users to `/dashboard`, and shows `<Login />`
otherwise. It solves the real problem at the right layer and does so by copying the exact
idiom the codebase already uses for `ProtectedRoute` / `AdminRoute` (`if (loading) return
null` → auth check → `<Navigate replace />`). I traced the control flow for signed-in,
signed-out, and unnamed-profile visitors and found no correctness bug, no redirect loop, and
no regression to onboarding. Clean to merge. One non-blocking behavioral note below.

## Findings
Ranked most-severe first.

1. **(nit) Signed-out visitors now see a brief blank before the login form —
   `src/App.jsx:27`.** Previously `/` rendered `<Login />` instantly. Now `RootRoute`
   returns `null` (a blank page) until `loading` flips false. For a signed-out visitor there
   is no profile fetch — `getSession()` just reads the local session token — so the blank is
   effectively imperceptible, and it matches how every other guarded route in the app already
   behaves. Calling it out only because `/` is the public first-impression surface (where new
   users arrive), not because it's a real problem. No change required; see the question below
   if you want to remove even the theoretical flicker.

No blockers, no tech debt. The control flow is sound:
- **Signed in:** `null` while loading → `<Navigate to="/dashboard" replace />`. `ProtectedRoute`
  on `/dashboard` still runs, so an unnamed profile still bounces to `/welcome` — onboarding
  is unchanged, exactly as the PR claims.
- **Signed out:** `null` while loading → `<Login />`.
- **No redirect loop:** `RootRoute` and `ProtectedRoute` read the same `user` in the same
  render pass, so `/` → `/dashboard` → `/` can't ping-pong.
- Imports (`Navigate`, `useAuth`) are already present; nothing missing.

## Questions for the founder
Nothing that blocks the merge. One optional decision:

1. **The blank-then-login moment on the landing page — keep it or kill it?** "Guarding" the
   root route means the app has to first check whether you're already signed in before it
   knows what to show, and while it checks it renders a blank screen. That check is fast for
   signed-out visitors (it's just a local token read, no network), so in practice you won't
   see it — and this is the same pattern the rest of the app uses, so it's consistent. If you
   ever wanted zero flicker on the public landing page specifically, the alternative is to
   show `<Login />` immediately and let it redirect *itself* once the session resolves — but
   that's more moving parts for a gain nobody will notice. My recommendation: leave it exactly
   as written. Raising it only so the trade is a choice, not an accident.
