# Senior review — pwa-foreground-update-check

- **Reviewed:** 2026-09-09
- **Head:** 63b00e2 (branch tip; product change under review is c0fc8e8, plus a docs-only pm-sync on top)
- **Verdict:** APPROVE WITH QUESTIONS

## Summary
Small, contained PWA change. It stops letting the VitePWA plugin auto-inject its bare
service-worker registration (`injectRegister: false`) and instead registers manually in
`main.jsx`, adding a `visibilitychange` listener that calls `registration.update()` every
time the app comes to the foreground. Goal: an installed iOS home-screen icon that only
gets a fresh registration on a true relaunch will now re-check for a new version each time
it's reopened, instead of going stale until force-quit. `registerType: 'autoUpdate'` is
unchanged, so a found update still auto-reloads. The `virtual:pwa-register` usage is
correct, the config is right, and `vite build` succeeds and emits the service worker with
`workbox-window` bundled (the auto-reload-on-activate path). Plus a copy-only cleanup of
the iPhone install steps and the matching PAGES.md paragraph. Clean; two small notes below.

## Findings

- **nit — `src/main.jsx:19`, unhandled promise rejection when offline.**
  `registration.update()` returns a promise. When the app is foregrounded while offline (or
  the SW-script fetch otherwise fails — common on a phone that just woke up with no signal
  yet), that promise rejects and nothing catches it, so you get an "Unhandled promise
  rejection" in the console on every such foreground. Not user-visible and not harmful, but
  since foregrounding-while-offline is exactly the mobile case this feature targets, it'll
  fire in the wild. One-line fix: `registration.update().catch(() => {})`.

- **nit — foreground update-check frequency.** `update()` fires on *every* return to
  foreground, which on a phone can be many times a session. Each is a single cheap request
  for the small SW script (not app data), so cost is negligible — noting only so it's a
  known, deliberate frequency rather than an accident. No change needed.

Everything the PR description claims checks out: `injectRegister: false` is the correct
pairing for manual registration (leaving it `'auto'` would have double-registered), the
`onRegisteredSW(swUrl, registration)` signature matches vite-plugin-pwa v1.x, the
`if (!registration) return` guard is right, and registering at module top-level (not inside
a React component) means StrictMode won't double the listener.

## Questions for the founder

1. **Auto-reload on foreground — is that the trade you want?** With `autoUpdate`, when the
   foreground check finds a new version, workbox reloads the page automatically. "Reload"
   here means the browser throws away whatever is currently on screen and re-fetches the
   app fresh — including any *unsaved* form state. Concretely: a user starts filling out a
   picks card, switches away to another app without submitting, you ship a deploy, and when
   they switch back the app reloads and their half-entered picks are gone. It's a narrow
   window (background mid-entry *and* a deploy lands *and* they return before submitting),
   and it was already possible with `autoUpdate` on any page load — this change just makes
   the check happen more often, so it's a bit more likely. Anything already saved to the
   server is safe; only unsubmitted on-screen input is at risk. If that's an acceptable
   cost for always-fresh installs, no action needed — just confirming you'd rather have
   "always up to date" than "never interrupt an in-progress card."
