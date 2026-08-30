import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import PoolHeader from '../../components/pool/PoolHeader'
import StandingsCard from '../../components/pool/StandingsCard'
import WidgetGrid from '../../components/pool/WidgetGrid'
import CfbWeekSelector from '../../components/cfb/CfbWeekSelector'
import CfbStandings from '../../components/cfb/CfbStandings'
import CfbWidgets from '../../components/cfb/CfbWidgets'
import CfbRulesButton from '../../components/cfb/CfbRulesButton'
import {
  getCfbPool, getCfbPoolWeeks, getCfbStandings, getCfbParticipants,
  getCfbWeekGames, getCfbWeekPicks, weekIsLocked,
} from '../../lib/cfb'
import { shapeCard } from '../../utils/cfbCard'
import { CFB_THEME, cfbBadge } from '../../theme/cfb'

// CFB Pool Detail / Leaderboard (docs/CFB_UI_PLAN.md §6). The season-cumulative
// standings are the hero (ranked by season total from public.pool_standings). A week
// selector scopes the scorecard-expand + the widgets to a chosen week WITHOUT
// re-ranking the standings. Grading for the expand is recomputed client-side with the
// shared scoring engine off each game's live/final scores.

export default function CfbPoolDetail() {
  const { id: poolId } = useParams()
  const { user, profile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const [pool, setPool] = useState(null)
  const [weeks, setWeeks] = useState([])
  const [standings, setStandings] = useState([])
  const [participants, setParticipants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Selected-week slice (refetched when the week changes).
  const [weekGames, setWeekGames] = useState([])
  const [weekPicks, setWeekPicks] = useState([])

  const [copied, setCopied] = useState(false)

  // ── base load (pool + weeks + standings + participants) ─────────────────────
  useEffect(() => {
    let active = true
    ;(async () => {
      const p = await getCfbPool(poolId)
      if (!active) return
      if (!p) { setError('Pool not found.'); setLoading(false); return }
      const [wk, st, parts] = await Promise.all([
        getCfbPoolWeeks(p.event_id),
        getCfbStandings(poolId),
        getCfbParticipants(poolId),
      ])
      if (!active) return
      setPool(p); setWeeks(wk); setStandings(st); setParticipants(parts)
      setLoading(false)
    })().catch(err => { if (active) { setError(err.message); setLoading(false) } })
    return () => { active = false }
  }, [poolId])

  // Resolve the selected week: ?week=N if valid, else the first non-graded week,
  // else the last. Default-selects "the week in focus."
  const selectedWeek = useMemo(() => {
    if (!weeks.length) return null
    // A missing ?week param must NOT resolve to Week 0 — Number(null) is 0, so the
    // param's presence is checked separately from its value (Week 0 is a real week now
    // that pools can start there, e.g. the pre-Labor-Day TCU/UNC slate).
    const wantedRaw = searchParams.get('week')
    const wanted = wantedRaw != null ? Number(wantedRaw) : null
    const byNum = wanted != null ? weeks.find(w => w.week_number === wanted) : null
    if (byNum) return byNum
    return weeks.find(w => w.status !== 'graded') ?? weeks[weeks.length - 1]
  }, [weeks, searchParams])

  // ── selected-week slice ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedWeek) return
    let active = true
    ;(async () => {
      const [games, picks] = await Promise.all([
        getCfbWeekGames(selectedWeek.id),
        getCfbWeekPicks(poolId, selectedWeek.id),
      ])
      if (!active) return
      setWeekGames(games); setWeekPicks(picks)
    })().catch(() => { if (active) { setWeekGames([]); setWeekPicks([]) } })
    return () => { active = false }
  }, [selectedWeek, poolId])

  const selectWeek = useCallback((w) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.set('week', String(w.week_number))
      return next
    }, { replace: true })
  }, [setSearchParams])

  function copyJoinLink() {
    navigator.clipboard.writeText(`${window.location.origin}/join/${pool.join_code}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── derive the standings entries + widget inputs for the selected week ───────
  const derived = useMemo(() => {
    if (!selectedWeek) return null
    const gamesById = Object.fromEntries(weekGames.map(g => [g.id, g]))
    const locked = weekIsLocked(selectedWeek)

    const picksByUser = {}
    weekPicks.forEach(p => { (picksByUser[p.user_id] ??= []).push(p) })

    const standByUser = Object.fromEntries(standings.map(s => [s.user_id, s]))
    const nameByUser = Object.fromEntries(participants.map(p => [p.user_id, p.display_name]))
    const hasStandings = standings.length > 0

    const entries = participants.map(part => {
      const uid = part.user_id
      const s = standByUser[uid]
      const isMe = uid === user?.id
      const userPicks = picksByUser[uid] ?? []

      let week
      if (userPicks.length > 0) {
        const card = shapeCard(userPicks, gamesById)
        week = { state: 'card', total: card.total, picks: card.picks }
      } else if (isMe || locked) {
        week = { state: 'nocard', total: 0, picks: [] }
      } else {
        week = { state: 'hidden', total: 0, picks: [] }
      }

      return {
        user_id: uid,
        display_name: part.display_name,
        rank: s?.rank ?? null,
        total: Number(s?.total ?? 0),
        week,
      }
    })

    entries.sort((a, b) => b.total - a.total || a.display_name.localeCompare(b.display_name))

    // Widget inputs from the visible cards only (others hidden pre-lock).
    const flatPicks = []
    const weeklyPoints = []
    entries.forEach(e => {
      if (e.week.state === 'card') {
        weeklyPoints.push({ user_id: e.user_id, name: e.display_name, points: e.week.total })
        e.week.picks.forEach(p => flatPicks.push({
          user_id: e.user_id,
          name: nameByUser[e.user_id],
          pickType: p.pickType,
          selectedTeam: p.selectedTeam,
          lockedSpread: p.lockedSpread,
          result: p.result,
          points: p.points,
        }))
      }
    })

    const myWeek = entries.find(e => e.user_id === user?.id)?.week ?? null

    return { entries, flatPicks, weeklyPoints, hasStandings, locked, myWeek }
  }, [selectedWeek, weekGames, weekPicks, standings, participants, user?.id])

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

  const isAdmin = profile?.role === 'admin'
  const weekLabel = selectedWeek?.label ?? 'Week'
  const anyLive = weekGames.some(g => g.status === 'in_progress')
  const statusWord = anyLive ? 'Live'
    : selectedWeek?.status === 'graded' ? 'Final'
    : derived?.locked ? 'Locked' : 'Open'
  const roundBadge = selectedWeek ? `${weekLabel} · ${statusWord}` : null
  const preSeason = derived && !derived.hasStandings

  return (
    <div className="min-h-screen pb-8" style={{ background: CFB_THEME.pageCard }}>
      <PoolHeader
        backTo="/dashboard"
        badgeConfig={cfbBadge(pool.season_year)}
        subLabel={`${pool.season_year} · College Football`}
        heroName={pool.name}
        metaParts={[participants.length ? `${participants.length} players` : null].filter(Boolean)}
        roundBadge={roundBadge}
        gradient={CFB_THEME.headerGradient}
        accentColor={CFB_THEME.accent}
        rib={CFB_THEME.rib}
        action={isAdmin && (
          <button
            onClick={copyJoinLink}
            className="text-[13px] font-semibold px-[14px] py-2 rounded-[10px] cursor-pointer"
            style={{ background: 'rgba(214,41,27,.16)', border: '1px solid rgba(214,41,27,.5)', color: '#F1B3AA' }}
          >
            {copied ? 'Copied!' : 'Share invite'}
          </button>
        )}
      >
        <CfbWeekSelector
          weeks={weeks}
          selectedNumber={selectedWeek?.week_number}
          onSelect={selectWeek}
        />
        {anyLive && (
          <div className="px-5 pt-[10px]">
            <span className="inline-flex items-center gap-[7px] text-[12px]" style={{ color: 'rgba(248,245,238,.7)' }}>
              <span className="w-[7px] h-[7px] rounded-full" style={{ background: CFB_THEME.accent }} />
              Live — scores update as games go final.
            </span>
          </div>
        )}
      </PoolHeader>

      <div className="max-w-[560px] mx-auto px-[18px] pt-[22px]">
        {selectedWeek && derived && !preSeason && (
          <div
            className="flex items-center justify-between rounded-[12px] px-4 py-[13px] mb-[14px]"
            style={{ background: CFB_THEME.cardWhite, border: `1px solid ${CFB_THEME.border}` }}
          >
            <div className="flex items-center gap-[9px]">
              {derived.myWeek?.state === 'card' ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={CFB_THEME.positive} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <span className="w-[7px] h-[7px] rounded-full" style={{ background: CFB_THEME.accent }} />
              )}
              <span className="text-[13px]" style={{ color: CFB_THEME.ink }}>
                {derived.myWeek?.state === 'card'
                  ? derived.locked ? 'Your picks are locked in.' : `Your card is in for ${weekLabel}.`
                  : derived.locked ? 'Picks are locked for this week.' : `You haven't made your picks for ${weekLabel} yet.`}
              </span>
            </div>
            {!derived.locked && (
              <Link
                to={`/cfb/pool/${poolId}/picks?week=${selectedWeek.week_number}`}
                className="text-[12.5px] font-semibold no-underline"
                style={{ color: CFB_THEME.accent }}
              >
                {derived.myWeek?.state === 'card' ? 'Edit picks →' : 'Make picks →'}
              </Link>
            )}
          </div>
        )}

        <StandingsCard label="Season Standings" action={<CfbRulesButton />}>
          {!participants.length || !derived ? (
            <div className="p-12 text-center">
              <p className="text-[13px]" style={{ color: CFB_THEME.muted }}>
                {participants.length ? 'Weeks for this season haven’t been set up yet.' : 'No players have joined yet.'}
              </p>
            </div>
          ) : (
            <>
              {preSeason && (
                <div className="px-[18px] pt-[14px] pb-[2px]">
                  <p className="text-[12px]" style={{ color: CFB_THEME.muted }}>
                    Season kicks off {weeks[0]?.label ?? 'Week 1'} — standings fill in as weeks are graded.
                  </p>
                </div>
              )}
              <CfbStandings
                entries={derived.entries}
                currentUserId={user?.id}
                weekLabel={weekLabel}
              />
            </>
          )}
        </StandingsCard>

        {selectedWeek && (
          <Link
            to={`/cfb/pool/${poolId}/slate?week=${selectedWeek.week_number}`}
            className="flex items-center justify-between no-underline rounded-[12px] px-4 py-[13px] mb-[14px]"
            style={{ background: CFB_THEME.cardWhite, border: `1px solid ${CFB_THEME.border}` }}
          >
            <span className="font-display font-bold text-[13px]" style={{ color: CFB_THEME.ink }}>
              This week&apos;s slate
            </span>
            <span className="text-[12.5px] font-semibold" style={{ color: CFB_THEME.accent }}>
              See all games →
            </span>
          </Link>
        )}

        <WidgetGrid>
          <CfbWidgets
            weekPicks={derived?.flatPicks ?? []}
            weeklyPoints={derived?.weeklyPoints ?? []}
            weekLabel={weekLabel}
            locked={derived?.locked ?? false}
            stakeAmount={pool.stake_amount}
            participantCount={participants.length}
            payoutStructure={pool.payout_structure}
          />
        </WidgetGrid>
      </div>
    </div>
  )
}
