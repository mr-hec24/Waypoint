// Pure sleep analysis — derives hours slept from the logged times and
// correlates rest with flashcard recall. No React/Supabase imports, so it
// stays unit-testable like sm2.ts. Sleep only ever informs *feedback*; it
// never touches SRS scheduling.

import type { ReviewLog, SleepLog } from '../entities'

/** Parse "HH:MM" to minutes since midnight, or null if malformed. */
function parseHHMM(t: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

/**
 * Hours between bedtime and wake time, handling a past-midnight bedtime
 * (e.g. 23:00 → 07:00 = 8h). Returns null when either time is missing/invalid.
 */
export function hoursSlept(bedTime: string, wakeTime: string): number | null {
  const bed = parseHHMM(bedTime)
  const wake = parseHHMM(wakeTime)
  if (bed === null || wake === null) return null
  let diff = wake - bed
  if (diff <= 0) diff += 24 * 60
  return diff / 60
}

/** A rough night: low self-rated quality or short sleep. Drives the review reframe. */
export function isRoughNight(log: SleepLog): boolean {
  const h = hoursSlept(log.bedTime, log.wakeTime)
  return log.quality <= 2 || (h !== null && h < 6)
}

/** A well-rested night: high quality or a full night's sleep. */
export function isRestedNight(log: SleepLog): boolean {
  const h = hoursSlept(log.bedTime, log.wakeTime)
  return log.quality >= 4 || (h !== null && h >= 7)
}

export type SleepBucket = 'rested' | 'rough' | 'neutral'

/** Rough takes precedence over rested when a night somehow qualifies as both. */
export function classifyNight(log: SleepLog): SleepBucket {
  if (isRoughNight(log)) return 'rough'
  if (isRestedNight(log)) return 'rested'
  return 'neutral'
}

/** Local YYYY-MM-DD for an epoch-ms instant — matches how sleep logs store `date`. */
function localDate(ms: number): string {
  const d = new Date(ms)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** A review is "recalled" when graded Good or Easy (2–3); Again/Hard count as a miss. */
function isRecalled(log: ReviewLog): boolean {
  return log.grade >= 2
}

export interface BucketStats {
  days: number // distinct calendar days that had reviews in this bucket
  reviews: number // total reviews landed in this bucket
  accuracy: number // share recalled, 0..1 (0 when reviews === 0)
}

export interface SleepRecallInsight {
  rested: BucketStats
  rough: BucketStats
  /** True once both buckets clear the minimum sample so the number isn't noise. */
  hasEnoughData: boolean
}

// Guardrails against reading a pattern into two data points.
export const MIN_DAYS_PER_BUCKET = 3
export const MIN_REVIEWS_PER_BUCKET = 20

/**
 * Joins each review to the sleep bucket of the day it happened and reports
 * recall accuracy for rested vs rough days. Days without a sleep log — or
 * classified `neutral` — are excluded.
 */
export function correlateSleepRecall(
  sleepLogs: SleepLog[],
  reviewLogs: ReviewLog[],
): SleepRecallInsight {
  const bucketByDate = new Map<string, SleepBucket>()
  for (const log of sleepLogs) bucketByDate.set(log.date, classifyNight(log))

  const acc: Record<'rested' | 'rough', { recalled: number; total: number; days: Set<string> }> = {
    rested: { recalled: 0, total: 0, days: new Set() },
    rough: { recalled: 0, total: 0, days: new Set() },
  }

  for (const review of reviewLogs) {
    const date = localDate(review.reviewedAt)
    const bucket = bucketByDate.get(date)
    if (bucket !== 'rested' && bucket !== 'rough') continue
    const b = acc[bucket]
    b.total += 1
    if (isRecalled(review)) b.recalled += 1
    b.days.add(date)
  }

  const toStats = (b: { recalled: number; total: number; days: Set<string> }): BucketStats => ({
    days: b.days.size,
    reviews: b.total,
    accuracy: b.total === 0 ? 0 : b.recalled / b.total,
  })

  const rested = toStats(acc.rested)
  const rough = toStats(acc.rough)
  const enough = (s: BucketStats) =>
    s.days >= MIN_DAYS_PER_BUCKET && s.reviews >= MIN_REVIEWS_PER_BUCKET

  return { rested, rough, hasEnoughData: enough(rested) && enough(rough) }
}
