# Senior review — fix/nominatim-geocoding

- **Reviewed:** 2026-07-16
- **Head:** ab01520
- **Verdict:** APPROVE WITH QUESTIONS

## Summary
Swaps the course geocoder in `CreateTournament.jsx` from Open-Meteo's name-only search to
Nominatim free-text search, so UK links courses (The Open @ Royal Birkdale) stop returning
null lat/lon and blanking the weather widget. The provider swap is the right root-cause fix
(Open-Meteo geocodes towns, not course POIs, and comma-strings killed its name match), and
the mechanical details are correct: Nominatim's response array is read with `d?.[0]`, its
string `lat`/`lon` are `parseFloat`'d, and non-finite results collapse to `null` — matching
the pre-existing "coords null → weather silently omitted" contract. Failure handling is
unchanged (`.catch(() => null)`). This is a small, well-targeted change on a non-critical
feature. No blockers. The open items are two design confirmations and two nits, none of
which need to hold the merge if you're comfortable with the trades.

## Findings
Ranked most-severe first.

1. **(debt) No fallback ladder if the over-specified query misses — `CreateTournament.jsx:196`.**
   The query is now always `courseName, city, state` joined together. The old code sent
   *just* `"City, State"` when both were present, and only fell back to the bare course name.
   Prepending the course name buys precision the weather widget doesn't actually need
   (town-level is plenty) while adding a failure mode: if Slash Golf's `courseName` doesn't
   fuzzy-match an OSM feature, Nominatim with `limit=1` can return zero rows where
   `"City, State"` alone would have resolved the town — a silent regression for US stops that
   previously geocoded fine. The PR validated 3 courses (Birkdale, Southampton NY, TPC River
   Highlands), which is reassuring but thin. Low impact (weather fails silently, and it only
   bites future creations — Birkdale rows were backfilled by hand), but cheap to harden:
   either try the full string then retry with `city, state` on an empty result, or drop the
   course name and query town-only, since that's all weather needs.

2. **(debt) Nominatim policy compliance — `CreateTournament.jsx:202`.** Nominatim's public
   server asks callers to identify themselves. You correctly noted the browser won't let you
   set a `User-Agent` header — but Nominatim's usage policy explicitly accepts an `email=`
   query parameter as the identifier for exactly this case. Adding
   `&email=privacy@getpoold.app` to the request string is a one-token change that brings us
   into policy without a proxy and gives them a contact before they'd ever rate-limit us.
   Worth doing since we're on their free public endpoint.

3. **(nit) Geocoding is inline in the page component — `CreateTournament.jsx:198-211`.** Every
   other third-party fetch in this codebase lives behind a helper (`src/lib/oddsApi.js`,
   `src/lib/golf.js`) or an edge-function proxy; this one is a raw `fetch` buried in a
   `Promise.all` inside a React handler. Not wrong, and it matches how the *old* Open-Meteo
   call was written, so it's not a new inconsistency — but a small `geocodeCourse(query)`
   helper would make it testable and give the provider a single place to live next time it
   changes. Optional.

4. **(nit) Unrelated permission grant in the PR — `.claude/settings.local.json`.** The second
   commit adds `Bash(git fetch *)` to the local agent settings. Harmless and not product code,
   but it's scope creep on a geocoding PR and this file is normally personal/local rather than
   something to land on a shared branch. Trivial.

## Questions for the founder
Two decisions worth a yes/no before merge — neither is a bug, both are "is this the trade you
want."

1. **Precision vs. reliability in the geocode query.** Geocoding = turning a text string into
   a lat/lon. The new query asks Nominatim for the *exact course* (`Royal Birkdale, Southport,
   England`) rather than just the *town*. The course string pins a more precise spot, but if
   the course name doesn't match Nominatim's map data it can come back empty and the weather
   widget silently won't render — whereas a town-only query almost always resolves. Since
   weather only needs to be roughly right (it's a forecast for the area, not GPS), do you want
   to keep the precise course query, or fall back to town-level when the full query returns
   nothing? (Finding #1.)

2. **Direct-from-browser vs. proxying Nominatim.** Right now the browser calls Nominatim
   directly, same as the old weather geocoder did. Our Slash Golf and Odds APIs instead go
   through "edge functions" — small server-side scripts — partly so we can identify ourselves
   to the provider and not depend on their free public server's goodwill. For one lookup per
   tournament creation, direct-from-browser is genuinely fine, and adding `&email=...`
   (finding #2) covers the politeness ask cheaply. Are you comfortable staying direct-to-
   Nominatim, or do you want geocoding to eventually join the proxy pattern the other APIs use?
   My recommendation: stay direct, add the `email` param, and move on.
