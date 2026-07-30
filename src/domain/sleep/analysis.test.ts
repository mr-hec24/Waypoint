import { describe, expect, it } from 'vitest'
import {
  classifyNight,
  correlateSleepRecall,
  hoursSlept,
  isRestedNight,
  isRoughNight,
  MIN_DAYS_PER_BUCKET,
  MIN_REVIEWS_PER_BUCKET,
} from './analysis'
import type { ReviewLog, SleepLog } from '../entities'

function sleep(over: Partial<SleepLog>): SleepLog {
  return {
    id: 'id',
    userId: 'u',
    createdAt: 0,
    updatedAt: 0,
    date: '2026-07-01',
    bedTime: '23:00',
    wakeTime: '07:00',
    quality: 3,
    notes: '',
    ...over,
  }
}

/** A review at local noon on `date` with the given grade. */
function review(date: string, grade: ReviewLog['grade']): ReviewLog {
  return {
    id: crypto.randomUUID(),
    userId: 'u',
    createdAt: 0,
    updatedAt: 0,
    wordId: 'w',
    reviewedAt: new Date(`${date}T12:00:00`).getTime(),
    grade,
    prevIntervalDays: 0,
    newIntervalDays: 0,
    ease: 2.5,
  }
}

describe('hoursSlept', () => {
  it('handles a past-midnight bedtime (23:00 → 07:00 = 8h)', () => {
    expect(hoursSlept('23:00', '07:00')).toBe(8)
  })

  it('handles a same-day span (01:00 → 09:30 = 8.5h)', () => {
    expect(hoursSlept('01:00', '09:30')).toBe(8.5)
  })

  it('treats equal times as a full 24h wrap rather than 0', () => {
    expect(hoursSlept('07:00', '07:00')).toBe(24)
  })

  it('returns null for missing or malformed times', () => {
    expect(hoursSlept('', '07:00')).toBeNull()
    expect(hoursSlept('23:00', '')).toBeNull()
    expect(hoursSlept('25:00', '07:00')).toBeNull()
  })
})

describe('night classification', () => {
  it('flags a rough night on low quality', () => {
    expect(isRoughNight(sleep({ quality: 2 }))).toBe(true)
    expect(isRoughNight(sleep({ quality: 3 }))).toBe(false)
  })

  it('flags a rough night on short sleep even with an okay rating', () => {
    expect(isRoughNight(sleep({ quality: 3, bedTime: '02:00', wakeTime: '07:00' }))).toBe(true)
  })

  it('flags a rested night on high quality or a full night', () => {
    expect(isRestedNight(sleep({ quality: 4 }))).toBe(true)
    expect(isRestedNight(sleep({ quality: 3, bedTime: '22:00', wakeTime: '06:30' }))).toBe(true)
  })

  it('classifies rough over rested when a night is both short and highly rated', () => {
    expect(classifyNight(sleep({ quality: 5, bedTime: '02:30', wakeTime: '07:00' }))).toBe('rough')
  })

  it('leaves a middling night neutral', () => {
    expect(classifyNight(sleep({ quality: 3, bedTime: '23:30', wakeTime: '06:00' }))).toBe('neutral')
  })
})

describe('correlateSleepRecall', () => {
  it('withholds the insight until both buckets clear the minimum sample', () => {
    const sleeps = [sleep({ date: '2026-07-01', quality: 5 })]
    const reviews = [review('2026-07-01', 2), review('2026-07-01', 0)]
    expect(correlateSleepRecall(sleeps, reviews).hasEnoughData).toBe(false)
  })

  it('reports higher accuracy on rested days than rough ones', () => {
    const sleeps: SleepLog[] = []
    const reviews: ReviewLog[] = []
    // 4 rested days: mostly recalled (3 good, 1 again each).
    for (let d = 1; d <= 4; d++) {
      const date = `2026-07-0${d}`
      sleeps.push(sleep({ date, quality: 5, id: `s${d}` }))
      reviews.push(review(date, 2), review(date, 2), review(date, 2), review(date, 0), review(date, 3), review(date, 2), review(date, 2))
    }
    // 4 rough days: mostly missed (2 good, 3 again each).
    for (let d = 5; d <= 8; d++) {
      const date = `2026-07-0${d}`
      sleeps.push(sleep({ date, quality: 1, id: `s${d}` }))
      reviews.push(review(date, 0), review(date, 0), review(date, 1), review(date, 0), review(date, 2), review(date, 2), review(date, 0))
    }

    const insight = correlateSleepRecall(sleeps, reviews)
    expect(insight.hasEnoughData).toBe(true)
    expect(insight.rested.days).toBe(4)
    expect(insight.rough.days).toBe(4)
    expect(insight.rested.accuracy).toBeGreaterThan(insight.rough.accuracy)
    // rested: 6/7 recalled per day; rough: 2/7 recalled per day.
    expect(insight.rested.accuracy).toBeCloseTo(6 / 7)
    expect(insight.rough.accuracy).toBeCloseTo(2 / 7)
  })

  it('ignores reviews on neutral or unlogged days', () => {
    const sleeps = [sleep({ date: '2026-07-01', quality: 3, bedTime: '23:30', wakeTime: '06:00' })]
    const reviews = [review('2026-07-01', 2), review('2026-07-02', 0)]
    const insight = correlateSleepRecall(sleeps, reviews)
    expect(insight.rested.reviews).toBe(0)
    expect(insight.rough.reviews).toBe(0)
  })

  it('exposes tunable thresholds as constants', () => {
    expect(MIN_DAYS_PER_BUCKET).toBeGreaterThan(0)
    expect(MIN_REVIEWS_PER_BUCKET).toBeGreaterThan(0)
  })
})
