-- ============================================================================
-- Admin manual lock/unlock for a CFB week (ops page override).
--
-- Root cause this addresses: cfb.weeks.status is a one-way ratchet today —
-- cfb.process_locked_weeks() (the 10-min cron) flips 'scheduled'/'open' → 'locked'
-- once lock_time passes, but nothing ever moves it back, and updateWeekLockTime()
-- (src/lib/cfb.js) only ever writes lock_time, never status. So if a week's
-- lock_time was ever wrong and briefly in the past — even for one 10-min cron
-- tick — the week gets stuck 'locked' forever afterward, even after an admin
-- corrects lock_time back to a real future deadline: weekIsLocked() (shared by
-- every read/write path, including cfb.cfb_submit_week_picks) checks status
-- BEFORE lock_time, so a corrected lock_time is silently ignored. This is what
-- happened to "The Boyz <3 CFB" Week 1: lock_time reads 2026-09-05 05:00 UTC
-- (a real, still-future deadline) but status is stuck at 'locked'.
--
-- Fix here is a manual escape hatch, not a data patch: give the admin ops page
-- direct control over a week's status so a stuck week (from this bug, or any
-- future cause) doesn't require a DB console. A follow-up could also make
-- updateWeekLockTime auto-reopen a week when the new time is pushed into the
-- future, but an explicit admin action is the safer fix to ship first — it
-- can't silently reopen a week the admin actually meant to keep closed.
-- ============================================================================

-- ── Lock: force a week closed right now, regardless of lock_time ────────────
-- Mirrors what cfb.process_locked_weeks() does automatically at the real
-- deadline (flip status, then auto-fill anyone missing a card) so a manual
-- early lock behaves identically to the automatic one. Auto-fill failure is
-- logged, not fatal — same as the cron — so a broken week (e.g. fewer than 6
-- games loaded) still locks even if it can't fill it.
CREATE OR REPLACE FUNCTION cfb.admin_lock_week(p_week_id uuid)
RETURNS integer  -- cards auto-filled
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = cfb, public
AS $fn$
DECLARE
  v_status text;
  v_filled integer := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin role required' USING ERRCODE = '42501';
  END IF;

  SELECT status INTO v_status FROM cfb.weeks WHERE id = p_week_id;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Week not found' USING ERRCODE = '22023';
  END IF;
  IF v_status = 'graded' THEN
    RAISE EXCEPTION 'This week is already graded — locking it now would not change anything' USING ERRCODE = '22023';
  END IF;

  UPDATE cfb.weeks SET status = 'locked' WHERE id = p_week_id;

  BEGIN
    v_filled := cfb.autofill_week(p_week_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'admin_lock_week: autofill_week(%) failed: %', p_week_id, SQLERRM;
  END;

  RETURN v_filled;
END;
$fn$;

-- ── Unlock: reopen a week for picks ──────────────────────────────────────────
-- Sets status back to 'scheduled' — the same "not locked" state a freshly
-- seeded week starts in; weekIsLocked() (src/lib/cfb.js) only ever special-cases
-- 'locked'/'graded', so 'scheduled' and the (unused) 'open' label behave
-- identically everywhere else in the app. Refuses to touch a graded week —
-- there is no re-grading path, so unlocking one would let people edit picks
-- for games that have already been scored.
--
-- Deliberately does NOT touch lock_time or delete any auto-filled picks:
--   - If lock_time is still in the past, cfb.process_locked_weeks() will just
--     re-lock this week on its next run (within 10 min) — the ops page shows a
--     warning for this case so the admin also pushes the lock time forward.
--   - A participant's auto-filled card is naturally replaced the moment they
--     submit for real: cfb.cfb_submit_week_picks deletes + re-inserts that
--     user's picks for the week, so no separate cleanup step is needed here.
CREATE OR REPLACE FUNCTION cfb.admin_unlock_week(p_week_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = cfb, public
AS $fn$
DECLARE
  v_status text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin role required' USING ERRCODE = '42501';
  END IF;

  SELECT status INTO v_status FROM cfb.weeks WHERE id = p_week_id;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Week not found' USING ERRCODE = '22023';
  END IF;
  IF v_status = 'graded' THEN
    RAISE EXCEPTION 'This week is already graded and cannot be unlocked' USING ERRCODE = '22023';
  END IF;

  UPDATE cfb.weeks SET status = 'scheduled' WHERE id = p_week_id;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION cfb.admin_lock_week(uuid)   FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION cfb.admin_unlock_week(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION cfb.admin_lock_week(uuid)   TO authenticated;
GRANT  EXECUTE ON FUNCTION cfb.admin_unlock_week(uuid) TO authenticated;
