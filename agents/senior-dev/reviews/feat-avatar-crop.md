# Senior review — feat/avatar-crop

- **Reviewed:** 2026-08-31
- **Head:** f9c7af6
- **Verdict:** APPROVE WITH QUESTIONS

## Summary
Adds a crop step between picking an avatar photo and uploading it, on both Profile and
`/admin/users`. One new self-contained component (`AvatarCropModal.jsx`) wraps
`react-easy-crop`; the two pages split their old `handleAvatarChange` into "open the
modal" + "upload the cropped blob". The upload seam (`uploadAvatarForUser`) is untouched
and correctly handles a `Blob` because it only ever reads `.type`/`.size`, never `.name`.
This is a small, well-reasoned, low-risk diff — the tricky bits the PR calls out
(StrictMode blob-URL lifecycle, canvas clipping past image bounds, CORS taint) are all
handled correctly. The three things I'd want a conscious decision on are quality/scope
choices, not bugs. Clean to merge once you're happy with the output-size trade below.

## Findings
Ranked most-severe first.

**1. (debt / decision) Uploaded crop is full source resolution, not a capped avatar size — `AvatarCropModal.jsx` `getCroppedBlob`.**
The canvas is sized to `cropPixels.width/height`, which are *source-image* pixels. For a
big phone photo (say 4000×3000) a near-1x crop produces a ~3000×3000 JPEG — multiple MB —
for something that renders in a ~40–96px circle. Two costs: (a) wasted storage/bandwidth
on every avatar, and (b) at extreme zoom-out on a large image the export can push past the
client-side 5MB cap (`validateAvatarFile`), which then fails *after* the modal has already
closed, surfacing as a page-level "Keep it under 5MB." rather than something the user can
fix in the cropper. Neither is a crash — `toBlob` returning null and the size check both
degrade gracefully — but it's the kind of thing that's trivial now and annoying to retrofit
later. Fix direction: draw to a fixed output box (e.g. 512×512) by scaling the destination
rect; the white-fill logic and everything else stays identical. This is the one item I'd
genuinely like a decision on before merge (see Questions).

**2. (nit) Extension change can orphan a prior non-JPEG avatar — `profile.js` upload path.**
The crop always exports `image/jpeg`, so every upload now lands at `userId/avatar.jpg`. The
upsert-at-fixed-path trick that keeps storage from piling up orphans only works *within* one
extension. If a user uploaded a PNG/WebP via the just-merged PR #66 (path `avatar.png`), a
later cropped upload writes `avatar.jpg` and leaves the old `avatar.png` behind. Impact is
effectively zero today (no real users, and every future upload is JPEG so it's internally
consistent going forward), so this is a note, not a task — flagging only so it's a known
fact, not a surprise later.

**3. (confirmed sound, not a finding) The three things the PR asked me to pressure-test all hold up:**
- *StrictMode blob-URL fix* — the create+revoke-in-one-effect pattern is correct and robust.
  Dev double-invoke runs create(url1)→setState(url1)→cleanup revoke(url1)→create(url2)→
  setState(url2); final state points at the live `url2`, `url1` is cleaned up. `file` never
  changes while the modal is mounted in either caller (it's set on pick, cleared to `null`
  to unmount), so there's no multi-invocation or "file changes mid-save" race actually
  reachable. And on save, `await getCroppedBlob(...)` fully resolves (canvas already drawn)
  *before* `onCropped` triggers the unmount that revokes the URL — so no use-after-revoke.
- *Canvas clipping past image bounds* — `drawImage`'s 9-arg form is safe here. Widths/heights
  are always positive (so no `IndexSizeError`), and negative/oversized `sx,sy,sWidth,sHeight`
  are handled by the spec's proportional-clip rule that modern browsers implement: the source
  rect is clipped to the image and the destination rect is scaled by the same proportion, so
  the image lands undistorted and correctly positioned with the white fill showing through the
  margin. That's exactly the intended zoom-below-1 behavior.
- *CORS / tainted canvas* — both call sites pass `URL.createObjectURL(file)` where `file` came
  straight from a `<input type=file>`. Always a same-origin `blob:` URL, never remote, so the
  no-`crossOrigin` comment is accurate.

## Questions for the founder
**1. Do you want the uploaded avatar downscaled to a fixed size (e.g. 512×512), or keep
uploading it at the photo's full resolution?**
Right now the crop is saved at whatever resolution the original photo was — so a big phone
photo becomes a multi-megabyte file that gets displayed in a tiny circle. Trade: keeping it
full-res is zero extra code and preserves maximum quality if you ever show avatars larger;
capping it (a one-line change to how the crop is drawn) makes every upload small and fast and
removes the one edge case where a zoomed-out crop of a huge image can bust the 5MB limit
*after* the crop modal has already closed. For an avatar that never renders bigger than a
coin, capping is almost certainly the right call — but it's your quality-vs-simplicity call,
so I'm flagging it rather than assuming. Nothing else here needs a decision.
