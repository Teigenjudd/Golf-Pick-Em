import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import PicksHeader from '../../components/pool/PicksHeader'
import CfbGameCard from '../../components/cfb/CfbGameCard'
import CfbGameFilterBar from '../../components/cfb/CfbGameFilterBar'
import CfbCardTracker from '../../components/cfb/CfbCardTracker'
import CfbCardReadonly from '../../components/cfb/CfbCardReadonly'
import CfbRulesButton from '../../components/cfb/CfbRulesButton'
import {
  getCfbPool, getCfbPoolWeeks, getCfbWeekGames, getCfbWeekPicks, submitCfbWeekPicks,
  weekIsLocked,
} from '../../lib/cfb'
import { cfbCardValidity, buildPicksPayload, shapeCard, gameHasStarted } from '../../utils/cfbCard'
import { conferencesInPlay, filterAndSortGames } from '../../utils/cfbGameFilters'
import { formatLockLabel } from '../../utils/cfbFormat'
import { CFB_THEME } from '../../theme/cfb'

// CFB Weekly Picks builder (docs/CFB_UI_PLAN.md §7) — PR-A. The interactive card
// builder + submit: 5 ATS picks on 5 distinct games, an optional double-down flagged
// on one of them, and a mandatory underdog pick on a 6th distinct game. Live validity
// is a client-side mirror of cfb.cfb_submit_week_picks — that RPC is the real gate and
// throws the friendly message we surface on a rejected submit.
//
// States: loading, pool-not-found, no-weeks-yet, slate-not-posted, open-empty,
// open-editing (existing card pre-filled), success-after-submit, and the READ-ONLY
// locked/auto-filled/graded card views (PR-B) — once a week locks the card is frozen
// and rendered via CfbCardReadonly, sharing the graded row shape (shapeCard) and rows
// (CfbCardRows) with CfbPoolDetail's scorecard-expand so the two can't drift.

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
  const [myPicks, setMyPicks] = useState([])

  const [atsPicks, setAtsPicks] = useState({})
  const [doubleDownGameId, setDoubleDownGameId] = useState(null)
  const [underdogGameId, setUnderdogGameId] = useState(null)

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [submitted, setSubmitted] = useState(false)

  // View-only controls for the game list — never affect pick state, slot counts, or
  // the submit payload, all of which stay keyed off the full `games` array below.
  const [search, setSearch] = useState('')
  const [selectedConferences, setSelectedConferences] = useState(new Set())
  const [sortBy, setSortBy] = useState('kickoff')

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

  // Resolve the target week. Priority (per PR-B): honor ?week=N if it exists — even
  // when locked, so a deep-link to a past week shows that week's read-only card. Else
  // the earliest still-open week (the one to build). Else, with nothing open, the most
  // recent locked/graded week so a returning player lands on their latest card. Null
  // only when the pool has no weeks at all.
  const targetWeek = useMemo(() => {
    if (!weeks.length) return null
    // Only honor ?week when it's actually present and a positive number — a missing
    // param would otherwise Number()-coerce to 0 and (if a Week 0 ever existed) resolve
    // to it instead of the current week.
    const wantedRaw = searchParams.get('week')
    const wanted = wantedRaw != null ? Number(wantedRaw) : null
    const requested = wanted ? weeks.find(w => w.week_number === wanted) : null
    if (requested) return requested
    const open = weeks.filter(w => !weekIsLocked(w)).sort((a, b) => a.week_number - b.week_number)
    if (open[0]) return open[0]
    const locked = weeks.filter(w => weekIsLocked(w)).sort((a, b) => b.week_number - a.week_number)
    return locked[0] ?? null
  }, [weeks, searchParams])

  // ?reset=1 — the Dashboard tile's "Edit picks" confirms up front that editing
  // resets the card (resubmitting re-locks every line to today's numbers, not what
  // was originally picked — cfb_submit_week_picks reads the current game row), then
  // lands here with this flag so the builder starts empty instead of pre-filled.
  // EXCEPT for a game that's already kicked off: the RPC's kickoff lock won't let a
  // resubmit drop that game's pick (only the exact on-file value carries forward), so
  // a full wipe would make it impossible to ever resubmit again once any game in the
  // week has started. Reset therefore only clears picks on games still open — a
  // started game's pick is carried forward pre-filled and locked (CfbGameCard already
  // disables it), same as the non-reset path.
  const resetRequested = searchParams.get('reset') === '1'

  // ── target-week slate + this user's existing card ───────────────────────────
  useEffect(() => {
    if (!targetWeek || !user?.id) return
    let active = true
    setGamesLoaded(false)
    setSearch('')
    setSelectedConferences(new Set())
    ;(async () => {
      const [g, picks] = await Promise.all([
        getCfbWeekGames(targetWeek.id),
        getCfbWeekPicks(poolId, targetWeek.id),
      ])
      if (!active) return
      setGames(g)

      const mine = picks.filter(pk => pk.user_id === user.id)
      setMyPicks(mine)
      setHasExistingCard(mine.length > 0)

      const gamesById = Object.fromEntries(g.map(gm => [gm.id, gm]))
      const carryForward = resetRequested
        ? mine.filter(pk => gameHasStarted(gamesById[pk.game_id]))
        : mine

      const ats = {}
      let dd = null
      let dog = null
      carryForward.forEach(pk => {
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
      setGamesLoaded(true)
    })().catch(err => { if (active) { setError(err.message); setGamesLoaded(true) } })
    return () => { active = false }
  }, [targetWeek, poolId, user?.id, resetRequested])

  // A double-down flagged on a game that's no longer an ATS pick (deselected, or its
  // team changed) is cleared automatically — keeps state consistent without every
  // handler having to know about every other slot.
  useEffect(() => {
    if (doubleDownGameId != null && atsPicks[doubleDownGameId] == null) {
      setDoubleDownGameId(null)
    }
  }, [atsPicks, doubleDownGameId])

  // Games whose kickoff has already passed — the client-side mirror of the RPC's
  // kickoff lock. Recomputed whenever the slate loads; a game crossing kickoff
  // mid-session just means the guard catches up on the next re-render (the RPC is
  // the real backstop either way).
  const startedGameIds = useMemo(
    () => new Set(games.filter(gameHasStarted).map(g => g.id)),
    [games],
  )

  const handlePickAts = useCallback((gameId, team) => {
    if (startedGameIds.has(gameId)) return // kicked off — frozen
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
  }, [underdogGameId, startedGameIds])

  const handleToggleDoubleDown = useCallback((gameId) => {
    if (startedGameIds.has(gameId)) return // kicked off — frozen
    if (atsPicks[gameId] == null) return // only legal on a current ATS pick
    setDoubleDownGameId(dd => (dd === gameId ? null : gameId))
  }, [atsPicks, startedGameIds])

  const handlePickUnderdog = useCallback((gameId) => {
    if (startedGameIds.has(gameId)) return // kicked off — frozen
    if (atsPicks[gameId] != null) return // mutual exclusion — this game is an ATS pick
    setUnderdogGameId(dog => (dog === gameId ? null : gameId))
  }, [atsPicks, startedGameIds])

  const validity = useMemo(
    () => cfbCardValidity({ atsPicks, doubleDownGameId, underdogGameId }),
    [atsPicks, doubleDownGameId, underdogGameId],
  )

  // Conferences in play this week, for the filter chips.
  const conferences = useMemo(() => conferencesInPlay(games), [games])

  function handleToggleConference(conf) {
    setSelectedConferences(prev => {
      if (conf === null) return new Set()
      const next = new Set(prev)
      if (next.has(conf)) next.delete(conf)
      else next.add(conf)
      return next
    })
  }

  // Search + conference filter + sort — view-only, applied on top of the full `games`
  // list. Shared with CfbSlate.jsx (src/utils/cfbGameFilters.js) so the two lists can't
  // drift out of sync.
  const visibleGames = useMemo(
    () => filterAndSortGames(games, { search, selectedConferences, sortBy }),
    [games, search, selectedConferences, sortBy],
  )

  // Once the target week is locked/graded the card is frozen — grade it with the shared
  // engine off each game's live/final score (same shape the pool-detail expand renders).
  const isLocked = weekIsLocked(targetWeek)
  const readonlyCard = useMemo(() => {
    if (!isLocked || !myPicks.length) return null
    const gamesById = Object.fromEntries(games.map(g => [g.id, g]))
    return shapeCard(myPicks, gamesById)
  }, [isLocked, myPicks, games])
  const isAutoFilled = !!readonlyCard?.picks.some(p => p.autoFilled)

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
            The season schedule isn't up yet — check back once Week 1 is posted.
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

  // ── locked / auto-filled / graded — the read-only frozen card ────────────────
  if (isLocked) {
    const weekName = targetWeek.label ?? `Week ${targetWeek.week_number}`
    const graded = targetWeek.status === 'graded'
    const lockedSubtitle = graded ? 'Final' : 'Locked'

    if (!readonlyCard) {
      // The week locked and this player never got a card in (and none was auto-filled).
      return (
        <Shell poolId={poolId} eyebrow={weekEyebrow} title="Your card" subtitle={lockedSubtitle}>
          <NoticeCard>
            <p className="text-[13px]" style={{ color: CFB_THEME.ink }}>
              {graded ? `${weekName} is final.` : `Picks are locked for ${weekName}.`} You didn't get a card in this week.
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

    const notice = isAutoFilled
      ? 'You missed the deadline — a random card was filled in. No double-down this week.'
      : graded
        ? `${weekName} is final.`
        : `Picks are locked for ${weekName}.`

    return (
      <Shell poolId={poolId} eyebrow={weekEyebrow} title="Your card" subtitle={lockedSubtitle}>
        <CfbCardReadonly
          card={readonlyCard}
          notice={notice}
          variant={isAutoFilled ? 'autofilled' : null}
          weekLabel={weekName}
        />
        <Link
          to={`/cfb/pool/${poolId}`}
          className="inline-block mt-4 text-[12.5px] font-semibold no-underline"
          style={{ color: CFB_THEME.accent }}
        >
          ← Back to the pool
        </Link>
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
    <div className="min-h-screen pb-[220px]" style={{ background: CFB_THEME.pageCard }}>
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
        <div className="flex justify-end mb-3">
          <CfbRulesButton />
        </div>

        {resetRequested ? (
          <p className="text-[12px] mb-3" style={{ color: CFB_THEME.muted2 }}>
            Your picks on games that haven't started were reset — build those against
            today's lines. Anything already underway stays locked in as you had it.
          </p>
        ) : hasExistingCard && (
          <p className="text-[12px] mb-3" style={{ color: CFB_THEME.muted2 }}>
            Your card's in — you can change it until it locks.
          </p>
        )}

        {submitError && (
          <p className="text-[12.5px] mb-3" style={{ color: CFB_THEME.warnInk }}>{submitError}</p>
        )}

        <CfbGameFilterBar
          search={search}
          onSearchChange={setSearch}
          conferences={conferences}
          selectedConferences={selectedConferences}
          onToggleConference={handleToggleConference}
          sortBy={sortBy}
          onSortChange={setSortBy}
        />

        {visibleGames.length === 0 ? (
          <p className="text-[13px] text-center py-8" style={{ color: CFB_THEME.muted }}>
            No games match your filters.
          </p>
        ) : (
          <div className="space-y-3">
            {visibleGames.map(game => (
              <CfbGameCard
                key={game.id}
                game={game}
                atsSelectedTeam={atsPicks[game.id] ?? null}
                isDoubleDown={doubleDownGameId === game.id}
                isUnderdogPick={underdogGameId === game.id}
                atsFull={Object.keys(atsPicks).length >= 5}
                dogFilled={underdogGameId != null}
                started={startedGameIds.has(game.id)}
                onPickAts={handlePickAts}
                onToggleDoubleDown={handleToggleDoubleDown}
                onPickUnderdog={handlePickUnderdog}
              />
            ))}
          </div>
        )}
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
