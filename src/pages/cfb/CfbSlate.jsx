import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import PicksHeader from '../../components/pool/PicksHeader'
import CfbWeekSelector from '../../components/cfb/CfbWeekSelector'
import CfbGameFilterBar from '../../components/cfb/CfbGameFilterBar'
import { getCfbPool, getCfbPoolWeeks, getCfbWeekGames } from '../../lib/cfb'
import { conferencesInPlay, filterAndSortGames } from '../../utils/cfbGameFilters'
import { favoriteLine, formatKickWithDate } from '../../utils/cfbFormat'
import { CFB_THEME } from '../../theme/cfb'

// Read-only "this week's slate" page — every game, its line, and its live/final score,
// with the same search/conference/sort controls as the picks builder (src/utils/
// cfbGameFilters.js). Split out from the pool-detail page's widget row (which used to
// carry the full game list and dominated the page) so pool-detail stays the compact
// standings-first surface; this is the place to browse "where all the games are
// sitting." No pick state at all — pure viewing.

function SlateRow({ game }) {
  const fav = favoriteLine(game)
  const live = game.status === 'in_progress'
  const done = game.status === 'final'
  const hasScore = game.away_score != null && game.home_score != null

  return (
    <div className="rounded-[14px] p-4" style={{ background: CFB_THEME.cardWhite, border: `1px solid ${CFB_THEME.border}` }}>
      <div className="flex items-center justify-between text-[11px] mb-[8px]" style={{ color: CFB_THEME.muted }}>
        <span>
          {game.away_conference && game.home_conference
            ? `${game.away_conference} @ ${game.home_conference}`
            : ''}
        </span>
        <span className="tabular-nums">{formatKickWithDate(game.kickoff_at)}</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="font-semibold text-[14px] truncate" style={{ color: CFB_THEME.ink }}>
          {game.away_team} @ {game.home_team}
        </span>
        <div className="flex items-center gap-[8px] flex-none">
          {live && (
            <span className="font-display font-bold text-[9px] uppercase px-[6px] py-[2px] rounded" style={{ background: CFB_THEME.accent, color: CFB_THEME.cream }}>
              Live
            </span>
          )}
          {hasScore && (live || done) ? (
            <span className="font-display font-bold tabular-nums text-[14px]" style={{ color: CFB_THEME.ink }}>
              {game.away_score}–{game.home_score}
            </span>
          ) : (
            <span className="font-display font-bold tabular-nums text-[13px]" style={{ color: CFB_THEME.muted2 }}>
              {fav.team} {fav.line}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export default function CfbSlate() {
  const { id: poolId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()

  const [pool, setPool] = useState(null)
  const [weeks, setWeeks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [games, setGames] = useState([])
  const [gamesLoaded, setGamesLoaded] = useState(false)

  const [search, setSearch] = useState('')
  const [selectedConferences, setSelectedConferences] = useState(new Set())
  const [sortBy, setSortBy] = useState('kickoff')

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

  // ?week=N if valid, else the first non-graded week, else the last — same resolution
  // order as CfbPoolDetail's selectedWeek.
  const selectedWeek = useMemo(() => {
    if (!weeks.length) return null
    // A missing ?week param must NOT resolve to Week 0 — see CfbPoolDetail's
    // selectedWeek for why (Week 0 is a real, selectable week now).
    const wantedRaw = searchParams.get('week')
    const wanted = wantedRaw != null ? Number(wantedRaw) : null
    const byNum = wanted != null ? weeks.find(w => w.week_number === wanted) : null
    if (byNum) return byNum
    return weeks.find(w => w.status !== 'graded') ?? weeks[weeks.length - 1]
  }, [weeks, searchParams])

  useEffect(() => {
    if (!selectedWeek) return
    let active = true
    setGamesLoaded(false)
    setSearch('')
    setSelectedConferences(new Set())
    ;(async () => {
      const g = await getCfbWeekGames(selectedWeek.id)
      if (!active) return
      setGames(g)
      setGamesLoaded(true)
    })().catch(() => { if (active) { setGames([]); setGamesLoaded(true) } })
    return () => { active = false }
  }, [selectedWeek])

  const selectWeek = useCallback((w) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.set('week', String(w.week_number))
      return next
    }, { replace: true })
  }, [setSearchParams])

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

  const visibleGames = useMemo(
    () => filterAndSortGames(games, { search, selectedConferences, sortBy }),
    [games, search, selectedConferences, sortBy],
  )

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

  const weekLabel = selectedWeek?.label ?? 'Week'

  return (
    <div className="min-h-screen pb-8" style={{ background: CFB_THEME.pageCard }}>
      <PicksHeader
        backTo={`/cfb/pool/${poolId}`}
        backLabel="← Pool"
        eyebrow={pool.season_year ? `${pool.season_year} CFB` : 'College Football'}
        title="This Week's Slate"
        subtitle={pool.name}
        gradient={CFB_THEME.headerGradient}
        accentColor={CFB_THEME.accent}
        rib={CFB_THEME.rib}
        showBadge={false}
      >
        <CfbWeekSelector
          weeks={weeks}
          selectedNumber={selectedWeek?.week_number}
          onSelect={selectWeek}
        />
      </PicksHeader>

      <div className="max-w-[560px] mx-auto px-4 pt-6">
        {!weeks.length ? (
          <p className="text-[13px]" style={{ color: CFB_THEME.muted }}>
            The season schedule isn't up yet — check back once Week 1 is posted.
          </p>
        ) : !gamesLoaded ? (
          <p className="text-[13px]" style={{ color: CFB_THEME.muted }}>Loading…</p>
        ) : !games.length ? (
          <p className="text-[13px]" style={{ color: CFB_THEME.muted }}>
            Lines for {weekLabel} post soon.
          </p>
        ) : (
          <>
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
                {visibleGames.map(g => <SlateRow key={g.id} game={g} />)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
