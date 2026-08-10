import { Navigate, Outlet } from 'react-router'
import { useProfile } from '../../services/queries/profile'
import { isOnboarded } from '../../domain/entities'

export function RequireOnboarded() {
  const { data: profile, isLoading, isError, error } = useProfile()

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-stone-400">
        Loading…
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="font-medium">Could not load your profile.</p>
        <p className="max-w-md text-sm text-stone-500">{(error as Error).message}</p>
      </div>
    )
  }

  // Needs a destination AND a finished first run. Adding a second language deliberately
  // sits outside this gate — /languages/new should not replay onboarding.
  if (!profile || !isOnboarded(profile)) return <Navigate to="/onboarding" replace />

  return <Outlet />
}
