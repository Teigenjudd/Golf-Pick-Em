import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import AuthCallback from './pages/AuthCallback'
import Pending from './pages/Pending'
import Dashboard from './pages/Dashboard'
import CreateTournament from './pages/admin/CreateTournament'
import TournamentDetail from './pages/TournamentDetail'

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
          <Route path="/pending" element={<Pending />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/admin/create-tournament" element={<AdminRoute><CreateTournament /></AdminRoute>} />
          <Route path="/tournament/:id" element={<ProtectedRoute><TournamentDetail /></ProtectedRoute>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
