import { Link } from 'react-router-dom'

/**
 * Legal footer. Sits on every page a user can actually land on — the policies
 * are only worth having if they are reachable from wherever someone is standing.
 */
export default function Footer() {
  return (
    <div className="flex items-center justify-center gap-2 py-5 text-[11.5px] text-warm-300">
      <Link to="/privacy" className="text-warm-400 no-underline hover:underline">Privacy</Link>
      <span>·</span>
      <Link to="/terms" className="text-warm-400 no-underline hover:underline">Terms</Link>
      <span>·</span>
      <span>© {new Date().getFullYear()} Poold</span>
    </div>
  )
}
