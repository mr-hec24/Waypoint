import { describe, expect, it } from 'vitest'
import { sm2, MIN_EASE } from './sm2'
import { newSrsState } from '../entities'
import type { SrsGrade, SrsState } from '../entities'

const NOW = Date.parse('2026-01-01T00:00:00Z')
const DAY_MS = 24 * 60 * 60 * 1000

function review(seq: SrsGrade[], start: SrsState = newSrsState(NOW)): SrsState {
  let s = start
  let t = NOW
  for (const g of seq) {
    s = sm2(s, g, t)
    t = s.due
  }
  return s
}

describe('sm2', () => {
  it('follows the golden good-good-good sequence: 1d, 6d, ~15d', () => {
    let s = sm2(newSrsState(NOW), 2, NOW)
    expect(s.intervalDays).toBe(1)
    expect(s.state).toBe('learning')

    s = sm2(s, 2, s.due)
    expect(s.intervalDays).toBe(6)
    expect(s.state).toBe('review')

    s = sm2(s, 2, s.due)
    expect(s.intervalDays).toBe(15) // 6 * 2.5 = 15
    expect(s.state).toBe('review')
  })

  it('sets due exactly intervalDays in the future', () => {
    const s = sm2(newSrsState(NOW), 2, NOW)
    expect(s.due).toBe(NOW + s.intervalDays * DAY_MS)
  })

  it('again resets reps and interval and schedules a 10-minute retry', () => {
    const mature = review([2, 2, 2])
    const lapsed = sm2(mature, 0, mature.due)
    expect(lapsed.reps).toBe(0)
    expect(lapsed.intervalDays).toBe(0)
    expect(lapsed.state).toBe('learning')
    expect(lapsed.due).toBe(mature.due + 10 * 60 * 1000)
  })

  it('counts lapses only after leaving the new state', () => {
    const failedNew = sm2(newSrsState(NOW), 0, NOW)
    expect(failedNew.lapses).toBe(0)

    const mature = review([2, 2])
    expect(sm2(mature, 0, mature.due).lapses).toBe(1)
  })

  it('hard grows slower than good, easy faster', () => {
    const base = review([2, 2]) // 6d interval, review state
    const hard = sm2(base, 1, base.due)
    const good = sm2(base, 2, base.due)
    const easy = sm2(base, 3, base.due)
    expect(hard.intervalDays).toBeLessThan(good.intervalDays)
    expect(easy.intervalDays).toBeGreaterThan(good.intervalDays)
  })

  it('ease never drops below the floor', () => {
    let s = newSrsState(NOW)
    for (let i = 0; i < 20; i++) s = sm2(s, 0, NOW + i)
    expect(s.ease).toBe(MIN_EASE)
  })

  it('good keeps ease unchanged, easy raises it, hard lowers it', () => {
    const start = newSrsState(NOW)
    expect(sm2(start, 2, NOW).ease).toBeCloseTo(2.5)
    expect(sm2(start, 3, NOW).ease).toBeCloseTo(2.6)
    expect(sm2(start, 1, NOW).ease).toBeCloseTo(2.36)
  })

  it('never produces a negative or NaN interval', () => {
    const grades: SrsGrade[] = [0, 1, 2, 3]
    let s = newSrsState(NOW)
    let t = NOW
    for (let i = 0; i < 200; i++) {
      const g = grades[i % 4]!
      s = sm2(s, g, t)
      expect(s.intervalDays).toBeGreaterThanOrEqual(0)
      expect(Number.isFinite(s.intervalDays)).toBe(true)
      expect(s.due).toBeGreaterThan(t)
      t = s.due
    }
  })
})
