import { useEffect, useState } from 'react'
import { useSessionStore } from './sessionStore'

/**
 * Drives the running session: re-renders once a second for countdown display
 * and dispatches TICK so elapsed phases resolve (including immediately after
 * the tab becomes visible again). All timing derives from persisted
 * timestamps, so this is purely a display/trigger loop.
 */
export function useSessionTicker(): number {
  const phaseEndsAt = useSessionStore((s) => s.session?.run.phaseEndsAt)
  const dispatch = useSessionStore((s) => s.dispatch)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    const onVisible = () => {
      if (!document.hidden) {
        const t = Date.now()
        setNow(t)
        dispatch({ type: 'TICK', now: t })
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [dispatch])

  useEffect(() => {
    if (phaseEndsAt != null && now >= phaseEndsAt) dispatch({ type: 'TICK', now })
  }, [now, phaseEndsAt, dispatch])

  return now
}
