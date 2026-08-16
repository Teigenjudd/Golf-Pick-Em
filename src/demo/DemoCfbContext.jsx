import { createContext, useContext, useEffect, useState } from 'react'
import { buildPicksPayload } from '../utils/cfbCard'

// Holds the demo visitor's in-progress Week 2 card across /demo/cfb navigation. No
// backend — mirrors DemoContext (golf) but for the CFB card-builder shape (ATS picks,
// one double-down flag, one underdog pick).
const DemoCfbCtx = createContext(null)

export function DemoCfbProvider({ children }) {
  const [atsPicks, setAtsPicks] = useState({})
  const [doubleDownGameId, setDoubleDownGameId] = useState(null)
  const [underdogGameId, setUnderdogGameId] = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const [myWeek2Picks, setMyWeek2Picks] = useState([])

  // A double-down flagged on a game that's no longer an ATS pick is cleared
  // automatically, same as the real picks page.
  useEffect(() => {
    if (doubleDownGameId != null && atsPicks[doubleDownGameId] == null) {
      setDoubleDownGameId(null)
    }
  }, [atsPicks, doubleDownGameId])

  function pickAts(gameId, team) {
    if (underdogGameId === gameId) return
    setAtsPicks(prev => {
      const already = prev[gameId]
      if (already === team) {
        const next = { ...prev }
        delete next[gameId]
        return next
      }
      if (already == null && Object.keys(prev).length >= 5) return prev
      return { ...prev, [gameId]: team }
    })
  }

  function toggleDoubleDown(gameId) {
    if (atsPicks[gameId] == null) return
    setDoubleDownGameId(dd => (dd === gameId ? null : gameId))
  }

  function pickUnderdog(gameId) {
    if (atsPicks[gameId] != null) return
    setUnderdogGameId(dog => (dog === gameId ? null : gameId))
  }

  // gamesById must cover every game referenced by the card — builds the same row
  // shape the real submit RPC would freeze (locked_spread computed at submit time).
  function submit(gamesById) {
    const payload = buildPicksPayload({ atsPicks, doubleDownGameId, underdogGameId }, gamesById)
    const rows = payload.map(row => {
      const g = gamesById[row.game_id]
      const locked_spread = row.pick_type === 'underdog'
        ? g.underdog_spread
        : (row.selected_team === g.home_team ? g.home_spread : -g.home_spread)
      return {
        id: `demo-cfb-you-${row.game_id}-${row.pick_type}`,
        user_id: 'demo-cfb-you',
        game_id: row.game_id,
        pick_type: row.pick_type,
        selected_team: row.selected_team,
        is_double_down: row.is_double_down,
        locked_spread,
        auto_filled: false,
      }
    })
    setMyWeek2Picks(rows)
    setSubmitted(true)
  }

  return (
    <DemoCfbCtx.Provider value={{
      atsPicks, doubleDownGameId, underdogGameId,
      pickAts, toggleDoubleDown, pickUnderdog,
      submitted, myWeek2Picks, submit,
    }}>
      {children}
    </DemoCfbCtx.Provider>
  )
}

export function useDemoCfb() {
  return useContext(DemoCfbCtx)
}
