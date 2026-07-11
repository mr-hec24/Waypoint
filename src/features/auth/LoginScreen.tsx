import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from './AuthProvider'

type Mode = 'signin' | 'signup'

export function LoginScreen() {
  const { session, configured } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (session) return <Navigate to="/" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setBusy(true)
    setError(null)
    setMessage(null)
    const { error } =
      mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password })
    if (error) setError(error.message)
    else if (mode === 'signup') setMessage('Check your email to confirm your account.')
    setBusy(false)
  }

  async function handleMagicLink() {
    if (!supabase || !email) {
      setError('Enter your email first.')
      return
    }
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) setError(error.message)
    else setMessage('Magic link sent — check your email.')
    setBusy(false)
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-display text-3xl font-bold text-primary-900">Waypoint</h1>
          <p className="mt-1 text-[10px] font-extrabold tracking-[.22em] text-stone-500 uppercase">
            The Roadtrip Method, turned into a tool
          </p>
        </div>

        {!configured ? (
          <p className="text-center text-sm text-stone-500">
            Supabase is not configured — see <code>.env.example</code>.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              type="email"
              required
              placeholder="Email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-stone-300 bg-card px-3.5 py-2.5 text-sm outline-none focus:border-primary-500"
            />
            <input
              type="password"
              required
              minLength={6}
              placeholder="Password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border border-stone-300 bg-card px-3.5 py-2.5 text-sm outline-none focus:border-primary-500"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-primary-700 px-4 py-2.5 text-sm font-semibold text-[#F7F2E8] transition-colors hover:bg-primary-800 disabled:opacity-50"
            >
              {mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handleMagicLink}
              className="rounded-lg border border-stone-200 bg-card px-4 py-2.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100 disabled:opacity-50"
            >
              Email me a magic link
            </button>

            {error && <p className="text-center text-sm text-output-deep">{error}</p>}
            {message && <p className="text-center text-sm text-primary-700">{message}</p>}

            <button
              type="button"
              onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
              className="mt-2 text-center text-sm text-stone-500 underline"
            >
              {mode === 'signin'
                ? 'No account? Create one'
                : 'Already have an account? Sign in'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
