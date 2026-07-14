/**
 * Rich link previews for every link worth sharing.
 *
 * The problem: when someone pastes a Poold link into a group chat, iMessage (and
 * WhatsApp, Slack, Discord, Signal, Twitter) fetches that URL and reads the <head>
 * for Open Graph tags. It does NOT run JavaScript. We are a single-page app, so
 * every route serves the same index.html and React paints the page afterwards —
 * far too late for the crawler, which has already left. Left alone, our links
 * unfurl as bare URLs.
 *
 * index.html carries sensible default tags, so *any* link already previews as the
 * generic Poold card. This function earns its keep on the two links people actually
 * send, which are making different pitches:
 *
 *   /join/*  — "Judd invited you to The Open Championship", the pool looked up live
 *              by its join code. This is the growth loop.
 *   /demo    — the pitch is "no sign-up", not "you're invited". Different link,
 *              different job, different words.
 *
 * Everything else keeps index.html's defaults.
 *
 * Failure is always silent. A preview card is a nice-to-have; the page is not. If a
 * lookup fails, times out, or the code is bogus, serve the page untouched.
 */

const TIMEOUT_MS = 1200  // a crawler will not wait, and neither should a human

const DEMO = {
  title: 'See a Poold pool in action — no sign-up',
  description: 'Real field, real leaderboard. Fill out a full card in 30 seconds. No app, no password, no sign-up.',
}

export default async (request, context) => {
  const response = await context.next()

  // Only rewrite HTML. Assets, JSON, redirects: pass straight through.
  if (!(response.headers.get('content-type') ?? '').includes('text/html')) {
    return response
  }

  const url = new URL(request.url)
  const meta = url.pathname.startsWith('/demo')
    ? DEMO
    : await poolMeta(url.pathname)

  if (!meta) return response   // bad/expired code — the default tags are the honest answer

  const html = await response.text()
  return new Response(injectTags(html, meta, request.url), response)
}

/** Look a pool up by the join code in the path, and phrase its card. */
async function poolMeta(pathname) {
  const code = pathname.split('/').filter(Boolean).pop()
  if (!code) return null

  const pool = await fetchPool(code)
  if (!pool) return null

  const name = pool.pool_name ?? 'a Poold pool'

  // The organizer's display name goes on this card — which is exactly why display
  // names are user-chosen and no longer derived from an email address.
  const title = pool.organizer
    ? `${pool.organizer} invited you to ${name}`
    : `You're invited to ${name}`

  // iMessage truncates the description after two lines, so the no-download promise —
  // the actual objection being handled — goes early.
  const picks = pool.pick_count ? `${pool.pick_count} picks. ` : ''

  return {
    title,
    description: `${picks}No app, no password, no download. Tap the link and you're in.`,
  }
}

async function fetchPool(code) {
  const url = Netlify.env.get('VITE_SUPABASE_URL')
  const key = Netlify.env.get('VITE_SUPABASE_ANON_KEY')
  if (!url || !key) return null

  try {
    const res = await fetch(`${url}/rest/v1/rpc/pool_preview`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_code: code }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) return null

    const rows = await res.json()
    return Array.isArray(rows) && rows.length ? rows[0] : null
  } catch {
    return null   // network, timeout, malformed JSON — all mean "no card"
  }
}

function injectTags(html, meta, requestUrl) {
  const tags = [
    `<title>${esc(meta.title)}</title>`,
    `<meta name="description" content="${esc(meta.description)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="Poold" />`,
    `<meta property="og:title" content="${esc(meta.title)}" />`,
    `<meta property="og:description" content="${esc(meta.description)}" />`,
    `<meta property="og:url" content="${esc(requestUrl)}" />`,
    `<meta property="og:image" content="${esc(new URL('/og-default.png', requestUrl).href)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
  ].join('\n    ')

  // index.html carries the same markers around its default tags, so this is a straight
  // swap. If the markers ever go missing, the page is returned unchanged.
  return html.replace(
    /<!-- og:start -->[\s\S]*?<!-- og:end -->/,
    `<!-- og:start -->\n    ${tags}\n    <!-- og:end -->`
  )
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Declared here rather than in netlify.toml so the paths sit next to the code that
// branches on them.
export const config = { path: ['/join/*', '/demo', '/demo/*'] }
