import { describe, expect, it } from 'vitest'
import { repMessage, formatLastRep } from './reps'
import { LIBRARY_REP_TARGET } from '../../domain/entities'

describe('repMessage', () => {
  it('gives distinct nudges across the rep ramp', () => {
    expect(repMessage(0)).toMatch(/first pass/i)
    expect(repMessage(1)).toMatch(/one pass/i)
    expect(repMessage(2)).toMatch(/familiar/i)
    expect(repMessage(3)).toMatch(/familiar/i)
    expect(repMessage(LIBRARY_REP_TARGET - 1)).toMatch(/clicking/i)
  })

  it('switches to the "mastered" message at the target', () => {
    expect(repMessage(LIBRARY_REP_TARGET)).toMatch(/groove/i)
    expect(repMessage(LIBRARY_REP_TARGET + 5)).toMatch(/groove/i)
  })

  it('handles negative/zero gracefully', () => {
    expect(repMessage(-1)).toMatch(/first pass/i)
  })
})

describe('formatLastRep', () => {
  const now = Date.parse('2026-07-30T12:00:00')
  const dayMs = 24 * 60 * 60 * 1000

  it('returns never for null', () => {
    expect(formatLastRep(null, now)).toBe('never')
  })

  it('returns today for a timestamp earlier today', () => {
    expect(formatLastRep(Date.parse('2026-07-30T08:00:00'), now)).toBe('today')
  })

  it('returns yesterday for the prior day', () => {
    expect(formatLastRep(now - dayMs, now)).toBe('yesterday')
  })

  it('returns a date string for older timestamps', () => {
    const label = formatLastRep(now - 5 * dayMs, now)
    expect(label).not.toBe('today')
    expect(label).not.toBe('yesterday')
    expect(label).not.toBe('never')
  })
})
