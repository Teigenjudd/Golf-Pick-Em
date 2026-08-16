import { useState } from 'react'
import { CFB_THEME } from '../../theme/cfb'

// A small team logo, shared by CfbGameCard (picks builder) and CfbCardRows
// (scorecard/read-only card) so crest sizing/fallback can't drift between them. Renders
// nothing — not a broken-image icon — when the URL is null/undefined or fails to load,
// same silent-fallback pattern as the rest of the app (weather widget, OG previews).
// No circular mask: crests aren't drawn to fill a circle, so rounding the frame cropped
// corners/edges off the mark — object-contain alone shows the whole logo, letterboxed
// inside the square frame if the source isn't itself square.
export default function TeamCrest({ src, alt, size = 20 }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) return null
  return (
    <img
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
