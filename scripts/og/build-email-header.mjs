/**
 * Renders scripts/og/email-header.html → public/email-header.png (1200×296).
 *
 * Run with `npm run og:email` after editing the header art, then commit the PNG. Like
 * build-og.mjs this is a build-time script: the image is static, so we render it once
 * and serve the same bytes rather than regenerating on every request.
 *
 * The PNG is hosted at getpoold.app/email-header.png (Netlify serves public/) and the
 * magic-link email references that URL. It's rendered at 2x and displayed at 600px wide,
 * so it stays sharp on retina phones.
 *
 * Headless Chrome rather than an SVG rasterizer because Chrome fetches the real Barlow
 * Condensed webfont — the band is set in the actual brand face, not a lookalike.
 */

import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../..')

const CARD = join(here, 'email-header.html')
const OUT = join(repo, 'public', 'email-header.png')

// Chrome ignores cwd for --screenshot and refuses relative paths, so hand it an
// absolute one somewhere it is definitely allowed to write, then copy the result in.
const TMP = join(tmpdir(), 'poold-email-header')
const SHOT = join(TMP, 'email-header.png')

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
]

const chrome = process.env.CHROME_PATH ?? CHROME_CANDIDATES.find(p => existsSync(p))

if (!chrome) {
  console.error(
    'No Chrome found. Set CHROME_PATH to a Chrome/Chromium binary, or install Chrome.\n' +
    'Tried:\n  ' + CHROME_CANDIDATES.join('\n  ')
  )
  process.exit(1)
}

mkdirSync(TMP, { recursive: true })

execFileSync(chrome, [
  '--headless',
  '--disable-gpu',
  '--hide-scrollbars',
  '--force-device-scale-factor=1',
  '--window-size=1200,296',
  // The font comes from Google Fonts over the network — without this the band renders
  // in a fallback face and looks subtly, unplaceably wrong.
  '--virtual-time-budget=6000',
  `--screenshot=${SHOT.replace(/\\/g, '/')}`,
  `file://${CARD.replace(/\\/g, '/')}`,
], { stdio: 'inherit' })

mkdirSync(dirname(OUT), { recursive: true })
copyFileSync(SHOT, OUT)
rmSync(TMP, { recursive: true, force: true })

console.log(`Wrote ${OUT}`)
