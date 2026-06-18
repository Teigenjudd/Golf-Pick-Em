import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SLASH_GOLF_BASE = 'https://live-golf-data.p.rapidapi.com'
const MONTHLY_CAP = 1800

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Require admin JWT
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response('Unauthorized', { status: 401 })
  }
  const { data: { user } } = await supabase.auth.getUser(authHeader.slice(7))
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin') return new Response('Forbidden', { status: 403 })

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
      { status: 429, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // Build and call Slash Golf
  const url = new URL(`${SLASH_GOLF_BASE}/${endpoint}`)
  for (const [key, val] of Object.entries(params ?? {})) {
    url.searchParams.set(key, String(val))
  }

  const res = await fetch(url.toString(), {
    headers: {
      'x-rapidapi-key': Deno.env.get('SLASH_GOLF_API_KEY')!,
      'x-rapidapi-host': 'live-golf-data.p.rapidapi.com',
    },
  })

  if (!res.ok) {
    return new Response(JSON.stringify({ error: `Slash Golf ${res.status}` }), {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const data = await res.json()

  // Increment counter
  await supabase.from('api_usage').upsert(
    { month, slash_golf_calls: currentCount + 1 },
    { onConflict: 'month' },
  )

  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  })
})
