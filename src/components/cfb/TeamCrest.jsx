import { useState } from 'react'
import { CFB_THEME } from '../../theme/cfb'

// A small team logo, shared by CfbGameCard (picks builder) and CfbCardRows
// (scorecard/read-only card) so crest sizing/fallback can't drift between them. Renders
// nothing — not a broken-image icon — when the URL is null/undefined or fails to load,
// same silent-fallback pattern as the rest of the app (weather widget, OG previews).
// No circular mask: crests aren't drawn to fill a circle, so rounding the frame cropped
// corners/edges off the mark — object-contain alone shows the whole logo, letterboxed
// inside the square frame if the source isn't itself square.
//
// reserveSpace: for a caller laying out a fixed-width crest column (CfbCardRows) —
// renders an empty same-size box instead of collapsing to nothing on a missing/failed
// logo, so rows with and without a logo still line up under that column. CfbGameCard's
// inline chip usage leaves this off; there the crest sits in a natural flex row where
// collapsing is fine.
export default function TeamCrest({ src, alt, size = 20, reserveSpace = false }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return reserveSpace ? <span className="flex-none" style={{ width: size, height: size }} /> : null
  }
  return (
    <img
      key={src}
      src={src}
      alt={alt ?? ''}
      width={size}
      height={size}
      className="rounded-[4px] flex-none object-contain"
      style={{ background: CFB_THEME.cardWhite }}
      onError={() => setFailed(true)}
    />
  )
}
