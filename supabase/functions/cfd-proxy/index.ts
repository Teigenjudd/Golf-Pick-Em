import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Server-side proxy for the CollegeFootballData API (collegefootballdata.com).
// Mirrors slash-golf-proxy: the CFBD_API_KEY lives as a Supabase secret and is
// never exposed to the browser. Admin JWT required. Monthly call cap is tracked
// in api_usage.cfbd_calls. On CFBD Tier 2 the cap is 30k/month; keep this value in
// sync with grade-cfb-week and poll-cfb-scores (they share the api_usage.cfbd_calls
// counter).
const CFBD_BASE = 'https://api.collegefootballdata.com'
const MONTHLY_CAP = 30000

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Require admin JWT
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
  if (profile?.role !== 'admin') return new Response('Forbidden', { status: 403, headers: corsHeaders })

  const { endpoint, params } = await req.json()

  // Only allow the CFBD endpoints the slate importer needs — no arbitrary
  // path passthrough.
  const ALLOWED = new Set(['games', 'lines', 'teams/fbs'])
  if (!ALLOWED.has(endpoint)) {
    return new Response(JSON.stringify({ error: `Endpoint not allowed: ${endpoint}` }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Check monthly cap
  const month = new Date().toISOString().slice(0, 7)
  const { data: usage } = await supabase
    .from('api_usage')
    .select('cfbd_calls')
    .eq('month', month)
    .single()

  const currentCount = usage?.cfbd_calls ?? 0
  if (currentCount >= MONTHLY_CAP) {
    return new Response(
      JSON.stringify({ error: `Monthly CFBD API cap (${MONTHLY_CAP}) reached` }),
      { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  // Build and call CFBD (retry once on 429 rate limit)
  const url = new URL(`${CFBD_BASE}/${endpoint}`)
  for (const [key, val] of Object.entries(params ?? {})) {
    url.searchParams.set(key, String(val))
  }

  const cfbdHeaders = {
    'Authorization': `Bearer ${Deno.env.get('CFBD_API_KEY')!}`,
    'Accept': 'application/json',
  }

  let res = await fetch(url.toString(), { headers: cfbdHeaders })
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 1500))
    res = await fetch(url.toString(), { headers: cfbdHeaders })
  }

  if (!res.ok) {
    return new Response(JSON.stringify({ error: `CFBD ${res.status}` }), {
      status: res.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const data = await res.json()

  // Increment counter
  await supabase.from('api_usage').upsert(
    { month, cfbd_calls: currentCount + 1 },
    { onConflict: 'month' },
  )

  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
