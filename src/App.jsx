import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import AuthCallback from './pages/AuthCallback'
import Dashboard from './pages/Dashboard'
import Join from './pages/Join'
import Picks from './pages/Picks'
import Welcome from './pages/Welcome'
import Profile from './pages/Profile'
import Privacy from './pages/legal/Privacy'
import Terms from './pages/legal/Terms'
import CreateTournament from './pages/admin/CreateTournament'
import CreatePoolChooser from './pages/admin/CreatePoolChooser'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminUsers from './pages/admin/AdminUsers'
import CfbAdmin from './pages/admin/cfb/CfbAdmin'
import CreateCfbPool from './pages/admin/cfb/CreateCfbPool'
import CfbPoolOps from './pages/admin/cfb/CfbPoolOps'
import CfbPoolDetail from './pages/cfb/CfbPoolDetail'
import CfbPicks from './pages/cfb/CfbPicks'
import CfbSlate from './pages/cfb/CfbSlate'
import TournamentDetail from './pages/TournamentDetail'
import { DemoProvider } from './demo/DemoContext'
import { DemoCfbProvider } from './demo/DemoCfbContext'
import DemoLayout from './demo/DemoLayout'
import DemoLanding from './demo/DemoLanding'
import DemoTournament from './demo/DemoTournament'
import DemoPicks from './demo/DemoPicks'
import DemoCfbPoolDetail from './demo/DemoCfbPoolDetail'
import DemoCfbPicks from './demo/DemoCfbPicks'

function RootRoute() {
  // The landing page at "/". If you already have a session, skip the login
  // screen and go straight to your dashboard (ProtectedRoute there still
  // handles the unnamed-profile → /welcome bounce). While the session is
  // still being read, render nothing so the login form doesn't flash first.
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) return <Navigate to="/dashboard" replace />
  return <Login />
}

function ProtectedRoute({ children }) {
  const { user, profile, loading } = useAuth()
  const location = useLocation()
  if (loading) return null
  if (!user) return <Navigate to="/" replace />
  // A profile with no display_name has never been through onboarding. Everything
  // downstream (leaderboards, standings, picks) publishes that name to the pool,
  // so nobody gets past this point unnamed. /welcome sends them back here after.
  if (profile && !profile.display_name) {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/welcome?next=${next}`} replace />
  }
  return children
}

function AdminRoute({ children }) {
  const { user, profile, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/" replace />
  if (profile && !profile.display_name) return <Navigate to="/welcome" replace />
  if (profile?.role !== 'admin') return <Navigate to="/dashboard" replace />
  return children
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<RootRoute />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/join/:code" element={<Join />} />

          {/* Public on purpose — a policy you must sign in to read is not a policy */}
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />

          {/* Public demo — no auth, sample data (DemoProvider/DemoCfbProvider persist
              picks across /demo/*, one per sport) */}
          <Route path="/demo" element={<DemoProvider><DemoCfbProvider><DemoLayout /></DemoCfbProvider></DemoProvider>}>
            <Route index element={<DemoLanding />} />
            <Route path="tournament" element={<DemoTournament />} />
            <Route path="picks" element={<DemoPicks />} />
            <Route path="cfb" element={<DemoCfbPoolDetail />} />
            <Route path="cfb/picks" element={<DemoCfbPicks />} />
          </Route>

          {/* Not wrapped in ProtectedRoute — it is where ProtectedRoute sends you */}
          <Route path="/welcome" element={<Welcome />} />

          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
          <Route path="/admin/users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
          <Route path="/admin/create" element={<AdminRoute><CreatePoolChooser /></AdminRoute>} />
          <Route path="/admin/create-tournament" element={<AdminRoute><CreateTournament /></AdminRoute>} />
          <Route path="/admin/cfb" element={<AdminRoute><CfbAdmin /></AdminRoute>} />
          <Route path="/admin/cfb/create-pool" element={<AdminRoute><CreateCfbPool /></AdminRoute>} />
          <Route path="/admin/cfb/pool/:id" element={<AdminRoute><CfbPoolOps /></AdminRoute>} />
          <Route path="/tournament/:id" element={<ProtectedRoute><TournamentDetail /></ProtectedRoute>} />
          <Route path="/tournament/:id/picks" element={<ProtectedRoute><Picks /></ProtectedRoute>} />
          <Route path="/cfb/pool/:id" element={<ProtectedRoute><CfbPoolDetail /></ProtectedRoute>} />
          <Route path="/cfb/pool/:id/picks" element={<ProtectedRoute><CfbPicks /></ProtectedRoute>} />
          <Route path="/cfb/pool/:id/slate" element={<ProtectedRoute><CfbSlate /></ProtectedRoute>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
