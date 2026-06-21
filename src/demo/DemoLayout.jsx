import { Link, Outlet } from 'react-router-dom'

// Thin ribbon above every demo screen so it's always clear this is sample data.
export default function DemoLayout() {
  return (
    <div className="min-h-screen bg-cream">
      <div className="bg-charcoal text-cream/80 text-xs px-4 py-1.5 flex items-center justify-center gap-2">
        <span className="font-display font-bold uppercase tracking-widest text-gold">Demo</span>
        <span className="text-cream/50">Sample data · no sign-up</span>
        <span className="text-cream/30">·</span>
        <Link to="/" className="text-cream/70 hover:text-cream underline underline-offset-2 transition-colors">
          Sign in
        </Link>
      </div>
      <Outlet />
    </div>
  )
}
