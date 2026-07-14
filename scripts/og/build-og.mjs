/**
 * Renders scripts/og/card.html → public/og-default.png (1200×630).
 *
 * Run with `npm run og` after editing the card, then commit the PNG. This is a build-
 * time script on purpose: the image is static, so generating it on every request (or on
 * every deploy) would be work we do thousands of times to get the same bytes.
 *
 * Headless Chrome rather than an SVG rasterizer because Chrome fetches the real webfonts
 * — the card is set in Barlow Condensed, not a fallback that merely resembles it.
 */

import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../..')

const CARD = join(here, 'card.html')
const OUT = join(repo, 'public', 'og-default.png')

// Chrome ignores cwd for --screenshot and refuses relative paths, so hand it an
// absolute one somewhere it is definitely allowed to write, then copy the result in.
const TMP = join(tmpdir(), 'poold-og')
const SHOT = join(TMP, 'og-default.png')

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
  '--window-size=1200,630',
  // The fonts come from Google Fonts over the network — without this the card renders
  // in a fallback face and looks subtly, unplaceably wrong.
  '--virtual-time-budget=6000',
  `--screenshot=${SHOT.replace(/\\/g, '/')}`,
  `file://${CARD.replace(/\\/g, '/')}`,
], { stdio: 'inherit' })

mkdirSync(dirname(OUT), { recursive: true })
copyFileSync(SHOT, OUT)
rmSync(TMP, { recursive: true, force: true })

console.log(`Wrote ${OUT}`)
