import { createContext, useContext, useState } from 'react'
import { demoTiers } from './demoData'

// Holds the demo visitor's in-progress picks across /demo navigation. No backend.
const DemoCtx = createContext(null)

export function DemoProvider({ children }) {
  const [selections, setSelections] = useState({}) // tier.id -> { player_id, player_name }
  const [submitted, setSubmitted] = useState(false)

  function selectPlayer(tierId, player) {
    setSelections(prev => ({
      ...prev,
      [tierId]: { player_id: player.player_id, player_name: player.player_name },
    }))
  }
  function submit() { setSubmitted(true) }
  function reset() { setSelections({}); setSubmitted(false) }

  // Once submitted, shape the visitor's picks like real pick rows so computeScores
  // can rank "You" alongside the fabricated participants.
  const myPickRows = submitted
    ? demoTiers.map(t => ({
        user_id: 'demo-you',
        player_id: selections[t.id].player_id,
        player_name: selections[t.id].player_name,
        status: 'confirmed',
        profiles: { display_name: 'You' },
        tiers: { tier_number: t.tier_number, label: t.label },
      }))
    : []

  return (
    <DemoCtx.Provider value={{ selections, selectPlayer, submitted, submit, reset, myPickRows }}>
      {children}
    </DemoCtx.Provider>
  )
}

export function useDemo() {
  return useContext(DemoCtx)
}
