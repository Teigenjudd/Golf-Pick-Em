# Senior review — feat/profile-avatars

- **Reviewed:** 2026-08-31
- **Head:** fb34be7
- **Verdict:** APPROVE WITH QUESTIONS

## Summary
Adds user-uploadable profile pictures — `profiles.avatar_url`, the app's first Supabase
Storage bucket (`avatars`), a shared `Avatar` component, self-service upload on Profile,
admin override on `/admin/users`, and avatar rendering on both leaderboards. The security
surface (storage RLS, the admin RPC, the path convention) is genuinely well built: it
copies the proven `display_name` column-grant + `admin_set_role` SECURITY-DEFINER patterns
rather than inventing anything, the bucket caps size/mime-type server-side, and the folder
policy pins writes to your own user-id folder. I traced the holes the task flagged and none
of them are exploitable (details below). One design question is worth a founder decision
before merge; the rest are nits.

## Security trace (the flagged concerns — all clear)
- **Non-admin writing another user's folder:** blocked. Self INSERT/UPDATE require
  `auth.uid()::text = (storage.foldername(name))[1]`; the admin-bypass policies require
  `is_admin()`. A non-admin satisfies neither for someone else's folder.
- **Path traversal in the upload path:** not exploitable. Storage object names are opaque
  key strings, not filesystem paths — a crafted `myid/../victimid/avatar.png` still has
  `foldername[1] = 'myid'` (so it passes the self-check) but is stored under that literal
  key; it neither overwrites nor serves as `victimid/avatar.png`. Attacker can only litter
  their own namespace.
- **Public bucket leaking beyond avatars:** no. The public SELECT policy is scoped
  `bucket_id = 'avatars'`; other buckets keep their own policies. Avatars are world-readable
  by URL, which is the intended trade for `<img src>` without signed URLs (see Q2).
- **UPDATE policies with only `USING` (no `WITH CHECK`):** fine. Postgres reuses the `USING`
  expression as the implicit `WITH CHECK` on UPDATE, so a self-update can't relocate an
  object into another user's folder.
- **`admin_set_avatar_url` RPC:** correct — `is_admin()`-gated, EXECUTE revoked from PUBLIC
  and re-granted to `authenticated`, mirrors `admin_set_role`. The deliberate absence of a
  self-guard is right (no lockout analogue to role-change).
- **Demo pages do NOT break.** `Avatar` treats a falsy `avatarUrl` as "render initials," and
  `getInitials(undefined)` returns `'?'` rather than throwing. Demo fixtures carry
  `display_name` but no `avatar_url`, so both `Standings` and `CfbStandings` fall through to
  initials cleanly. Demo will simply never show photos, which is the correct behavior.

## Findings

### 1. `avatar_url` accepts any string — it's rendered as an `<img src>` to other players (debt / moderate)
`supabase/migrations/20260831020000_profile_avatars.sql` (the column + grant), rendered at
`src/components/Avatar.jsx:9`. The self-write path is `GRANT UPDATE (avatar_url)` + the
row-scoped RLS policy (`auth.uid() = id`) — that policy checks *who* is writing, never
*what* the value is. So a user isn't limited to the app's upload flow: they can send a
direct PATCH and set their own `avatar_url` to any string. Whatever they set is then loaded
as `<img src={avatarUrl}>` on the leaderboards every other pool member views.

Not XSS — `javascript:`/`data:` URIs are inert in an `<img src>`, and React escapes the
value. The real cost is two things the bucket restrictions were meant to prevent, quietly
routed around: (a) a tracking pixel — point the avatar at an attacker-controlled URL and
every viewer's browser silently discloses IP/user-agent to it; (b) moderation bypass — the
"images only, in your own folder" guardrails don't apply to an arbitrary off-site URL, so
the avatar can be any image hosted anywhere. `display_name` has the same "arbitrary text"
property but is inert because it renders as escaped text; `avatar_url` is the first column
whose value performs a network fetch, which is why this is worth a decision.

Fix direction (only if you decide it matters — see Q1): a `CHECK` constraint pinning
`avatar_url` to your Supabase storage public-URL prefix, or normalize/validate server-side.
This is not a blocker for a no-real-users app.

### 2. Extension switch orphans the old file (nit)
`src/lib/profile.js` — the path is `${userId}/avatar.${ext}` and `upsert:true` replaces the
object *at that exact key*. Upload a JPEG then later a PNG and you get two objects
(`avatar.jpg` + `avatar.png`); `avatar_url` points at the new one, the old one lingers. The
code comment says upsert avoids "piling up orphans," which is only true when the extension
doesn't change. Low impact (max one stray file per user, 5MB cap), but the comment
overstates it. Fix: normalize to a single extension, or list+delete siblings on upload.

### 3. Stored URL carries a `?v=<timestamp>` cache-buster in the DB (nit / note)
`src/lib/profile.js` persists `${publicUrl}?v=${Date.now()}` into `avatar_url`. This is a
sensible fix for the fixed-filename caching problem and works. Just noting it's now baked
into the stored value (every re-upload rewrites the column with a fresh param) rather than
appended at render time — fine, no action needed, flagged only so it isn't a surprise later.

## Questions for the founder

**Q1 — Should an avatar be allowed to point anywhere, or only at our own storage?**
Right now the photo-upload UI always saves a link to our own Supabase storage, but the
underlying `avatar_url` field will accept *any* web address a technically-minded user pokes
in directly (the permission check only confirms you're editing your own row, not what you
put there). Since that address gets loaded as an image on the leaderboard everyone in the
pool sees, a mischievous user could point it at an off-site image — including a "tracking
pixel" that quietly logs the IP address of everyone who views the board, or an image we'd
never allow through the uploader. The clean fix is one line of DB rule: "this field must be
a link to our own storage." The trade is: add that guard now (a little more rigidity, closes
the hole), or accept it as a known low-severity gap while there are no real users and revisit
before launch. Which do you want?

**Q2 — Are avatars meant to be visible to the whole internet, or only to pool members?**
The bucket is `public = true`, which means any avatar image is fetchable by anyone who has
the URL — not just logged-in users, and not just people in that pool. That's the standard,
simplest way to make `<img>` work without extra plumbing, and it matches how the photos are
used (they show on leaderboards). But it does mean a profile photo is effectively public.
If you'd ever want photos gated to pool members only, that's a different (more complex)
setup and it's much cheaper to decide now than after people upload. Confirm public-by-URL
is the intended trade.

Neither question is a blocker. If both are "yes, that's the trade I want," this is clean to
merge; the two nits are cleanup-when-convenient.
