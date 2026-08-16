import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDemoCfb } from './DemoCfbContext'
import { demoCfbWeeks, demoCfbWeek2Games } from './demoCfbData'
import { cfbCardValidity } from '../utils/cfbCard'
import { conferencesInPlay, filterAndSortGames } from '../utils/cfbGameFilters'
import { formatLockLabel } from '../utils/cfbFormat'
import PicksHeader from '../components/pool/PicksHeader'
import CfbGameCard from '../components/cfb/CfbGameCard'
import CfbGameFilterBar from '../components/cfb/CfbGameFilterBar'
import CfbCardTracker from '../components/cfb/CfbCardTracker'
import CfbRulesButton from '../components/cfb/CfbRulesButton'
import { CFB_THEME } from '../theme/cfb'

const week2 = demoCfbWeeks[1]
const gamesById = Object.fromEntries(demoCfbWeek2Games.map(g => [g.id, g]))

export default function DemoCfbPicks() {
  const navigate = useNavigate()
  const {
    atsPicks, doubleDownGameId, underdogGameId,
    pickAts, toggleDoubleDown, pickUnderdog,
    submitted, submit,
  } = useDemoCfb()

  const [search, setSearch] = useState('')
  const [selectedConferences, setSelectedConferences] = useState(new Set())
  const [sortBy, setSortBy] = useState('kickoff')

  const validity = useMemo(
    () => cfbCardValidity({ atsPicks, doubleDownGameId, underdogGameId }),
    [atsPicks, doubleDownGameId, underdogGameId],
  )

  const conferences = useMemo(() => conferencesInPlay(demoCfbWeek2Games), [])

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
    () => filterAndSortGames(demoCfbWeek2Games, { search, selectedConferences, sortBy }),
    [search, selectedConferences, sortBy],
  )

  function handleSubmit() {
    if (!validity.valid) return
    submit(gamesById)
    navigate('/demo/cfb?week=2')
  }

  const subtitle = week2.lock_time ? `Locks ${formatLockLabel(week2.lock_time)}` : null

  return (
    <div className="min-h-screen pb-[220px]" style={{ background: CFB_THEME.pageCard }}>
      <PicksHeader
        backTo="/demo/cfb"
        backLabel="← Pool"
        eyebrow="WEEK 2"
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

        {submitted && (
          <p className="text-[12px] mb-3" style={{ color: CFB_THEME.muted2 }}>
            Your card's in — you can change it anytime.
          </p>
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
                onPickAts={pickAts}
                onToggleDoubleDown={toggleDoubleDown}
                onPickUnderdog={pickUnderdog}
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
        hasExistingCard={submitted}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
