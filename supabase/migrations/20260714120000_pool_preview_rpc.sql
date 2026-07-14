-- ============================================================================
-- pool_preview(code) — the data behind an invite link's preview card.
--
-- When a join link is pasted into iMessage/WhatsApp/Slack, the app has to answer
-- "what is this?" to an *unauthenticated crawler* that does not run JavaScript.
-- A Netlify edge function does that by injecting OG tags into the HTML — but it
-- needs pool data to inject, and it has no session.
--
-- The tempting shortcut is to give the edge function a service-role key. Don't:
-- that key bypasses RLS on every table in the database, and it would be sitting
-- in Netlify's env to serve a preview card. This function is the small-blast-
-- radius version — it hands out exactly the five fields a preview card shows,
-- for exactly the pools whose join code you already hold.
--
-- Why SECURITY DEFINER: `pools` is readable only by authenticated users, and
-- `pick_count` / `badge_config` live in the `golf` schema, which is not exposed
-- to the Data API at all. This function reaches both and returns a fixed, safe
-- projection — no join_code, no stake, no participant list.
--
-- Disclosure note: this reveals a pool's name, course, pick count, lock time and
-- badge to anyone holding a valid join code. That is not a new leak — holding the
-- code already lets you *join the pool* and see all of it. (A5 in the backlog
-- tracks the fact that codes are over-readable in the first place; this function
-- deliberately does not widen that.)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.pool_preview(p_code text)
RETURNS TABLE (
  pool_name    text,
  organizer    text,
  course_name  text,
  pick_count   integer,
  lock_time    timestamptz,
  badge_config jsonb
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, golf
STABLE
AS $$
  SELECT
    p.name,
    org.display_name,
    d.course_name,
    d.pick_count,
    p.lock_time,
    d.badge_config
  FROM public.pools p
  LEFT JOIN golf.event_details d ON d.event_id = p.event_id
  LEFT JOIN public.profiles   org ON org.id    = p.created_by
  WHERE p.join_code = p_code
    AND p.status <> 'draft';   -- an unlaunched pool has nothing to preview
$$;

-- The crawler is anonymous — it has no session and never will. anon must be able
-- to call this, which is the whole point; the function's fixed projection is what
-- makes that safe.
REVOKE EXECUTE ON FUNCTION public.pool_preview(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.pool_preview(text) TO anon, authenticated;
