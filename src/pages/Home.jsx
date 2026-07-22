import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../utils/supabase'
import { getMatches } from '../utils/storage'
import CSVUploader from '../components/CSVUploader'
import MatchCard from '../components/MatchCard'

export default function Home({ session }) {
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setMatches(await getMatches())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  function handleImported() {
    refresh()
    setShowUpload(false)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🏓</span>
          <h1 className="text-xl font-bold text-gray-100">Pickleball Analytics</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-gray-500 text-xs hidden sm:block">{session.user.email}</span>
          <button
            onClick={() => setShowUpload((v) => !v)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {showUpload ? 'Cancel' : '+ Import Match'}
          </button>
          <button
            onClick={handleSignOut}
            className="text-gray-400 hover:text-gray-200 text-sm transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {showUpload && (
          <div className="mb-8 bg-gray-900 border border-gray-700 rounded-2xl p-6">
            <h2 className="text-gray-200 font-semibold mb-4">Import SwingVision CSV</h2>
            <CSVUploader onImported={handleImported} />
          </div>
        )}

        {loading ? (
          <div className="text-center py-24 text-gray-500 animate-pulse">Loading matches…</div>
        ) : matches.length === 0 ? (
          <div className="text-center py-24 text-gray-500">
            <p className="text-4xl mb-4">📂</p>
            <p className="text-lg">No matches yet.</p>
            <p className="text-sm mt-1">Import a SwingVision CSV to get started.</p>
            {!showUpload && (
              <button
                onClick={() => setShowUpload(true)}
                className="mt-6 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
              >
                Import your first match
              </button>
            )}
          </div>
        ) : (
          <>
            <h2 className="text-gray-400 text-sm font-semibold uppercase tracking-wider mb-4">
              {matches.length} match{matches.length !== 1 ? 'es' : ''}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {matches.map((m) => (
                <MatchCard key={m.id} match={m} onDeleted={refresh} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
