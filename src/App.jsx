import { useEffect, useState, Component } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './utils/supabase'
import Home from './pages/Home'
import MatchDetail from './pages/MatchDetail'
import Auth from './pages/Auth'

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center p-8">
          <div className="text-center max-w-lg">
            <p className="text-red-400 font-semibold mb-2">App failed to start</p>
            <p className="text-gray-400 text-sm font-mono bg-gray-900 rounded p-3 text-left break-all">
              {this.state.error.message}
            </p>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function AppRoutes() {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-500 text-sm animate-pulse">Loading…</p>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={session ? <Home session={session} /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/match/:id"
          element={session ? <MatchDetail /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/auth"
          element={session ? <Navigate to="/" replace /> : <Auth />}
        />
      </Routes>
    </BrowserRouter>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppRoutes />
    </ErrorBoundary>
  )
}
