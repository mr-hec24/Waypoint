// SM-2 spaced repetition, adapted with the common 4-grade scale
// (0 again / 1 hard / 2 good / 3 easy) mapped onto SM-2 quality values.
// Pure and deterministic — the append-only ReviewLog makes a future
// algorithm swap (e.g. FSRS) possible by replaying history.

import type { SrsGrade, SrsState } from '../entities'

export const MIN_EASE = 1.3
const DAY_MS = 24 * 60 * 60 * 1000

// SM-2 quality (0–5) equivalents of our four grades.
const QUALITY: Record<SrsGrade, number> = { 0: 2, 1: 3, 2: 4, 3: 5 }

export function sm2(prev: SrsState, grade: SrsGrade, now: number): SrsState {
  const q = QUALITY[grade]

  // Ease update per SM-2: EF' = EF + (0.1 - (5-q) * (0.08 + (5-q) * 0.02))
  const ease = Math.max(MIN_EASE, prev.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)))

  if (grade === 0) {
    // Lapse: back to the start of the learning ladder, tomorrow-ish (10 min for new cards).
    return {
      ease,
      intervalDays: 0,
      reps: 0,
      lapses: prev.state === 'new' ? prev.lapses : prev.lapses + 1,
      due: now + 10 * 60 * 1000,
      state: 'learning',
    }
  }

  const reps = prev.reps + 1
  let intervalDays: number
  if (reps === 1) intervalDays = 1
  else if (reps === 2) intervalDays = 6
  else intervalDays = Math.round(prev.intervalDays * ease)

  // Grade modifiers: hard progresses slower, easy faster.
  if (grade === 1) intervalDays = Math.max(1, Math.round(intervalDays * 0.8))
  if (grade === 3) intervalDays = Math.round(intervalDays * 1.3)

  return {
    ease,
    intervalDays,
    reps,
    lapses: prev.lapses,
    due: now + intervalDays * DAY_MS,
    state: reps < 2 ? 'learning' : 'review',
  }
}
