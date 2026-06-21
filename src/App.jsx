import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import AuthCallback from './pages/AuthCallback'
import Pending from './pages/Pending'
import Dashboard from './pages/Dashboard'
import Join from './pages/Join'
import Picks from './pages/Picks'
import CreateTournament from './pages/admin/CreateTournament'
import AdminDashboard from './pages/admin/AdminDashboard'
import TournamentDetail from './pages/TournamentDetail'
import { DemoProvider } from './demo/DemoContext'
import DemoLayout from './demo/DemoLayout'
import DemoLanding from './demo/DemoLanding'
import DemoTournament from './demo/DemoTournament'
import DemoPicks from './demo/DemoPicks'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/" replace />
  return children
}

function AdminRoute({ children }) {
  const { user, profile, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/" replace />
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

          {/* Public demo — no auth, sample data (DemoProvider persists picks across /demo/*) */}
          <Route path="/demo" element={<DemoProvider><DemoLayout /></DemoProvider>}>
            <Route index element={<DemoLanding />} />
            <Route path="tournament" element={<DemoTournament />} />
            <Route path="picks" element={<DemoPicks />} />
          </Route>

          <Route path="/pending" element={<Pending />} />
          <Route path="/join/:code" element={<Join />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
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
