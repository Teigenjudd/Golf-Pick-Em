import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import PoolHeader from '../../components/pool/PoolHeader'
import StandingsCard from '../../components/pool/StandingsCard'
import WidgetGrid from '../../components/pool/WidgetGrid'
import CfbWeekSelector from '../../components/cfb/CfbWeekSelector'
import CfbStandings from '../../components/cfb/CfbStandings'
import CfbWidgets from '../../components/cfb/CfbWidgets'
import {
  getCfbPool, getCfbPoolWeeks, getCfbStandings, getCfbParticipants,
  getCfbWeekGames, getCfbWeekPicks,
} from '../../lib/cfb'
import { gradeWeekCard, pickMargin } from '../../utils/cfbScoring'
import { pickLine } from '../../utils/cfbFormat'
import { CFB_THEME, cfbBadge } from '../../theme/cfb'

// CFB Pool Detail / Leaderboard (docs/CFB_UI_PLAN.md §6). The season-cumulative
// standings are the hero (ranked by season total from public.pool_standings). A week
// selector scopes the scorecard-expand + the widgets to a chosen week WITHOUT
// re-ranking the standings. Grading for the expand is recomputed client-side with the
// shared scoring engine off each game's live/final scores.

function weekIsLocked(w) {
  if (!w) return false
  if (w.status === 'locked' || w.status === 'graded') return true
  return !!(w.lock_time && new Date(w.lock_time) <= new Date())
}

// Build one user's selected-week card into a display-ready shape for CfbStandings.
function shapeCard(userPicks, gamesById) {
  const enriched = userPicks.map(p => {
    const g = gamesById[p.game_id] ?? {}
    // Only FINAL games award points. An in-progress game has a live score (shown in
    // the game line) but stays ungraded — matches the server grader and keeps points
    // from flip-flopping mid-game (docs/CFB_UI_PLAN.md §6: "points update as games
    // go final").
    const margin = g.status === 'final'
      ? pickMargin({
          selectedTeam: p.selected_team,
          homeTeam: g.home_team, awayTeam: g.away_team,
          homeScore: g.home_score, awayScore: g.away_score,
        })
      : null
    return { ...p, margin, game: g }
  })

  const graded = gradeWeekCard(enriched)
  const ats = graded.picks
    .filter(p => p.pick_type === 'ats')
    .sort((a, b) => new Date(a.game.kickoff_at ?? 0) - new Date(b.game.kickoff_at ?? 0))
  const dogs = graded.picks.filter(p => p.pick_type === 'underdog')

  const displayPicks = [...ats, ...dogs].map(p => {
    const g = p.game ?? {}
    return {
      slot: p.pick_type === 'underdog' ? null : ats.indexOf(p) + 1,
      pickType: p.pick_type,
      isDoubleDown: p.is_double_down,
      autoFilled: p.auto_filled,
      line: pickLine(p.selected_team, p.locked_spread),
      matchup: `${g.away_team ?? '?'} @ ${g.home_team ?? '?'}`,
      awayTeam: g.away_team, homeTeam: g.home_team,
      awayScore: g.away_score, homeScore: g.home_score,
      status: g.status, live: g.live, kickoffAt: g.kickoff_at,
      result: p.result,
      points: (p.base_points ?? 0) + (p.bonus_points ?? 0),
      selectedTeam: p.selected_team,
      lockedSpread: p.locked_spread,
    }
  })

  return { total: graded.total, picks: displayPicks }
}

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
    const wanted = Number(searchParams.get('week'))
    const byNum = weeks.find(w => w.week_number === wanted)
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

    return { entries, flatPicks, weeklyPoints, hasStandings, locked }
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
        <StandingsCard label="Season Standings">
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

        <WidgetGrid>
          <CfbWidgets
            games={weekGames}
            weekPicks={derived?.flatPicks ?? []}
            weeklyPoints={derived?.weeklyPoints ?? []}
            weekLabel={weekLabel}
            stakeAmount={pool.stake_amount}
            participantCount={participants.length}
            payoutStructure={pool.payout_structure}
          />
        </WidgetGrid>
      </div>
    </div>
  )
}
