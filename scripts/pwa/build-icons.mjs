/**
 * Renders scripts/pwa/icon.html → public/icons/icon-192.png, icon-512.png, and
 * icon-512-maskable.png.
 *
 * Run with `npm run pwa:icons` after editing the template, then commit the PNGs. Same
 * build-time-not-runtime reasoning as scripts/og/build-og.mjs, and the same headless-
 * Chrome-for-real-webfonts trick.
 *
 * Chrome's headless `--screenshot` has a small-viewport bug: below roughly 300px,
 * `--window-size` doesn't shrink the actual layout viewport, so the page lays out at
 * some larger default width and the screenshot is just an uncropped top-left slice of
 * it — the glyph ends up huge and off-center. So every size is rendered at 512 (safely
 * above that floor) and 192 is produced by downscaling the 512 with sharp instead of
 * asking Chrome for a 192 viewport directly.
 */

import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../..')

const TEMPLATE = join(here, 'icon.html')
const OUT_DIR = join(repo, 'public', 'icons')

const TMP = join(tmpdir(), 'poold-pwa-icons')

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

const RENDER_SIZE = 512

const SOURCES = [
  { file: '_any-512.png', maskable: false },
  { file: 'icon-512-maskable.png', maskable: true },
]

mkdirSync(TMP, { recursive: true })
mkdirSync(OUT_DIR, { recursive: true })

for (const { file, maskable } of SOURCES) {
  const shot = join(TMP, file)
  const url = `file://${TEMPLATE.replace(/\\/g, '/')}${maskable ? '?maskable=1' : ''}`

  execFileSync(chrome, [
    '--headless',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    `--window-size=${RENDER_SIZE},${RENDER_SIZE}`,
    // The font comes from Google Fonts over the network — without this the glyph
    // renders in a fallback face and looks subtly, unplaceably wrong.
    '--virtual-time-budget=6000',
    `--screenshot=${shot.replace(/\\/g, '/')}`,
    url,
  ], { stdio: 'inherit' })
}

copyFileSync(join(TMP, '_any-512.png'), join(OUT_DIR, 'icon-512.png'))
console.log('Wrote public/icons/icon-512.png')

copyFileSync(join(TMP, 'icon-512-maskable.png'), join(OUT_DIR, 'icon-512-maskable.png'))
console.log('Wrote public/icons/icon-512-maskable.png')

await sharp(join(TMP, '_any-512.png'))
  .resize(192, 192)
  .toFile(join(OUT_DIR, 'icon-192.png'))
console.log('Wrote public/icons/icon-192.png')

rmSync(TMP, { recursive: true, force: true })
