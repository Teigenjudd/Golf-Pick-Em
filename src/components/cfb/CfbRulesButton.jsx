import { useState } from 'react'
import { CFB_THEME } from '../../theme/cfb'
import { effectiveDoubleDownLine } from '../../utils/cfbScoring'
import { formatSpread } from '../../utils/cfbFormat'

// Same math the real double-down chip uses (CfbCardRows) — a -7 favorite's buffer is
// 4, so its effective line is -11. Computed, not hardcoded, so the example can't drift
// from the real scoring engine if the buffer formula ever changes.
const DD_BASE_SPREAD = -7
const DD_EFFECTIVE_SPREAD = effectiveDoubleDownLine(DD_BASE_SPREAD)

// Self-contained "How scoring works" trigger + modal — a plain-language explainer
// for CFB's weekly card, since it's the one Poold format that isn't obvious at a
// glance (golf's "pick one per tier" doesn't need this). Fully hidden until clicked;
// owns its own open state so a page just drops this in with no wiring. Shared by
// both the live CFB pages and the /demo/cfb pages so the copy can't drift.
//
// Each rule keeps the plain-English sentence short and puts the worked-out numbers
// in a separate visual "example" chip below it — same result-pill/points language as
// the real scorecard (CfbCardRows) so it reads as part of the app, not a wall of text.
const RULES = [
  {
    title: '5 picks against the spread',
    body: 'Pick the team you think covers, on 5 different games.',
    example: { line: 'Ohio State −7', context: 'Wins by 10', result: 'Cover', points: '+1' },
  },
  {
    title: 'One double-down',
    body: 'Flag one of your 5 picks to go for more — it now needs to clear a bigger number, not just cover.',
    example: {
      line: `Ohio State ${formatSpread(DD_BASE_SPREAD)} → DD ${formatSpread(DD_EFFECTIVE_SPREAD)}`,
      context: 'Wins by 12 (not just 10)',
      result: 'Cover + Bonus',
      points: '+2',
    },
  },
  {
    title: 'One mandatory underdog',
    body: 'Pick a 6th, separate game — an underdog to win outright. Covering doesn’t count here.',
    tiers: [
      { range: '+1.5 to +6.5', points: '1 point' },
      { range: '+7 to +13.5', points: '2 points' },
      { range: '+14 or more', points: '3 points' },
    ],
    example: { line: '+9 underdog', context: 'Wins outright', result: 'Win', points: '2 points' },
  },
]

function ExampleChip({ line, context, result, points }) {
  return (
    <div
      className="flex items-center gap-[10px] rounded-[10px] px-3 py-[8px] mt-[8px]"
      style={{ background: CFB_THEME.positiveSoft }}
    >
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-semibold truncate" style={{ color: CFB_THEME.ink }}>{line}</div>
        <div className="text-[11px] mt-[1px]" style={{ color: CFB_THEME.muted2 }}>{context}</div>
      </div>
      <span
        className="font-display font-bold text-[9px] uppercase tracking-[.06em] px-[7px] py-[3px] rounded-full flex-none"
        style={{ background: CFB_THEME.cardWhite, color: CFB_THEME.positive }}
      >
        {result}
      </span>
      <span className="font-display font-bold tabular-nums text-[13px] flex-none" style={{ color: CFB_THEME.positive }}>
        {points}
      </span>
    </div>
  )
}

function TierTable({ tiers }) {
  return (
    <div
      className="rounded-[10px] px-3 py-[6px] mt-[8px]"
      style={{ background: CFB_THEME.rankBg }}
    >
      {tiers.map((t, i) => (
        <div
          key={t.range}
          className="flex items-center justify-between py-[5px]"
          style={{ borderTop: i > 0 ? `1px solid ${CFB_THEME.border}` : 'none' }}
        >
          <span className="text-[11.5px]" style={{ color: CFB_THEME.muted2 }}>{t.range}</span>
          <span className="font-display font-extrabold tabular-nums text-[14px]" style={{ color: CFB_THEME.positive }}>
            {t.points}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function CfbRulesButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-[5px] rounded-full px-[10px] py-[5px] text-[11px] font-semibold cursor-pointer border flex-none"
        style={{ background: 'transparent', borderColor: CFB_THEME.border, color: CFB_THEME.muted2 }}
      >
        <span
          className="w-[14px] h-[14px] rounded-full flex items-center justify-center text-[9px] font-display font-bold flex-none"
          style={{ background: CFB_THEME.rankBg, color: CFB_THEME.muted2 }}
        >
          ?
        </span>
        How scoring works
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-4"
          style={{ background: 'rgba(10,18,41,.55)' }}
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-[420px] rounded-[16px] overflow-hidden"
            style={{ background: CFB_THEME.cardWhite, border: `1px solid ${CFB_THEME.border}` }}
            onClick={e => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between px-5 py-4"
              style={{ background: CFB_THEME.headerGradient }}
            >
              <span className="font-display font-extrabold text-[16px]" style={{ color: CFB_THEME.cream }}>
                How Scoring Works
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-[18px] leading-none cursor-pointer border-none bg-transparent"
                style={{ color: 'rgba(248,245,238,.6)' }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="px-5 py-4 space-y-[16px] max-h-[70vh] overflow-y-auto">
              {RULES.map(r => (
                <div key={r.title}>
                  <div className="font-display font-bold text-[12.5px]" style={{ color: CFB_THEME.ink }}>
                    {r.title}
                  </div>
                  <div className="text-[12px] mt-[2px] leading-snug" style={{ color: CFB_THEME.muted2 }}>
                    {r.body}
                  </div>
                  {r.tiers && <TierTable tiers={r.tiers} />}
                  {r.example && <ExampleChip {...r.example} />}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
