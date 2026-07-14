/**
 * Rich link previews for invite links.
 *
 * The problem: when someone pastes https://getpoold.app/join/K4XR2M into a group
 * chat, iMessage (and WhatsApp, Slack, Discord, Signal, Twitter) fetches that URL
 * and reads the <head> for Open Graph tags. It does NOT run JavaScript. We are a
 * single-page app, so every route serves the same index.html and React paints the
 * page afterwards — far too late for the crawler, which has already left. Result:
 * the invite link, which is the entire growth loop, unfurls as a bare URL.
 *
 * This runs on Netlify's edge, in front of the CDN response: it takes the HTML
 * that was about to be sent, looks up the pool by its join code, and rewrites the
 * OG block with real details. Humans still get the normal SPA — the tags they
 * never see are simply correct now.
 *
 * Failure is always silent. A preview card is a nice-to-have; the join page is
 * not. If the lookup fails, times out, or the code is bogus, we serve the page
 * untouched with its default tags rather than break the page for a real user.
 */

const TIMEOUT_MS = 1200  // a crawler will not wait, and neither should a human

export default async (request, context) => {
  const response = await context.next()

  // Only rewrite HTML. Assets, JSON, redirects: pass straight through.
  if (!(response.headers.get('content-type') ?? '').includes('text/html')) {
    return response
  }

  const code = new URL(request.url).pathname.split('/').filter(Boolean).pop()
  if (!code) return response

  const pool = await fetchPool(code)
  if (!pool) return response   // bad/expired code — default tags are the honest answer

  const html = await response.text()
  return new Response(injectTags(html, pool, request.url), response)
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

function injectTags(html, pool, requestUrl) {
  const name = pool.pool_name ?? 'a Poold pool'

  const title = pool.organizer
    ? `${pool.organizer} invited you to ${name}`
    : `You're invited to ${name}`

  // "Short and punchy" — the no-download promise is the point of the line, and
  // iMessage truncates the description after two lines, so it goes early.
  const picks = pool.pick_count
    ? `${pool.pick_count} picks. `
    : ''
  const description = `${picks}No app, no password, no download. Tap the link and you're in.`

  const tags = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="Poold" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:url" content="${esc(requestUrl)}" />`,
    `<meta property="og:image" content="${esc(new URL('/og-default.png', requestUrl).href)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
  ].join('\n    ')

  // index.html carries the same markers around its default tags, so this is a
  // straight swap. If the markers ever go missing, we return the page unchanged.
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

export const config = { path: '/join/*' }
