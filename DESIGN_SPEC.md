# Poold — Design Spec

Derived from `docs/design_prototype/*.dc.html`. Detailed enough to rebuild any screen without looking at the HTML.

---

## 1. Color Palette

### Two-Register Theme

The app has two distinct registers that swap the primary action color:

| Register | Pages | Primary CTA |
|---|---|---|
| **General** | Login, Join, Dashboard, Admin, Create Tournament | `#C14A18` (orange-red) |
| **Sport-specific** | Tournament detail, Picks | `#1B4332` (fairway green) |

Everything else (backgrounds, text, borders) is shared across both registers.

### Full Palette

| Token name | Hex | Usage |
|---|---|---|
| **brand** | `#C14A18` | Wordmark, primary CTA (general register), active nav tab, magic link button, progress bar |
| **fairway** | `#1B4332` | Golf header gradient, selected state, primary CTA (sport register), prize amounts, tier circles |
| **fairway-deep** | `#0F241B` / `#0D1F18` | Golf header gradient end (dark) |
| **fairway-mid** | `#1F6F47` | Default/fallback badge field (also the U.S. Open's signature field) — badge colors are otherwise per-tournament, see §Sport badge |
| **gold** | `#C9A368` | Sport status labels, YOU badge background, 1st-place rank, gold left-bar on expand |
| **gold-light** | `#E6C66B` | Default/fallback badge border (also the U.S. Open's), emblem accent — otherwise per-tournament |
| **gold-medium** | `#E8CE9A` | Share button text in golf header |
| **gold-dark** | `#B8924F` | Locked badge text, lock button text |
| **birdie** | `#B23A2D` | Under-par (negative) scores only |
| **live-green** | `#4ADE80` | Animated live indicator dot |
| **page-bg** | `#F8F0E4` | Page background — auth, dashboard, admin pages |
| **page-bg-sport** | `#F4EFE4` | Page background — tournament and picks pages (slightly cooler) |
| **cream** | `#F8F5EE` | Text on dark golf header, selected player button text |
| **card-bg** | `#FFFFFF` | Standard card, nav bar |
| **card-bg-warm** | `#FFFDF8` | Cards on sport pages (warmest white) |
| **input-bg** | `#FFFAF6` | Form input background |
| **border** | `#EAD8C4` | Card/nav borders — general pages |
| **border-sport** | `#E4DDD0` | Card/row borders — sport pages |
| **divider** | `#EFE8DA` | Row dividers in standings |
| **divider-light** | `#F0EBE1` | PGA leaders row border |
| **divider-dashed** | `#D5CBB8` | Dashed divider in prize widget |
| **text-primary** | `#1C1610` | Primary text — general pages |
| **text-charcoal** | `#2D2D2A` | Primary text — sport pages |
| **text-muted** | `#A08870` | Muted/secondary text — general pages |
| **text-muted-sport** | `#9E9488` | Muted/secondary text — sport pages |
| **text-warm-500** | `#736A5F` | CUT badge text, slightly less muted |
| **text-faint** | `#C8B8A4` | Very muted (disabled labels, sign-out links) |
| **inactive-tab** | `#7A6858` | Inactive admin tab text |
| **tab-track** | `#EAD8C4` | Tab switcher background |
| **rank-bg** | `#EBE3D4` | Non-first rank circle background; complete status badge |
| **rank-1-bg** | `rgba(201,163,104,.2)` | 1st place rank circle background |
| **expand-bg** | `#F8F3EC` | Scorecard expand inner background |
| **hover-row** | `#FAF6EE` | Standings row hover (style-hover attribute) |
| **tier-body** | `#F8F0E4` | Tier card body background (create tournament step 2) |
| **payout-card** | `#F8F0E4` | Payout structure sub-card background |

### Alpha variants in use

| Usage | Value |
|---|---|
| Brand icon bg | `rgba(193,74,24,.1)` |
| Brand icon border | `rgba(193,74,24,.2)` |
| Brand danger border | `rgba(193,74,24,.3)` |
| Fairway open badge bg | `rgba(27,67,50,.1)` |
| Fairway tier header (selected) | `rgba(27,67,50,.06)` |
| Fairway lock button border | `rgba(27,67,50,.35)` |
| Fairway success icon bg | `rgba(27,67,50,.1)` |
| Gold locked badge bg | `rgba(201,163,104,.18)` |
| Gold lock button border | `rgba(201,163,104,.5)` |
| Gold share button bg | `rgba(201,163,104,.16)` |
| Golf header overlay text | `rgba(248,245,238,.5–.65)` |

---

## 2. Typography

### Font Families

| Family | Weights | Source |
|---|---|---|
| **Barlow Condensed** | 600 (italic), 700, 800 | Google Fonts |
| **Inter** | 400, 500, 600, 700 | Google Fonts |

### Barlow Condensed — Usage by Size

| Size | Weight | Where used |
|---|---|---|
| 60px | 800 | Login wordmark |
| 54px | 800 | Join page wordmark |
| 38px | 800 | Dashboard greeting ("Good afternoon."), tournament name in golf header |
| 30px | 800 | Create tournament step heading ("Set it up."), success confirmation heading |
| 28px | 800 | Score total in dashboard pool card |
| 26px | 800 | "Check your email" heading; standings row score |
| 22px | 800 | Admin nav wordmark |
| 18px | 800 | Pool name in dashboard sport card header strip |
| 17px | 700 | Prize payout amounts |
| 16px | 700 | Admin nav section label ("Admin", "Create Tournament") |
| 14px | 700 | Scorecard expand TOTAL label (uppercase, .16em tracking); tier header label in picks |
| 13px | 700 | Tier number label in create tournament header |
| 11px | 700 | Tier number inside circle in picks |
| 10px | 700 | Section header labels — all-caps, `.22em` tracking, muted color |
| 9–11px | 700 | Sport header sub-labels (status, round info, "PICKS OPEN · LOCKS…") — uppercase, letter-spacing |
| 16px italic | 600 | Tagline "Make it interesting." |

Always use `letter-spacing: tight` or explicit tracking on display text. Scores use `font-variant-numeric: tabular-nums`.

### Inter — Usage by Size

| Size | Weight | Where used |
|---|---|---|
| 15px | 700 | Primary button text (auth forms) |
| 15px | 400 | Email input text |
| 14px | 700 | Primary button text (admin/tournament forms) |
| 14px | 600 | Tournament card names, player names in admin, nav links |
| 14px | 500 | Back nav links (e.g. "← Dashboard") |
| 13.5px | 600 | Player name in standings, player button name in picks |
| 13px | 600 | Pool card standing row ("3rd of 7") |
| 13px | 400/500 | General body text, card sub-text |
| 12.5px | 600 | "Edit picks →" link |
| 12.5px | 400 | Small links ("Got an invite code?", "Just looking?") |
| 12px | 600 | Tab switcher labels, score totals (admin) |
| 12px | 400 | Secondary info, timestamps, pick meta |
| 11.5px | 600 | Admin action buttons |
| 11px | 600 | Form field labels (uppercase, `.12em` tracking) |
| 11px | 400 | UI details, live indicator, bar chart counts |
| 10px | 600 | Bottom nav active label |
| 10px | 400 | Bottom nav inactive labels |

### Score Display Convention

```
negative (under par)   → Barlow Condensed 700–800 tabular-nums  color:#B23A2D
positive (over par)    → Barlow Condensed 700–800 tabular-nums  color:#2D2D2A
even (0 / "E")         → Barlow Condensed 700 medium            color:#2D2D2A
unstarted / CUT        → Barlow Condensed 700 tabular-nums      color:#9E9488  (+ line-through on name if CUT)
```

---

## 3. Component Inventory

### 3.1 Sticky Top Nav (General Register)

```
height: 56px
background: #FFFFFF
border-bottom: 1px solid #EAD8C4
padding: 0 18px
display: flex; align-items: center; justify-content: space-between
position: sticky; top: 0; z-index: 10
```

**Left side variants:**
- Dashboard: wordmark `POOLD` — Barlow 800 26px `#C14A18` letterSpacing .07em
- Admin / Create Tournament: `← Dashboard` link in Inter 13px `#A08870` + `|` divider in `#EAD8C4` + wordmark `POOLD` + section title (Barlow 700 16px `#1C1610`)

**Right side variants:**
- Dashboard: `+ New` text link (Inter 500 12px `#A08870`) + avatar circle (34px `bg-[#C14A18]`, initials Barlow 700 13px white)
- Admin: `Sign out` link (Inter 12px `#C8B8A4`)
- Create Tournament: step indicator (20px circle `bg-[#C14A18]`, Barlow 700 11px white digit + "of 2" label Inter 12px muted)

### 3.2 Golf Sport Header (Sport Register)

Full-bleed gradient band, no max-width constraint.

```
background: linear-gradient(165deg, #1B4332 0%, #0F241B 100%)
padding: 16px 20px 24px
```

**Structure:**
1. Back link row — `← Dashboard` / `← Leaderboard`, Inter 500 14px `rgba(248,245,238,.65)`
2. Hero row — sport badge + text + status (flex, items-end, space-between)
3. Share/action button (optional, top right of hero row)

**Sport badge ("tombstone" shape):**
```
width: 36–52px; height: 42–60px
background: <per-tournament>                       ← see the badge color system below
border: 2px solid <per-tournament>
border-radius: [top: 8–13px] [bottom: 18–26px]     ← rounded bottom, less-rounded top
box-shadow: 0 8px 18px -8px rgba(0,0,0,.4)         ← only on full-size variant
```
Content: 2-line text. Line 1 is the abbreviated name in Barlow 800, always cream `#F8F5EE`, letterSpacing .02em. Line 2 is the event/city code in Barlow 700 at 5.5–8px, **always the badge's own border color**, letterSpacing .06em. Four sizes: 36×42 (join preview), 40×46 (dashboard tile), 44×50 (picks header), 52×60 (leaderboard header).

**Badge color system.** The field and border are *not* fixed brand colors — they are stored per tournament in `badge_config` and encode **prestige + geography**: each major carries a signature palette (The Open is navy `#162258` + gold `#C9A368`; the Masters is `#004F2D` + `#E8C872`), flagship/playoff events use dark grounds with prestige gold, and regular tour stops follow regional families (ocean, desert, southeast, midwest, international). Shape and type never vary — only the two colors and the two words do.

`badge_config` is one object per event: `{ line1, line2, bg, border }`. Line 1's font size is **derived from its character count** by `SportBadge` (≤2 chars → full size, 3 → ×0.86, 4 → ×0.77, 5+ → ×0.64), not stored, so a long abbreviation can't overflow the shield. Seed data for all 48 tournaments lives in `public.pga_event_badges` and is copied onto `golf.event_details.badge_config` at pool creation.

**Hero text:**
- Kicker: Barlow 700 10–11px uppercase tracking .18–.2em `#C9A368`
- Main heading: Barlow 800 28–38px `#F8F5EE` lineHeight .9–.95
- Sub-line: Inter 12–12.5px `rgba(248,245,238,.5)` — contains weather, pool rules, last-updated

**Share button (top right):**
```
background: rgba(201,163,104,.16)
border: 1px solid rgba(201,163,104,.45)
color: #E8CE9A
font: Inter 600 13px
padding: 8px 14px; border-radius: 10px
```

### 3.3 Dashboard Pool Card

```
background: #FFFFFF
border: 1px solid #EAD8C4
border-radius: 16px
overflow: hidden
margin-bottom: 10px
```

**Three sections:**

**Sport strip (top):**
```
background: linear-gradient(105deg, #1B4332, #0D1F18)
padding: 13px 15px
display: flex; align-items: center; gap: 12px
```
Contains: mini sport badge (40×46px) + pool name/status text + live indicator dot.

**Live indicator dot:**
```
width: 7px; height: 7px; border-radius: 50%; background: #4ADE80
animation: liveDot 1.4s ease-in-out infinite
@keyframes liveDot { 0%,100%{opacity:1} 50%{opacity:.28} }
```

**Standing row (middle):**
```
padding: 13px 15px
display: flex; align-items: center; gap: 11px
```
- Rank circle: 30px, `bg-rgba(193,74,24,.1)`, Barlow 800 15px `#C14A18`
- Standing text: Inter 600 13.5px primary + Inter 400 12px muted (pts back)
- Score total: Barlow 800 28px `#1C1610` tabular-nums

**CTA row (bottom):**
```
padding: 0 15px 13px
display: flex; gap: 9px
```
- Primary CTA: `bg-[#C14A18] rounded-[10px] py-12px px-12px` Inter 700 13.5px white, flex:1
- Secondary CTA: `border-1.5px solid [#EAD8C4] rounded-[10px] py-12px px-14px` Inter 500 13px `#A08870`

**Dimmed/upcoming variant:** `opacity: .44` on the entire card.

### 3.4 Standings Table (Pick'em)

Container:
```
background: #FFFDF8
border: 1px solid #E4DDD0
border-radius: 16px
overflow: hidden
box-shadow: 0 12px 36px -24px rgba(20,48,38,.35)
```

**Standing row (collapsed):**
```
border-bottom: 1px solid #EFE8DA
button: width:100%; flex; align-items:center; gap:12px; padding:14px 18px
hover: background: #FAF6EE
```
- Rank circle: 36px, bg gold-tint for 1st / `#EBE3D4` for rest, Barlow 700 16px
- Name: Inter 600 15px `#2D2D2A`
- YOU badge: `Barlow 700 10px letterSpacing .08em bg-[#C9A368] color-[#15130F] px-7px py-2px rounded-full`
- Score: Barlow 800 26px tabular-nums, color by value
- Chevron: SVG 14px `#C9BFB0`, `transition: transform .18s`, rotates 180deg when open

**Scorecard expand (open state):**
```
display: flex
border-top: 1px solid #EFE8DA
```
- Gold left bar: `width: 3px; background: #C9A368; flex: none`
- Content area: `flex:1; background: #F8F3EC; padding: 12px 16px`

**Pick row inside expand:**
```
display: flex; align-items: center; gap: 10px; padding: 4px 0
```
- Tier circle: 19px, `bg-rgba(27,67,50,.85)` cream text, Barlow 700 10px
- Player name: Inter 13.5px `#2D2D2A`; `text-decoration: line-through` if CUT
- CUT badge: `Barlow 700 8px bg-[#E4DDD0] color-[#736A5F] px-5px py-2px border-radius:3px`
- Score: Barlow 700 14px tabular-nums, colored by value; `min-width: 28px; text-align: right`

**TOTAL row:**
```
border-top: 1px solid #E4DDD0
padding: 8px 0 2px; margin-top: 5px
```
Label: Barlow 700 9px uppercase tracking .16em `#9E9488`.

### 3.5 Picks Tier Card

```
background: #FFFDF8
border: 1px solid #E4DDD0
border-radius: 14px
overflow: hidden
margin-bottom: 12px
```

**Tier header:**
```
display: flex; align-items: center; gap: 10px; padding: 12px 15px
border-bottom: 1px solid #EFE8DA
background: transparent (default) | rgba(27,67,50,.06) (when selection made)
```
- Tier circle: 22px, `bg-[#1B4332]`, Barlow 700 11px `#F8F5EE`
- Label: Barlow 700 14px tracking .04em `#2D2D2A`
- Selected indicator: Inter 600 11.5px `#1B4332` — "PlayerName ✓"

**Player grid:**
```
display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 12px
```

**Player button (unselected):**
```
background: #FFFDF8
border: 1.5px solid #E4DDD0
border-radius: 10px
padding: 11px 13px
transition: all .12s
```
- Name: Inter 600 13.5px `#2D2D2A`
- Odds: Inter 11.5px `#9E9488`

**Player button (selected):**
```
background: #1B4332
border: 1.5px solid #1B4332
```
- Name: Inter 600 13.5px `#F8F5EE`
- Odds: Inter 11.5px `rgba(248,245,238,.55)`

### 3.6 Form Input

```
width: 100%
padding: 12–13px 14–15px
border: 1.5px solid #EAD8C4
border-radius: 11px
font: Inter 14–15px #1C1610
background: #FFFAF6
outline: none
-webkit-appearance: none
```

**Field label (above input):**
```
font: Inter 600 11px uppercase; letter-spacing: .12em; color: #A08870; margin-bottom: 7px
```

Optional hint text appended inline: `font-weight:400; text-transform:none; letter-spacing:0; color:#C8B8A4`.

**Select element:** Same styles as input + `appearance: none` to hide native arrow.

### 3.7 Buttons

**Primary (general register):**
```
background: #C14A18  (disabled: #C8B8A4)
color: #FFFFFF
font: Inter 700 15px
padding: 14px
border-radius: 11px
border: none
width: 100% (on auth forms)
```

**Primary (sport register):**
```
background: #1B4332  (disabled: #9E9488, opacity:.55)
color: #F8F5EE
font: Inter 700 14px
padding: 13–14px
border-radius: 11–12px
border: none
transition: all .15s
```

**Secondary / ghost:**
```
background: transparent
border: 1.5px solid #EAD8C4
color: #A08870
font: Inter 500 13–14px
padding: 6–13px 14–22px
border-radius: 8–11px
```

**Admin small action buttons:**
```
font: Inter 600 11.5–12px
padding: 5–6px 11–14px
border-radius: 7–8px
border: 1px solid [context color]
background: transparent
```
- Lock: border `rgba(201,163,104,.5)`, color `#B8924F`
- Re-open: border `rgba(27,67,50,.35)`, color `#1B4332`
- Close Tournament: border `#EAD8C4`, color `#A08870`
- Remove (danger): border `rgba(193,74,24,.3)`, color `#C14A18`
- Refresh Scores: border `rgba(27,67,50,.3)`, color `#1B4332`

**Link-style button:**
```
background: none; border: none; color: #A08870; text-decoration: underline; font: Inter 12px
```

### 3.8 Status Badges (Pills)

```
font: Inter 600 11px
padding: 3px 9px
border-radius: 999px (fully rounded)
white-space: nowrap
```

| Status | Background | Color |
|---|---|---|
| open | `rgba(27,67,50,.1)` | `#1B4332` |
| locked | `rgba(201,163,104,.18)` | `#B8924F` |
| complete / draft | `#EBE3D4` | `#9E9488` |
| admin role | `rgba(27,67,50,.1)` | `#1B4332` |
| player role | `#EBE3D4` | `#9E9488` |

### 3.9 Tab Switcher

```
display: flex; gap: 2px
background: #EAD8C4
border-radius: 10px
padding: 3px
```

Each tab:
```
flex: 1
font: Inter 500 13.5px
padding: 8px
border-radius: 8px
border: none
```
- Active: `background: #FFFFFF; color: #1C1610`
- Inactive: `background: transparent; color: #7A6858`

### 3.10 Widget Cards

```
background: #FFFDF8
border: 1px solid #E4DDD0
border-radius: 14px
padding: 16px
```

Widget section label: Barlow 700 10px uppercase tracking .16em `#9E9488` margin-bottom 10–12px.

**Widget grid:** `display:grid; grid-template-columns:1fr 1fr; gap:12px` — single-column widgets use `grid-column: span 2`.

### 3.11 Horizontal Bar Chart (Most Popular Picks)

```
display: flex; align-items: center; gap: 10px
```
- Label: Inter 12.5px `#2D2D2A`, width 120px fixed
- Track: `flex:1; background:#EFE8DA; border-radius:3px; height:6px; overflow:hidden`
- Fill: `height:100%; background:#1B4332; border-radius:3px; width:[%]`
- Count: Inter 11px `#9E9488`, width 28px text-right

### 3.12 Notification Nudge Card

```
background: #FFFFFF
border: 1px solid #EAD8C4
border-radius: 13px
padding: 12px 14px
display: flex; align-items: center; gap: 11px
margin-bottom: 22px
```
- Icon square: 34px, `border-radius: 9px`, `bg-rgba(193,74,24,.1) border-rgba(193,74,24,.2)`, contains Barlow 800 17px `#C14A18` initial
- Title: Inter 600 13px `#1C1610`
- Sub: Inter 12px `#A08870`
- Dismiss: Inter 18px `#D0BCA8` `×` cursor:pointer

### 3.13 Dashed "Join Another Pool" Card

```
display: block
border: 1.5px dashed #D0BCA8
border-radius: 13px
padding: 14px
text-align: center
text-decoration: none
```
Label: Barlow 700 14px `#A08870`.

### 3.14 Sticky Bottom Nav

```
position: fixed; bottom: 0; left: 0; right: 0
height: 64px
background: #F8F0E4
border-top: 1px solid #EAD8C4
display: flex; justify-content: space-around; align-items: flex-start; padding-top: 10px
z-index: 10
```
Three tabs (Pools active, Board, You). Active tab icon: 26px, `border-radius:8px bg-rgba(193,74,24,.12) border-rgba(193,74,24,.28)`, label Inter 600 10px `#C14A18`. Inactive: flat icons, Inter 10px `#B8A890`.

### 3.15 Sticky Submit Bar (Picks)

```
position: fixed; bottom: 0; left: 0; right: 0
background: #F4EFE4
border-top: 1px solid #E4DDD0
padding: 12px 18px 20px
z-index: 10
```
Inner flex: max-width 560px centered. Left: Inter 12px `#9E9488` progress text. Right: submit button.

### 3.16 Progress Bar (Multi-step Form)

```
height: 3px
background: #EAD8C4
```
Fill: `background: #C14A18; border-radius: 0 2px 2px 0; transition: width .3s`.

### 3.17 Admin Tournament Card

```
background: #FFFFFF
border: 1px solid #EAD8C4
border-radius: 14px
padding: 16px
margin-bottom: 10px
```
Sections:
1. Header row: name (Inter 600 14.5px) + lock time (Inter 11.5px muted) + status badge
2. Join link row: URL display box + Copy button
3. Refresh row (if applicable): "N/3 score refreshes left" + Refresh Scores button
4. Action row: Lock / Re-open / Close Tournament buttons

**Join link URL box:**
```
background: #F8F0E4; border: 1px solid #EAD8C4; border-radius: 7px; padding: 7px 10px
font: Inter 11px #A08870; overflow: hidden; white-space: nowrap; text-overflow: ellipsis
```

**Copy button (default / copied states):**
- Default: `border:#EAD8C4 bg:#FFFFFF color:#A08870`
- Copied: `border:rgba(27,67,50,.3) bg:rgba(27,67,50,.08) color:#1B4332`
- Resets after 2 seconds

### 3.18 Participant Card (Admin)

```
background: #FFFFFF; border: 1px solid #EAD8C4; border-radius: 13px; padding: 14px 16px; margin-bottom: 9px
```
- Header: name (Inter 600 14px) + email (Inter 12px muted) + Remove button (danger)
- Picks list: tier label Inter 11px muted width-50px + player name Inter 13px, `gap: 5px`

### 3.19 Drag Player Card (Create Tournament Step 2)

```
background: #FFFFFF; border: 1px solid #EAD8C4; border-radius: 8px; padding: 8px 11px
display: flex; align-items: center; justify-content: space-between; cursor: grab
```
- Name: Inter 13px `#1C1610`
- Odds: Inter 11px `#A08870`

### 3.20 Tier Column (Create Tournament Step 2)

```
border: 2px solid #EAD8C4; border-radius: 13px; overflow: hidden
```
Header: `bg-white border-b border-[#EAD8C4] px-14px py-10px` with tier number circle + label (Barlow 700 13px) + player count (Inter 11px muted).
Body: `bg-[#F8F0E4] p-9px flex flex-col gap-5px` — contains drag cards.

### 3.21 Payout Structure Sub-card

```
background: #F8F0E4; border: 1px solid #EAD8C4; border-radius: 12px; padding: 14px 16px
```
Header row: label (Inter 600 11px uppercase) + sum indicator (Inter 600 12px `#1B4332` "100% ✓").
Rows: placement label (Inter 13px) + inline input (white, Inter 14px) + % label + ✕ dismiss.
Footer: `+ Add placement` link-button, Inter 600 13px `#C14A18`.

### 3.22 Invite Card (Join page, authenticated state)

```
background: #FFFFFF; border: 1px solid #EAD8C4; border-radius: 16px
padding: 28px 24px; text-align: center
box-shadow: 0 4px 24px rgba(28,22,16,.07)
```
- Kicker: Barlow 700 11px uppercase tracking .2em `#C9A368` — "You're invited"
- Title: Barlow 800 30px `#1C1610`
- Meta: Inter 13px muted (location · dates, rules)
- Golf badge preview: gradient strip with badge
- CTA button (full-width): `bg-[#C14A18] rounded-12px py-14px`
- Secondary link below: Inter 12.5px muted

### 3.23 Confirmation State (Success)

Used in: Login (email sent), Picks (submitted).

```
centered container: max-width 360px, text-align center, padding 8–32px
```
- Icon circle: 44–56px, `bg-rgba(brand,.1)` or `bg-rgba(fairway,.1)`, contains SVG checkmark in matching solid color
- Heading: Barlow 800 26–30px
- Body: Inter 13–13.5px muted lineHeight 1.55
- CTA button: full-width, solid primary color
- Secondary link below

---

## 4. Screen Map

| File | Screen | User | Key Layout |
|---|---|---|---|
| `01-login.dc.html` | **Login** | Any | Centered single column, max-w 360px. Wordmark above card. Card contains form or success state. Demo link below card. Two conditional states (`showForm` / `showSent`). |
| `02-dashboard.dc.html` | **Dashboard** | Authenticated | Sticky top nav. Sticky bottom nav. Single column max-w 480px. Greeting header → nudge banner → section label → pool cards → dashed join card → sign out link. Pool cards stacked, each with sport strip + standing row + CTA row. |
| `03-join.dc.html` | **Join Pool** | Any | Two root states toggled by prototype buttons: *Unauthenticated* (centered card with wordmark, email form, invite code displayed) and *Authenticated* (centered card with invite details + golf badge preview + CTA). Both max-w 360px centered. |
| `04-tournament.dc.html` | **Tournament Detail** (Golf) | Authenticated | Full-bleed golf gradient header. Below: max-w 640px. Picks status banner → section label → standings table (expandable rows) → 2-column widget grid (prize pool, PGA leaders, most popular picks spanning 2 cols). |
| `05-picks.dc.html` | **Make Picks** (Golf) | Authenticated | Full-bleed golf gradient header. Form or success state. Form: max-w 560px, stacked tier cards each with 2-col player grid. Sticky submit bar at bottom. Success: centered card with confirmation. |
| `06-admin.dc.html` | **Admin Dashboard** | Admin | Sticky top nav with back link. Tab switcher (Tournaments / Participants / Users). Max-w 620px. Tournaments: list of tournament cards. Participants: tournament select → participant list. Users: user cards with role toggle. |
| `07-create-tournament.dc.html` | **Create Tournament** | Admin | Sticky top nav with step indicator. 3px progress bar below nav. Two steps: Step 1 (max-w 520px, single form card with all config fields) → Step 2 (max-w 760px, 2×2 tier grid with drag-player cards + back/create buttons). |

---

## 5. Spacing & Radius Conventions

### Max-widths

| Context | Value |
|---|---|
| Auth / Join / Confirmation | 360px |
| Picks form | 560px |
| Dashboard | 480px |
| Admin | 620px |
| Tournament detail | 640px |
| Create tournament step 2 | 760px |

### Horizontal page padding

`18–20px` on all pages.

### Border Radius

| Element | Radius |
|---|---|
| Page cards (main) | `16px` |
| Form cards | `16px` |
| Admin tournament card | `14px` |
| Widget cards | `14px` |
| Participant cards | `13px` |
| Admin join link box | `7px` |
| Admin action buttons | `7–8px` |
| Input, Select | `11px` |
| Primary button (auth) | `11px` |
| Primary button (sport) | `11–12px` |
| Secondary button (large) | `10–11px` |
| Pool card CTA buttons | `10px` |
| Dashed join card | `13px` |
| Tier card (picks) | `14px` |
| Player button (picks) | `10px` |
| Tier column (create tournament) | `13px` |
| Drag player card | `8px` |
| Tab switcher container | `10px` |
| Tab item | `8px` |
| Status badge / YOU badge | `999px` (full pill) |
| Rank circles | `50%` |
| Tier circles | `50%` |
| Avatar circle | `50%` |
| Live dot | `50%` |
| Bottom nav icon | `8px` |
| Nudge icon square | `9px` |
| Bar chart fill | `3px` |
| CUT badge | `3px` |
| Progress bar fill | `0 2px 2px 0` |

### Common Padding / Gap Values

- Card internal padding: `16px` (widgets), `22px` (form cards), `28px 24px` (auth cards)
- Row internal padding: `14px 18px` (standings), `13px 15px` (sport card sections)
- Input padding: `12–13px 14–15px`
- Button padding: `14px` vertical full-width; `8px 14px` smaller CTAs
- Section label margin-bottom: `10px`
- Label → input gap: `7px`
- Stack gap between cards: `10–12px`
- Pick row gap: `10px`
- Widget grid gap: `12px`
- Nav height: `56px`
- Bottom nav height: `64px`
- Bottom nav padding-bottom on content: `80–96px` (clears the fixed bar)

---

## 6. Interaction Patterns

### Scorecard Expand (Standings)

Triggered by clicking any standing row button.
- Chevron SVG: `transition: transform .18s` — rotates `0deg → 180deg`
- Row background: hover state `#FAF6EE` (via `style-hover` attribute in prototype)
- Expanded content: slides in as a `flex` container (no animated height in prototype, but implied)
- Gold left bar appears instantly on open
- Inner content background changes from `#FFFDF8` to `#F8F3EC`

### Player Selection (Picks)

Immediate on click, `transition: all .12s`.
- Unselected → selected: bg flips `#FFFDF8 → #1B4332`, border `#E4DDD0 → #1B4332`, text/odds flip to cream
- Tier header background tints `rgba(27,67,50,.06)` when any selection in tier exists
- Selected name + `✓` appears in tier header
- Submit button in sticky bar: tracks `picksCount`
  - `picksCount < 4`: `bg-[#9E9488] opacity:.55`, label shows `"N of 4 selected"`
  - `picksCount === 4`: `bg-[#1B4332] opacity:1`, label shows `"Submit Picks →"`

### Submit / Success Transition

After submit, entire form section unmounts and success card mounts (`showForm → showSuccess`). No animation in prototype.

### Admin Status Mutations

All immediate (no confirmation modal in prototype):
- **Lock** → status changes `open → locked` (badge recolors to gold)
- **Re-open** → `locked → open`
- **Close Tournament** → any → `complete` (badge recolors to grey); action buttons disappear
- **Make Admin / Make Player** toggle: role badge recolors immediately

### Copy Join Link

1. Click "Copy" → label becomes "Copied!" with green tint (`bg-rgba(27,67,50,.08) border-rgba(27,67,50,.3) color-[#1B4332]`)
2. After 2000ms → resets to default state

### Multi-step Form (Create Tournament)

- **Step indicator** in nav: digit updates (1 → 2)
- **Progress bar**: `transition: width .3s` — 50% at step 1, 100% at step 2
- **Next button**: disabled-looking (`bg-[#C8B8A4]`) when pool name is empty; activates to `bg-[#C14A18]` once name has content
- **Payout structure** sub-card: conditionally shown when `stake > 0`

### State Toggle (Login / Join Prototype)

Prototype-specific toggle buttons switch between auth states. Active: `bg-[#C14A18] color-white`. Inactive: `bg-[#F0E8DC] color-[#A08870]`.

### Tournament Select (Admin Participants Tab)

- No tournament selected → show "Select a tournament to view participants."
- Tournament selected, no participants → show "No cards in yet."
- Otherwise → render participant card list

### Live Dot

On active pool cards:
```css
@keyframes liveDot { 0%,100%{opacity:1} 50%{opacity:.28} }
animation: liveDot 1.4s ease-in-out infinite
```

### Card Shadow

Auth/Join cards: `box-shadow: 0 4px 24px rgba(28,22,16,.07)`
Standings table: `box-shadow: 0 12px 36px -24px rgba(20,48,38,.35)`
Success card (picks): `box-shadow: 0 12px 36px -20px rgba(20,48,38,.3)`
Sport badge (large): `box-shadow: 0 8px 18px -8px rgba(0,0,0,.4)`
