import { Navigate, Outlet } from 'react-router'
import { useAuth } from './AuthProvider'

export function RequireAuth() {
  const { session, loading, configured } = useAuth()

  if (!configured) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
        <h1 className="text-xl font-bold">Supabase is not configured</h1>
        <p className="max-w-md text-sm text-stone-500">
          Copy <code className="rounded bg-stone-200 px-1">.env.example</code> to{' '}
          <code className="rounded bg-stone-200 px-1">.env.local</code>, fill in your project URL
          and anon key, then restart the dev server.
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-stone-400">
        Loading…
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  return <Outlet />
}
