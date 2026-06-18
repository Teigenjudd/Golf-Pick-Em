import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SLASH_GOLF_BASE = 'https://live-golf-data.p.rapidapi.com'
const MONTHLY_CAP = 1800

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

  // Check monthly cap
  const month = new Date().toISOString().slice(0, 7)
  const { data: usage } = await supabase
    .from('api_usage')
    .select('slash_golf_calls')
    .eq('month', month)
    .single()

  const currentCount = usage?.slash_golf_calls ?? 0
  if (currentCount >= MONTHLY_CAP) {
    return new Response(
      JSON.stringify({ error: `Monthly Slash Golf API cap (${MONTHLY_CAP}) reached` }),
      { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  // Build and call Slash Golf (retry once on 429 rate limit)
  const url = new URL(`${SLASH_GOLF_BASE}/${endpoint}`)
  for (const [key, val] of Object.entries(params ?? {})) {
    url.searchParams.set(key, String(val))
  }

  const slashHeaders = {
    'x-rapidapi-key': Deno.env.get('SLASH_GOLF_API_KEY')!,
    'x-rapidapi-host': 'live-golf-data.p.rapidapi.com',
  }

  let res = await fetch(url.toString(), { headers: slashHeaders })
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 1500))
    res = await fetch(url.toString(), { headers: slashHeaders })
  }

  if (!res.ok) {
    return new Response(JSON.stringify({ error: `Slash Golf ${res.status}` }), {
      status: res.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const data = await res.json()

  // Increment counter
  await supabase.from('api_usage').upsert(
    { month, slash_golf_calls: currentCount + 1 },
    { onConflict: 'month' },
  )

  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
