import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useDemoCfb } from './DemoCfbContext'
import {
  demoCfbPool, demoCfbWeeks, demoCfbParticipants, demoCfbSeasonStandings,
  demoCfbWeek1Games, demoCfbWeek1Picks, demoCfbWeek2Games,
} from './demoCfbData'
import { weekIsLocked } from '../lib/cfb'
import { shapeCard } from '../utils/cfbCard'
import PoolHeader from '../components/pool/PoolHeader'
import StandingsCard from '../components/pool/StandingsCard'
import WidgetGrid from '../components/pool/WidgetGrid'
import CfbWeekSelector from '../components/cfb/CfbWeekSelector'
import CfbStandings from '../components/cfb/CfbStandings'
import CfbWidgets from '../components/cfb/CfbWidgets'
import CfbRulesButton from '../components/cfb/CfbRulesButton'
import { CFB_THEME, cfbBadge } from '../theme/cfb'

const CURRENT_USER_ID = 'demo-cfb-you'

const GAMES_BY_WEEK = {
  1: demoCfbWeek1Games,
  2: demoCfbWeek2Games,
}

export default function DemoCfbPoolDetail() {
  const { submitted, myWeek2Picks } = useDemoCfb()
  const [searchParams, setSearchParams] = useSearchParams()

  const selectedWeek = useMemo(() => {
    const wanted = Number(searchParams.get('week'))
    const byNum = demoCfbWeeks.find(w => w.week_number === wanted)
    if (byNum) return byNum
    return demoCfbWeeks.find(w => w.status !== 'graded') ?? demoCfbWeeks[demoCfbWeeks.length - 1]
  }, [searchParams])

  function selectWeek(w) {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.set('week', String(w.week_number))
      return next
    }, { replace: true })
  }

  const weekGames = GAMES_BY_WEEK[selectedWeek.week_number] ?? []
  // Others' Week 2 picks stay unseen pre-lock — same as real RLS. Week 1 is graded,
  // so everyone's card is visible; Week 2 only shows the visitor's own, once submitted.
  const weekPicks = selectedWeek.week_number === 1
    ? demoCfbWeek1Picks
    : (submitted ? myWeek2Picks : [])

  const derived = useMemo(() => {
    const gamesById = Object.fromEntries(weekGames.map(g => [g.id, g]))
    const locked = weekIsLocked(selectedWeek)

    const picksByUser = {}
    weekPicks.forEach(p => { (picksByUser[p.user_id] ??= []).push(p) })

    const standByUser = Object.fromEntries(demoCfbSeasonStandings.map(s => [s.user_id, s]))

    const entries = demoCfbParticipants.map(part => {
      const uid = part.user_id
      const s = standByUser[uid]
      const isMe = uid === CURRENT_USER_ID
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

    const flatPicks = []
    const weeklyPoints = []
    entries.forEach(e => {
      if (e.week.state === 'card') {
        weeklyPoints.push({ user_id: e.user_id, name: e.display_name, points: e.week.total })
        e.week.picks.forEach(p => flatPicks.push({
          user_id: e.user_id,
          name: e.display_name,
          pickType: p.pickType,
          selectedTeam: p.selectedTeam,
          lockedSpread: p.lockedSpread,
          result: p.result,
          points: p.points,
        }))
      }
    })

    return { entries, flatPicks, weeklyPoints, locked }
  }, [selectedWeek, weekGames, weekPicks])

  const weekLabel = selectedWeek.label
  const statusWord = selectedWeek.status === 'graded' ? 'Final' : derived.locked ? 'Locked' : 'Open'
  const roundBadge = `${weekLabel} · ${statusWord}`
  const week2Submitted = submitted

  return (
    <div className="min-h-screen pb-8" style={{ background: CFB_THEME.pageCard }}>
      <PoolHeader
        backTo="/demo"
        backLabel="← Demo"
        badgeConfig={cfbBadge(demoCfbPool.season_year)}
        subLabel={`${demoCfbPool.season_year} · College Football`}
        heroName={demoCfbPool.name}
        metaParts={[`${demoCfbParticipants.length} players`]}
        roundBadge={roundBadge}
        gradient={CFB_THEME.headerGradient}
        accentColor={CFB_THEME.accent}
        rib={CFB_THEME.rib}
      >
        <CfbWeekSelector
          weeks={demoCfbWeeks}
          selectedNumber={selectedWeek.week_number}
          onSelect={selectWeek}
        />
      </PoolHeader>

      <div className="max-w-[560px] mx-auto px-[18px] pt-[22px]">

        {/* Week 2 action banner */}
        <div
          className="rounded-[12px] px-[14px] py-[11px] flex items-center justify-between mb-[18px]"
          style={{ background: CFB_THEME.cardWhite, border: `1px solid ${CFB_THEME.border}` }}
        >
          <span className="text-[13px]" style={{ color: CFB_THEME.ink }}>
            {week2Submitted
              ? 'Your Week 2 card is in.'
              : 'Week 2 picks aren’t in yet — build your card.'}
          </span>
          <Link
            to="/demo/cfb/picks"
            className="text-[12.5px] font-semibold no-underline"
            style={{ color: CFB_THEME.accent }}
          >
            {week2Submitted ? 'Edit picks →' : 'Make picks →'}
          </Link>
        </div>

        <StandingsCard label="Season Standings" action={<CfbRulesButton />}>
          <CfbStandings
            entries={derived.entries}
            currentUserId={CURRENT_USER_ID}
            weekLabel={weekLabel}
          />
        </StandingsCard>

        <WidgetGrid>
          <CfbWidgets
            weekPicks={derived.flatPicks}
            weeklyPoints={derived.weeklyPoints}
            weekLabel={weekLabel}
            locked={derived.locked}
            stakeAmount={demoCfbPool.stake_amount}
            participantCount={demoCfbParticipants.length}
            payoutStructure={demoCfbPool.payout_structure}
          />
        </WidgetGrid>
      </div>
    </div>
  )
}
