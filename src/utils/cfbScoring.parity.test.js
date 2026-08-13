// Drift guard between the two copies of the CFB scoring engine:
//   • src/utils/cfbScoring.js                      — browser / source of truth
//   • supabase/functions/_shared/cfbScoring.ts     — server-side mirror (Deno can't
//                                                    import src/, so it's copied)
// The authoritative grader (grade-cfb-week) runs the TS copy and awards the real
// points, but only the JS copy is unit-tested directly. This test runs the SHARED
// fixtures against BOTH and asserts (a) each matches the expected value and (b) the
// two produce identical output for every case. If someone edits one file's logic and
// not the other, this goes red. (Founder decision, agents/pm/DECISIONS.md 2026-08-12,
// Q1 — chosen over a "keep in sync" comment.)
//
// vitest transforms the .ts mirror via esbuild; it's pure arithmetic with no Deno
// imports, so it loads in the node test environment exactly like the JS module.

import { describe, it, expect } from 'vitest'
import * as js from './cfbScoring'
import * as ts from '../../supabase/functions/_shared/cfbScoring.ts'
import { FIXTURES } from './cfbScoring.fixtures'

describe('JS engine ↔ TS mirror parity', () => {
  it('exports the same set of functions', () => {
    expect(Object.keys(ts).sort()).toEqual(Object.keys(js).sort())
  })

  for (const [fn, cases] of Object.entries(FIXTURES)) {
    for (const c of cases) {
      it(`${fn}: ${c.label} — JS and TS both match expected`, () => {
        const jsOut = js[fn](...c.args)
        const tsOut = ts[fn](...c.args)
        expect(jsOut).toEqual(c.expected) // JS is correct
        expect(tsOut).toEqual(c.expected) // TS is correct
        expect(tsOut).toEqual(jsOut)      // …and identical to each other
      })
    }
  }
})
