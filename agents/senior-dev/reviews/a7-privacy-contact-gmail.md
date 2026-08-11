# Senior review — a7-privacy-contact-gmail

- **Reviewed:** 2026-08-10
- **Head:** 2209a0d (`git rev-parse --short HEAD`)
- **Verdict:** APPROVE WITH QUESTIONS

## Summary
Pure copy swap: the three user-facing legal contacts (data-deletion line + Contact
section in `Privacy.jsx`, Contact section in `Terms.jsx`) move off `privacy@getpoold.app`
— which has no inbound MX record and bounces — onto `tljvllc@gmail.com`. Both the visible
text and the `mailto:` hrefs were updated together, so no link/label mismatch. This is the
interim mitigation named in BACKLOG A7, and it correctly solves the real problem: the
advertised contact address must reach a live inbox. No logic touched, markup is well-formed.
Clean change. My only questions are about *which* address, not the code.

## Findings

- **nit — every user-facing reference was caught; one out-of-scope one remains, correctly
  left alone.** A repo-wide search for the old address confirms the only remaining
  `privacy@getpoold.app` in product code is `CreateTournament.jsx:207`, where it's passed
  as Nominatim's `email=` courtesy param. That's not a mailbox anyone writes to — it's an
  identifier Nominatim's usage policy asks for so they can reach you about API abuse — so
  it doesn't need a live inbox and is rightly untouched. The other hits are all docs
  (CLAUDE.md, BACKLOG, PAGES), which pm-sync reconciles after this review. No stray
  user-facing reference was missed.

- **nit — raw Gmail as the public legal contact of record is a small professionalism
  downgrade, and it's acknowledged.** A `@gmail.com` address on the Privacy/Terms pages
  reads less trustworthy than a branded `@getpoold.app` one, and it exposes a personal-
  looking inbox. This is explicitly interim (A7 stays open for the real forwarder), so
  it's an accepted trade, not a defect. Flagging only so it isn't forgotten: the moment a
  forwarder exists, these three lines should go back to a branded address.

## Questions for the founder

1. **Is `tljvllc@gmail.com` actually a monitored inbox, and the right name to publish?**
   The entire point of this change is that the advertised address must receive mail — so
   this swap is only a fix if someone genuinely watches that box. Worth a sanity check:
   send one test email to `tljvllc@gmail.com` and confirm it lands. (Two mailboxes are in
   play here — see Q2 — so it's easy to publish the wrong one.)

2. **You published `tljvllc@gmail.com`, but BACKLOG A7's written interim plan (and PM.md)
   named `juddteigen@gmail.com` — was switching to the LLC address a deliberate choice?**
   Plain trade: `juddteigen@` is your personal box the backlog already pointed at;
   `tljvllc@` reads as the business/LLC and is arguably the better *legal* contact of
   record, but it's a different inbox than the docs assumed. Either is fine — just confirm
   the LLC box is the one you want on the legal pages so the code and the paper trail
   agree (pm-sync will then align BACKLOG/PM to whichever you pick).
