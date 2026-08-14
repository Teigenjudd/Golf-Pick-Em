import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import PicksHeader from '../../components/pool/PicksHeader'
import CfbGameCard from '../../components/cfb/CfbGameCard'
import CfbCardTracker from '../../components/cfb/CfbCardTracker'
import {
  getCfbPool, getCfbPoolWeeks, getCfbWeekGames, getCfbWeekPicks, submitCfbWeekPicks,
  weekIsLocked,
} from '../../lib/cfb'
import { cfbCardValidity, buildPicksPayload } from '../../utils/cfbCard'
import { formatLockLabel } from '../../utils/cfbFormat'
import { CFB_THEME } from '../../theme/cfb'

// CFB Weekly Picks builder (docs/CFB_UI_PLAN.md §7) — PR-A. The interactive card
// builder + submit: 5 ATS picks on 5 distinct games, an optional double-down flagged
// on one of them, and a mandatory underdog pick on a 6th distinct game. Live validity
// is a client-side mirror of cfb.cfb_submit_week_picks — that RPC is the real gate and
// throws the friendly message we surface on a rejected submit.
//
// PR-A builds: loading, pool-not-found, no-open-week/week-locked (brief notice),
// slate-not-posted, open-empty, open-editing (existing card pre-filled), and
// success-after-submit. The rich READ-ONLY locked/auto-filled/graded card views are
// PR-B — not built here; see CfbPoolDetail's scorecard-expand for that data shape.

function Shell({ poolId, eyebrow, title, subtitle, children }) {
  return (
    <div className="min-h-screen" style={{ background: CFB_THEME.pageCard }}>
      <PicksHeader
        backTo={`/cfb/pool/${poolId}`}
        backLabel="← Pool"
        eyebrow={eyebrow}
        title={title}
        subtitle={subtitle}
        gradient={CFB_THEME.headerGradient}
        accentColor={CFB_THEME.accent}
        rib={CFB_THEME.rib}
        showBadge={false}
      />
      <div className="max-w-[560px] mx-auto px-4 py-8">{children}</div>
    </div>
  )
}

function NoticeCard({ children }) {
  return (
    <div
      className="rounded-[10px] px-5 py-8 text-center"
      style={{ background: CFB_THEME.cardWhite, border: `1px solid ${CFB_THEME.border}` }}
    >
      {children}
    </div>
  )
}

export default function CfbPicks() {
  const { id: poolId } = useParams()
  const { user } = useAuth()
  const [searchParams] = useSearchParams()

  const [pool, setPool] = useState(null)
  const [weeks, setWeeks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [games, setGames] = useState([])
  const [gamesLoaded, setGamesLoaded] = useState(false)
  const [hasExistingCard, setHasExistingCard] = useState(false)

  const [atsPicks, setAtsPicks] = useState({})
  const [doubleDownGameId, setDoubleDownGameId] = useState(null)
  const [underdogGameId, setUnderdogGameId] = useState(null)

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [submitted, setSubmitted] = useState(false)

  // ── base load: pool + weeks ──────────────────────────────────────────────────
  useEffect(() => {
    let active = true
    ;(async () => {
      const p = await getCfbPool(poolId)
      if (!active) return
      if (!p) { setError('Pool not found.'); setLoading(false); return }
      const wk = await getCfbPoolWeeks(p.event_id)
      if (!active) return
      setPool(p); setWeeks(wk)
      setLoading(false)
    })().catch(err => { if (active) { setError(err.message); setLoading(false) } })
    return () => { active = false }
  }, [poolId])

  // Resolve the target week: ?week=N if it exists AND isn't locked, else the earliest
  // not-locked week. Null if every week is locked/graded (or none exist).
  const targetWeek = useMemo(() => {
    if (!weeks.length) return null
    const wanted = Number(searchParams.get('week'))
    const requested = weeks.find(w => w.week_number === wanted)
    if (requested && !weekIsLocked(requested)) return requested
    const open = weeks.filter(w => !weekIsLocked(w)).sort((a, b) => a.week_number - b.week_number)
    return open[0] ?? null
  }, [weeks, searchParams])

  // ── target-week slate + this user's existing card ───────────────────────────
  useEffect(() => {
    if (!targetWeek || !user?.id) return
    let active = true
    setGamesLoaded(false)
    ;(async () => {
      const [g, picks] = await Promise.all([
        getCfbWeekGames(targetWeek.id),
        getCfbWeekPicks(poolId, targetWeek.id),
      ])
      if (!active) return
      setGames(g)

      const mine = picks.filter(pk => pk.user_id === user.id)
      const ats = {}
      let dd = null
      let dog = null
      mine.forEach(pk => {
        if (pk.pick_type === 'ats') {
          ats[pk.game_id] = pk.selected_team
          if (pk.is_double_down) dd = pk.game_id
        } else if (pk.pick_type === 'underdog') {
          dog = pk.game_id
        }
      })
      setAtsPicks(ats)
      setDoubleDownGameId(dd)
      setUnderdogGameId(dog)
      setHasExistingCard(mine.length > 0)
      setGamesLoaded(true)
    })().catch(err => { if (active) { setError(err.message); setGamesLoaded(true) } })
    return () => { active = false }
  }, [targetWeek, poolId, user?.id])

  // A double-down flagged on a game that's no longer an ATS pick (deselected, or its
  // team changed) is cleared automatically — keeps state consistent without every
  // handler having to know about every other slot.
  useEffect(() => {
    if (doubleDownGameId != null && atsPicks[doubleDownGameId] == null) {
      setDoubleDownGameId(null)
    }
  }, [atsPicks, doubleDownGameId])

  const handlePickAts = useCallback((gameId, team) => {
    if (underdogGameId === gameId) return // mutual exclusion — this game is the dog pick
    setAtsPicks(prev => {
      const already = prev[gameId]
      if (already === team) {
        const next = { ...prev }
        delete next[gameId]
        return next
      }
      if (already == null && Object.keys(prev).length >= 5) return prev // 5 slots full
      return { ...prev, [gameId]: team }
    })
  }, [underdogGameId])

  const handleToggleDoubleDown = useCallback((gameId) => {
    if (atsPicks[gameId] == null) return // only legal on a current ATS pick
    setDoubleDownGameId(dd => (dd === gameId ? null : gameId))
  }, [atsPicks])

  const handlePickUnderdog = useCallback((gameId) => {
    if (atsPicks[gameId] != null) return // mutual exclusion — this game is an ATS pick
    setUnderdogGameId(dog => (dog === gameId ? null : gameId))
  }, [atsPicks])

  const validity = useMemo(
    () => cfbCardValidity({ atsPicks, doubleDownGameId, underdogGameId }),
    [atsPicks, doubleDownGameId, underdogGameId],
  )

  async function handleSubmit() {
    if (!validity.valid || submitting || !targetWeek) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const gamesById = Object.fromEntries(games.map(g => [g.id, g]))
      const payload = buildPicksPayload({ atsPicks, doubleDownGameId, underdogGameId }, gamesById)
      await submitCfbWeekPicks(poolId, targetWeek.id, payload)
      setSubmitted(true)
    } catch (err) {
      setSubmitError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // ── states ────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: CFB_THEME.pageCard }}>
        <p className="text-[13px]" style={{ color: CFB_THEME.muted }}>Loading…</p>
      </div>
    )
  }

  if (error || !pool) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: CFB_THEME.pageCard }}>
        <p className="text-[13px]" style={{ color: CFB_THEME.warnInk }}>{error ?? 'Pool not found.'}</p>
      </div>
    )
  }

  const eyebrow = pool.season_year ? `${pool.season_year} CFB` : 'College Football'

  if (!targetWeek) {
    return (
      <Shell poolId={poolId} eyebrow={eyebrow} title="Build your card" subtitle={pool.name}>
        <NoticeCard>
          <p className="text-[13px]" style={{ color: CFB_THEME.ink }}>
            No open week right now — check the pool for results.
          </p>
          <Link
            to={`/cfb/pool/${poolId}`}
            className="inline-block mt-3 text-[12.5px] font-semibold no-underline"
            style={{ color: CFB_THEME.accent }}
          >
            ← Back to the pool
          </Link>
        </NoticeCard>
      </Shell>
    )
  }

  const weekEyebrow = (targetWeek.label ?? `Week ${targetWeek.week_number}`).toUpperCase()
  const subtitle = targetWeek.lock_time ? `Locks ${formatLockLabel(targetWeek.lock_time)}` : null

  if (submitted) {
    return (
      <Shell poolId={poolId} eyebrow={weekEyebrow} title="Card's in" subtitle={subtitle}>
        <NoticeCard>
          <p className="text-[13px] font-semibold" style={{ color: CFB_THEME.positive }}>
            Your card is in for {targetWeek.label ?? `Week ${targetWeek.week_number}`}.
          </p>
          <p className="text-[11.5px] mt-1" style={{ color: CFB_THEME.muted }}>
            You can come back and change it until the week locks.
          </p>
          <Link
            to={`/cfb/pool/${poolId}`}
            className="inline-block mt-3 text-[12.5px] font-semibold no-underline"
            style={{ color: CFB_THEME.accent }}
          >
            ← Back to the pool
          </Link>
        </NoticeCard>
      </Shell>
    )
  }

  if (!gamesLoaded) {
    return (
      <Shell poolId={poolId} eyebrow={weekEyebrow} title="Build your card" subtitle={subtitle}>
        <p className="text-[13px]" style={{ color: CFB_THEME.muted }}>Loading…</p>
      </Shell>
    )
  }

  if (!games.length) {
    return (
      <Shell poolId={poolId} eyebrow={weekEyebrow} title="Build your card" subtitle={subtitle}>
        <NoticeCard>
          <p className="text-[13px]" style={{ color: CFB_THEME.ink }}>
            This week's slate drops soon — check back once the lines are posted.
          </p>
        </NoticeCard>
      </Shell>
    )
  }

  return (
    <div className="min-h-screen pb-[90px]" style={{ background: CFB_THEME.pageCard }}>
      <PicksHeader
        backTo={`/cfb/pool/${poolId}`}
        backLabel="← Pool"
        eyebrow={weekEyebrow}
        title="Build your card"
        subtitle={subtitle}
        gradient={CFB_THEME.headerGradient}
        accentColor={CFB_THEME.accent}
        rib={CFB_THEME.rib}
        showBadge={false}
      />

      <div className="max-w-[560px] mx-auto px-4 pt-6">
        {hasExistingCard && (
          <p className="text-[12px] mb-3" style={{ color: CFB_THEME.muted2 }}>
            Your card's in — you can change it until it locks.
          </p>
        )}

        {submitError && (
          <p className="text-[12.5px] mb-3" style={{ color: CFB_THEME.warnInk }}>{submitError}</p>
        )}

        <div className="space-y-3">
          {games.map(game => (
            <CfbGameCard
              key={game.id}
              game={game}
              atsSelectedTeam={atsPicks[game.id] ?? null}
              isDoubleDown={doubleDownGameId === game.id}
              isUnderdogPick={underdogGameId === game.id}
              atsFull={Object.keys(atsPicks).length >= 5}
              dogFilled={underdogGameId != null}
              onPickAts={handlePickAts}
              onToggleDoubleDown={handleToggleDoubleDown}
              onPickUnderdog={handlePickUnderdog}
            />
          ))}
        </div>
      </div>

      <CfbCardTracker
        atsCount={validity.atsCount}
        ddCount={validity.ddCount}
        dogCount={validity.dogCount}
        valid={validity.valid}
        warning={validity.warning}
        submitting={submitting}
        hasExistingCard={hasExistingCard}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
