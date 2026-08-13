import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getAdminCfbPools } from '../../../lib/cfb'

// Admin: index of CFB (college football) pools. Entry point to create a new season
// pool and to open each pool's weekly ops. Kept separate from the golf-centric
// AdminDashboard (sport siloing). General admin register.

const STATUS_STYLES = {
  open: 'bg-fairway/10 text-fairway',
  locked: 'bg-gold/20 text-gold',
  complete: 'bg-warm-200 text-warm-400',
  draft: 'bg-warm-200 text-warm-400',
}

export default function CfbAdmin() {
  const [pools, setPools] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    getAdminCfbPools()
      .then(setPools)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-sand pb-12">
      <div className="bg-white border-b border-[#EAD8C4] px-[18px] h-14 flex items-center gap-[14px] sticky top-0 z-10">
        <Link to="/admin" className="text-[13px] text-warm-400 no-underline">← Admin</Link>
        <span className="text-[#EAD8C4] text-base select-none">|</span>
        <span className="font-display font-extrabold text-[22px] text-brand tracking-[.06em]">POOLD</span>
        <span className="font-display font-bold text-[16px] text-[#1C1610] tracking-[.04em]">College Football</span>
      </div>

      <div className="max-w-3xl mx-auto px-[18px] py-6">
        {error && (
          <div className="mb-5 p-4 bg-birdie/5 border border-birdie/20 rounded-[11px] text-[13px] text-birdie">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between mb-5">
          <div className="font-display font-extrabold text-[28px] text-[#1C1610] leading-none">CFB Pools</div>
          <Link
            to="/admin/cfb/create-pool"
            className="text-[13px] text-brand font-semibold no-underline hover:text-brand/80 transition-colors"
          >
            + New CFB Pool
          </Link>
        </div>

        {loading ? (
          <p className="text-sm text-warm-400 py-4">Loading…</p>
        ) : pools.length === 0 ? (
          <p className="text-sm text-warm-400 py-4">No CFB pools yet. Create one to seed a season of weekly slates.</p>
        ) : (
          <div className="space-y-[10px]">
            {pools.map(p => (
              <Link
                key={p.id}
                to={`/admin/cfb/pool/${p.id}`}
                className="block bg-white border border-[#EAD8C4] rounded-[14px] p-4 no-underline hover:border-brand/40 transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="text-[14.5px] font-semibold text-[#1C1610]">{p.name}</span>
                    <p className="text-[11.5px] text-warm-400 mt-[2px]">
                      {p.season_year} season · join code {p.join_code}
                    </p>
                  </div>
                  <span className={`text-[10px] font-display font-bold uppercase tracking-[.12em] px-2 py-[3px] rounded-full ${STATUS_STYLES[p.status] ?? STATUS_STYLES.draft}`}>
                    {p.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
