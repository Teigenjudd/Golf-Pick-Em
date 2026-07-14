import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// A2 — The Odds API key used to ship in the browser bundle (VITE_ODDS_API_KEY,
// inlined by Vite into client JS), so anyone could lift it from DevTools and burn
// the quota. Same pattern as slash-golf-proxy: the key lives as a Supabase secret
// and never leaves the server.
const ODDS_BASE = 'https://api.the-odds-api.com/v4/sports'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Require admin JWT — odds are only ever fetched from the create-pool wizard.
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders })
  }
  const { data: { user } } = await supabase.auth.getUser(authHeader.slice(7))
  if (!user) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin') {
    return new Response('Forbidden', { status: 403, headers: corsHeaders })
  }

  const { sportKey } = await req.json()

  // Constrain what can be proxied. The key is scoped to our account across every
  // sport The Odds API sells, so an unvalidated passthrough would let a leaked
  // admin token spend our quota on anything. Matching the golf_* family (rather
  // than an exact allowlist) means a new major can be added to
  // src/lib/oddsApi.js without redeploying this function.
  if (typeof sportKey !== 'string' || !/^golf_[a-z0-9_]+$/.test(sportKey)) {
    return json({ error: 'Unsupported sport key' }, 400)
  }

  const url = new URL(`${ODDS_BASE}/${sportKey}/odds`)
  url.searchParams.set('apiKey', Deno.env.get('ODDS_API_KEY')!)
  url.searchParams.set('regions', 'us')
  url.searchParams.set('markets', 'outrights')
  url.searchParams.set('oddsFormat', 'american')

  const res = await fetch(url.toString())
  if (!res.ok) {
    return json({ error: `Odds API ${res.status}` }, res.status)
  }

  return json(await res.json())
})
