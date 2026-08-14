import { describe, it, expect } from 'vitest'
import { cfbCardValidity, buildPicksPayload } from './cfbCard'

const G1 = 'g1', G2 = 'g2', G3 = 'g3', G4 = 'g4', G5 = 'g5', G6 = 'g6'

function fullAts() {
  return { [G1]: 'A1', [G2]: 'A2', [G3]: 'A3', [G4]: 'A4', [G5]: 'A5' }
}

describe('cfbCardValidity', () => {
  it('is valid for a complete 5 ATS + 1 underdog card, no double-down', () => {
    const v = cfbCardValidity({ atsPicks: fullAts(), doubleDownGameId: null, underdogGameId: G6 })
    expect(v).toEqual({ atsCount: 5, ddCount: 0, dogCount: 1, distinctCount: 6, valid: true, warning: null })
  })

  it('is valid with a double-down flagged on one of the 5 ATS games', () => {
    const v = cfbCardValidity({ atsPicks: fullAts(), doubleDownGameId: G3, underdogGameId: G6 })
    expect(v.valid).toBe(true)
    expect(v.ddCount).toBe(1)
    expect(v.warning).toBeNull()
  })

  it('is invalid with too few ATS picks', () => {
    const atsPicks = { [G1]: 'A1', [G2]: 'A2' }
    const v = cfbCardValidity({ atsPicks, doubleDownGameId: null, underdogGameId: G6 })
    expect(v.atsCount).toBe(2)
    expect(v.valid).toBe(false)
    expect(v.warning).toBeNull() // incomplete, not an active rule violation
  })

  it('is invalid with too many ATS picks and warns', () => {
    const atsPicks = { ...fullAts(), [G6]: 'A6' } // 6 ATS entries
    const v = cfbCardValidity({ atsPicks, doubleDownGameId: null, underdogGameId: null })
    expect(v.atsCount).toBe(6)
    expect(v.valid).toBe(false)
    expect(v.warning).toBe('Only 5 ATS picks allowed.')
  })

  it('is invalid with a missing underdog pick', () => {
    const v = cfbCardValidity({ atsPicks: fullAts(), doubleDownGameId: null, underdogGameId: null })
    expect(v.dogCount).toBe(0)
    expect(v.valid).toBe(false)
    expect(v.warning).toBeNull()
  })

  it('warns when the double-down is flagged on a game that is not an ATS pick', () => {
    const v = cfbCardValidity({ atsPicks: fullAts(), doubleDownGameId: G6, underdogGameId: G6 })
    // G6 is the underdog game here, not one of the 5 ATS games, so the DD is off-card.
    expect(v.valid).toBe(false)
    expect(v.warning).toBe('Double-down must be one of your 5 ATS picks.')
  })

  it('warns on the same game used as both an ATS pick and the underdog', () => {
    const atsPicks = fullAts() // G1..G5
    const v = cfbCardValidity({ atsPicks, doubleDownGameId: null, underdogGameId: G3 })
    expect(v.distinctCount).toBe(5) // G3 collides with an ATS game, so only 5 distinct ids
    expect(v.valid).toBe(false)
    expect(v.warning).toBe("That game can't be both an ATS pick and your underdog.")
  })
})

describe('buildPicksPayload', () => {
  const gamesById = {
    [G1]: { underdog_team: 'Dog1' },
    [G6]: { underdog_team: 'Vanderbilt' },
  }

  it('builds 6 rows: 5 ATS (is_double_down on the flagged one) + 1 underdog', () => {
    const payload = buildPicksPayload(
      { atsPicks: fullAts(), doubleDownGameId: G2, underdogGameId: G6 },
      gamesById,
    )
    expect(payload).toHaveLength(6)

    const ats = payload.filter(p => p.pick_type === 'ats')
    expect(ats).toHaveLength(5)
    ats.forEach(p => {
      expect(p.is_double_down).toBe(p.game_id === G2)
    })
    expect(ats.find(p => p.game_id === G1).selected_team).toBe('A1')

    const dog = payload.find(p => p.pick_type === 'underdog')
    expect(dog).toEqual({
      game_id: G6,
      pick_type: 'underdog',
      selected_team: 'Vanderbilt',
      is_double_down: false,
    })
  })

  it('has no double-down flagged when doubleDownGameId is null', () => {
    const payload = buildPicksPayload(
      { atsPicks: fullAts(), doubleDownGameId: null, underdogGameId: G6 },
      gamesById,
    )
    expect(payload.every(p => p.is_double_down === false)).toBe(true)
  })
})
