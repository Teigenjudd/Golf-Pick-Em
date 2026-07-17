# Senior review — fix/email-footer-collapse

- **Reviewed:** 2026-07-17
- **Head:** 45cbd6a
- **Verdict:** APPROVE

## Summary
Small, well-scoped follow-up to #36. The magic-link email footer previously lived in a
second, detached `<table>` below the main white card; mobile clients (Gmail app / Outlook
mobile) treated that trailing brand block as a signature/quoted section and collapsed it
behind a "…" expander, leaving a stray ellipsis and a second box under the message. This
PR folds the footer into the main card table as its final `<tr>` with a `border-top`
divider, so there's one cohesive block with nothing for the client to collapse. The change
is confined to `supabase/templates/magic_link.html`, the table nesting is valid, and the
PR confirms the live dashboard template is already updated and verified on a real mobile
client in dark mode. Clean to merge.

## Findings

- **nit — `magic_link.html:116` (divider spans full card width, body text is inset).**
  The footer `<td>` keeps 24px horizontal padding while the body rows use 44px (desktop).
  A `border-top` sits on the edge of the `<td>` box, so the divider now runs nearly the
  full card width while the paragraph text above it is inset further. This is a common and
  usually intentional email pattern (full-bleed rule under inset content), and it's
  visually harmless — flagging only so it's a choice, not an accident. No change required.

- **nit — Outlook desktop renders `border-top` on a `<td>` reliably, but ignores the
  card's `border-radius`/`overflow:hidden` (pre-existing).** The rounded corners and clip
  were already squared-off in Outlook desktop before this PR; folding the footer in
  doesn't change that. The footer now inherits the card's white background instead of
  sitting on the page grey — that's the intended visual (border-top separates it), and it
  reads correctly on white. No action.

Correctness, tech-debt, and consistency axes: nothing. The change actually removes a
duplicated `class="container"` responsive-width table, so the footer now inherits the
card's mobile width for free — slightly less to maintain, not more.

## Questions for the founder
None — clean to merge.

Two things worth *knowing* rather than deciding (both already handled, no action):
- This file is the versioned copy; the email that actually sends is the one pasted into
  the Supabase dashboard. The PR notes that paste is already done and confirmed — so the
  fix is live and this commit just resyncs the source of truth. Nothing to do.
- The fix was validated on a real mobile client in dark mode, which is exactly where the
  original bug lived, so the risky path is the one that was tested.
