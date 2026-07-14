# Player name matching

## The problem

Two different APIs give us two different spellings of the same golfer, and we have
to join them on name because they share no common player ID:

- **Slash Golf** — the field and the live leaderboard. Uses the name the player
  competes under: `Tom Kim`, `Matt Fitzpatrick`, `Nicolai Højgaard`.
- **The Odds API** — the bookmakers' outright winner market. Each book spells names
  its own way, and they lean formal: `Joohyung Kim`, `Matthew Fitzpatrick`,
  `Nicolai Hojgaard`.

When the join misses, the player gets no odds, shows `N/A` in the tier builder, and
falls back to their OWGR rank for tiering (or drops out of the pool entirely if they
have no rank either). Before this system existed, **11 of the 100 players** in The Open
field were unpriced — including Tom Kim and both Højgaard brothers.

The join only matters at **pool creation** (`CreateTournament.jsx`). The leaderboard is
Slash Golf on both sides, so scoring is unaffected by any of this.

## How matching works

Three layers, in `src/utils/playerMatch.js` and `src/utils/scoring.js`. Each layer only
runs when the one before it misses.

### 1. Normalize — `normalizeName()` in `scoring.js`

Lowercases, strips accents, and flattens punctuation so cosmetic differences disappear.

The subtle part is **transliteration**. Stripping accents is normally done by
decomposing a character into "base letter + combining accent" (NFD) and then deleting
the accent — `á` → `a` + `´` → `a`. But some letters are *atomic*: `ø`, `æ`, `ð`, `ł`
and friends have no base letter to decompose into. NFD leaves them alone, and then the
"delete anything that isn't a-z" step **deletes the letter itself**. `Højgaard` became
`hjgaard`, which matches nothing. So those letters are replaced by hand *before* the
strip.

Punctuation is deliberately handled two different ways:

| Character | Treatment | Why |
|---|---|---|
| `.` `'` | deleted | `J.J. Spaun` and `JJ Spaun` must agree → `jj spaun` |
| `-` `–` `—` | become a space | `Neergaard-Petersen` and `Neergaard Petersen` must agree |

### 2. Surname + first initial fallback

If the full name doesn't match, try **same surname AND same first initial**. This alone
resolves the overwhelming majority of real mismatches:

- shortened first names — `Matt`/`Matthew`, `Chris`/`Christopher`, `Alex`/`Alexander`,
  `Dan`/`Daniel`, `Johnny`/`John`, `Nico`/`Nicolas`
- dropped middle or second surnames — `Eugenio Chacarra`/`Eugenio Lopez Chacarra`,
  `Jayden Schaper`/`Jayden Trey Schaper`

**A fallback match is only accepted when exactly one candidate shares that surname and
initial.** If two players collide, the match is *refused* and the player is left `N/A`.
This is on purpose: a missing price is visible and recoverable (you see `N/A` and can
drag the player yourself), whereas a wrong price is silent and mis-tiers the field.

### 3. The alias table — `src/utils/nameAliases.js`

The last resort, for names where **the first initial or the surname itself differs**, so
no string manipulation can bridge them. In practice this is almost entirely players who
compete under an English name unrelated to their legal name — `Tom Kim` is legally
Kim Joo-hyung, so the books call him `Joohyung Kim`. There is no algorithm for that; it
is a fact about the world, and facts about the world go in a table.

The table maps a **variant → a canonical spelling**, and canonicalization is applied to
*both* sides of the join. That has two useful consequences:

- It does not matter which source's spelling you choose as canonical, only that it is
  used consistently.
- An entry is **harmless if the two sources happen to agree** — both sides just map to
  the same canonical name anyway. You cannot break a working match by adding an alias
  for it, so err on the side of adding one.

---

## How to update the alias table

Do this when a new season starts, when a new player joins the tour, or for majors with
large amateur fields (amateurs are frequently listed under their full legal name by one
source and a short name by the other).

### Step 1 — find out who is actually missing

Create the pool as usual. In the tier builder (step 2 of Create Tournament), any player
showing **`N/A`** where you'd expect a price is an unmatched name. Top-50 players showing
`N/A` are the real signal — a genuine 500-to-1 amateur may simply not be priced by any
book, which is not a bug.

### Step 2 — confirm it is a name problem, not a missing market

Check whether the books price the player at all. Open the browser devtools Network tab
during pool creation and look at the `the-odds-api.com` response, or call the endpoint
directly:

```
https://api.the-odds-api.com/v4/sports/<sport_key>/odds?apiKey=<key>&regions=us&markets=outrights&oddsFormat=american
```

Sport keys are listed in `GOLF_SPORT_KEYS` in `src/lib/oddsApi.js` (majors only).

- **Player is absent from the response** → nothing to fix. The books aren't pricing them.
- **Player is present under a different name** → that's an alias. Continue.

### Step 3 — add the entry

Keys and values are **already-normalized** names — lowercase, no accents, no punctuation
(the output of `normalizeName`, *not* the raw display name). So `K.H. Lee` is written
`kh lee`, not `K.H. Lee`.

```js
// src/utils/nameAliases.js
export const NAME_ALIASES = {
  'tom kim': 'joohyung kim',   // Kim Joo-hyung
  // ...
  'new guy': 'legal name here',
}
```

Add a trailing comment with the player's actual name so the next person doesn't have to
re-research it.

### Step 4 — sanity-check before adding

Ask: **would the surname + first-initial fallback already have caught this?** If the two
spellings share a surname and a first initial (`Matt`/`Matthew Fitzpatrick`), you do not
need an entry — layer 2 has it. Adding one anyway is harmless, but the table stays more
useful if it only carries the names that genuinely need it.

The one case that *does* need an entry despite sharing a surname is when **two players
share that surname and initial**, which makes the fallback refuse the match. Three Kims
in a field is normal; if `M. Kim` is ever ambiguous, alias the exact spellings.

## Known limitation

Surname-order flips (`Kim Joo-hyung` vs `Joohyung Kim`) are **not** handled
automatically. Slash Golf returns `firstName` and `lastName` as separate fields and we
build Western order from them, and the books use Western order too, so this hasn't come
up. If a source ever starts returning Eastern order, that needs a new layer, not an
alias per player.
