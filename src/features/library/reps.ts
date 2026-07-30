import { LIBRARY_REP_TARGET } from '../../domain/entities'

export { LIBRARY_REP_TARGET }

// Milestone copy that nudges another pass — comprehensible input rewards repeating the same content.
export function repMessage(reps: number): string {
  if (reps <= 0) return 'First pass coming up — don’t expect to catch it all.'
  if (reps === 1) return 'One pass down. The second time through is where it starts to stick.'
  if (reps <= 3) return 'Getting familiar — keep going, comprehension compounds.'
  if (reps < LIBRARY_REP_TARGET) return 'It should be clicking now. A few more and it’s yours.'
  return 'You’ve worn a groove in this one — keep it, or pick something new.'
}

/** Short "last watched" label for a rep timestamp. */
export function formatLastRep(ms: number | null, now: number = Date.now()): string {
  if (!ms) return 'never'
  const startOfToday = new Date(now).setHours(0, 0, 0, 0)
  const dayMs = 24 * 60 * 60 * 1000
  if (ms >= startOfToday) return 'today'
  if (ms >= startOfToday - dayMs) return 'yesterday'
  return new Date(ms).toLocaleDateString()
}
