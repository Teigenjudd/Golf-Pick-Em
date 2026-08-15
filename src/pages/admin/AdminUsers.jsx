import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import AdminShell from '../../components/admin/AdminShell'

// Sport-agnostic admin page (/admin/users) — user/role management, formerly a tab
// buried inside the golf-only AdminDashboard. Roles aren't scoped to a sport, so
// this lives outside both AdminShell's sport panels (activeSport=null). Room for
// future non-user settings under the same "Users & Settings" nav entry.

export default function AdminUsers() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    // Email is column-restricted on profiles; admins read it via this RPC.
    const { data } = await supabase.rpc('admin_list_users')
    setUsers(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function toggleRole(userId, currentRole) {
    const newRole = currentRole === 'admin' ? 'player' : 'admin'
    setUpdating(userId)
    setError(null)
    // profiles.role is column-locked against the client (A1) — admins change it
    // through this RPC, which checks is_admin() server-side.
    const { error: rpcError } = await supabase.rpc('admin_set_role', {
      target_user: userId,
      new_role: newRole,
    })
    if (rpcError) setError(rpcError.message)
    else await load()
    setUpdating(null)
  }

  return (
    <AdminShell activeSport={null}>
      <div className="font-display font-extrabold text-[28px] text-[#1C1610] leading-none mb-5">Users</div>

      {loading ? (
        <p className="text-sm text-warm-400 py-6">Loading…</p>
      ) : (
        <>
          <p className="text-[13px] text-warm-400 mb-3">
            {users.length} user{users.length !== 1 ? 's' : ''}
          </p>

          {error && (
            <p className="text-[12px] text-birdie border border-birdie/30 bg-birdie/5 rounded-[8px] px-3 py-2 mb-3">
              Couldn’t change that role — {error}
            </p>
          )}

          <div className="flex flex-col gap-2">
            {users.map(u => (
              <div key={u.id} className="bg-white border border-[#EAD8C4] rounded-[13px] px-4 py-[13px] flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-[#1C1610] truncate">{u.display_name || '—'}</p>
                  <p className="text-[12px] text-warm-400 mt-[1px] truncate">{u.email}</p>
                </div>
                <span className={`text-[11px] font-semibold px-[9px] py-[3px] rounded-full shrink-0 ${
                  u.role === 'admin' ? 'bg-fairway/10 text-fairway' : 'bg-[#EBE3D4] text-warm-400'
                }`}>
                  {u.role}
                </span>
                {u.id !== currentUser?.id && (
                  <button
                    onClick={() => toggleRole(u.id, u.role)}
                    disabled={updating === u.id}
                    className="text-[12px] px-3 py-[6px] rounded-[8px] border border-[#EAD8C4] text-warm-400 hover:bg-warm-100 disabled:opacity-50 transition-colors shrink-0 cursor-pointer whitespace-nowrap"
                  >
                    {updating === u.id ? '…' : u.role === 'admin' ? 'Make Player' : 'Make Admin'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </AdminShell>
  )
}
