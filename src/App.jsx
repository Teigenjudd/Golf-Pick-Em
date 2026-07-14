import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import AuthCallback from './pages/AuthCallback'
import Dashboard from './pages/Dashboard'
import Join from './pages/Join'
import Picks from './pages/Picks'
import Welcome from './pages/Welcome'
import Profile from './pages/Profile'
import CreateTournament from './pages/admin/CreateTournament'
import AdminDashboard from './pages/admin/AdminDashboard'
import TournamentDetail from './pages/TournamentDetail'
import { DemoProvider } from './demo/DemoContext'
import DemoLayout from './demo/DemoLayout'
import DemoLanding from './demo/DemoLanding'
import DemoTournament from './demo/DemoTournament'
import DemoPicks from './demo/DemoPicks'

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
          <Route path="/" element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/join/:code" element={<Join />} />

          {/* Public demo — no auth, sample data (DemoProvider persists picks across /demo/*) */}
          <Route path="/demo" element={<DemoProvider><DemoLayout /></DemoProvider>}>
            <Route index element={<DemoLanding />} />
            <Route path="tournament" element={<DemoTournament />} />
            <Route path="picks" element={<DemoPicks />} />
          </Route>

          {/* Not wrapped in ProtectedRoute — it is where ProtectedRoute sends you */}
          <Route path="/welcome" element={<Welcome />} />

          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
          <Route path="/admin/create-tournament" element={<AdminRoute><CreateTournament /></AdminRoute>} />
          <Route path="/tournament/:id" element={<ProtectedRoute><TournamentDetail /></ProtectedRoute>} />
          <Route path="/tournament/:id/picks" element={<ProtectedRoute><Picks /></ProtectedRoute>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
