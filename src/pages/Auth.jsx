import { useState } from 'react'
import { supabase } from '../utils/supabase'

export default function Auth() {
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState(null) // null | 'loading' | 'error' | 'check-email'
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setStatus('loading')
    setError('')

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setError(error.message); setStatus('error') }
      // on success, App.jsx auth listener redirects automatically
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) { setError(error.message); setStatus('error') }
      else setStatus('check-email')
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-4xl">🏓</span>
          <h1 className="text-xl font-bold text-gray-100 mt-3">Pickleball Analytics</h1>
          <p className="text-gray-400 text-sm mt-1">Track your game across every device</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex gap-1 bg-gray-800 rounded-lg p-1 mb-6">
            {['login', 'signup'].map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setStatus(null); setError('') }}
                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  mode === m
                    ? 'bg-gray-700 text-gray-100'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {m === 'login' ? 'Log in' : 'Sign up'}
              </button>
            ))}
          </div>

          {status === 'check-email' ? (
            <div className="text-center py-4 space-y-2">
              <p className="text-emerald-400 font-medium">Check your email!</p>
              <p className="text-gray-400 text-sm">We sent a confirmation link to <span className="text-gray-200">{email}</span></p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-gray-400 text-xs mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-gray-800 border border-gray-700 focus:border-emerald-500 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-xs mb-1.5">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-gray-800 border border-gray-700 focus:border-emerald-500 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 outline-none transition-colors"
                />
              </div>

              {error && <p className="text-red-400 text-xs">{error}</p>}

              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm transition-colors"
              >
                {status === 'loading'
                  ? 'Please wait…'
                  : mode === 'login' ? 'Log in' : 'Create account'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
