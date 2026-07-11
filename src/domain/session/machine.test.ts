import { describe, expect, it } from 'vitest'
import { createSession, reduce } from './machine'
import type { Session } from '../entities'

const NOW = Date.parse('2026-01-01T10:00:00Z')
const MIN = 60 * 1000

function twoBlockSession(): Session {
  return createSession({
    id: 's1',
    userId: 'u1',
    language: 'Korean',
    blocks: [
      { id: 'b1', activities: [{ kind: 'flashcards', plannedMinutes: 90 }], plannedMinutes: 90 },
      { id: 'b2', activities: [{ kind: 'immersion', plannedMinutes: 90 }], plannedMinutes: 90 },
    ],
    breakMinutes: 20,
    now: NOW,
  })
}

describe('session machine', () => {
  it('START begins block 0 with a 90-minute phase window and marks intention shown', () => {
    const s = reduce(twoBlockSession(), { type: 'START', now: NOW })
    expect(s.status).toBe('active')
    expect(s.run.phase).toBe('block')
    expect(s.run.currentBlockIndex).toBe(0)
    expect(s.run.phaseEndsAt).toBe(NOW + 90 * MIN)
    expect(s.run.blockActuals).toEqual([{ blockId: 'b1', startedAt: NOW, endedAt: null }])
    expect(s.intentionShown).toBe(true)
  })

  it('START is a no-op unless planned', () => {
    const active = reduce(twoBlockSession(), { type: 'START', now: NOW })
    expect(reduce(active, { type: 'START', now: NOW + 1 })).toBe(active)
  })

  it('TICK before the phase ends changes nothing', () => {
    const active = reduce(twoBlockSession(), { type: 'START', now: NOW })
    expect(reduce(active, { type: 'TICK', now: NOW + 89 * MIN })).toBe(active)
  })

  it('TICK past block end auto-enters break, timed from the scheduled block end', () => {
    const active = reduce(twoBlockSession(), { type: 'START', now: NOW })
    const s = reduce(active, { type: 'TICK', now: NOW + 91 * MIN })
    expect(s.status).toBe('break')
    expect(s.run.phase).toBe('break')
    // Break starts at the scheduled block end, not at the tick.
    expect(s.run.phaseStartedAt).toBe(NOW + 90 * MIN)
    expect(s.run.phaseEndsAt).toBe(NOW + 110 * MIN)
    expect(s.run.blockActuals[0]!.endedAt).toBe(NOW + 90 * MIN)
  })

  it('TICK far in the future cascades through block end AND break end', () => {
    const active = reduce(twoBlockSession(), { type: 'START', now: NOW })
    const s = reduce(active, { type: 'TICK', now: NOW + 200 * MIN })
    expect(s.status).toBe('break')
    expect(s.run.phase).toBeNull() // break over — waiting for the user
    expect(s.run.currentBlockIndex).toBe(0) // next block does NOT auto-start
  })

  it('END_BLOCK ends the block early at the user time', () => {
    const active = reduce(twoBlockSession(), { type: 'START', now: NOW })
    const s = reduce(active, { type: 'END_BLOCK', now: NOW + 30 * MIN })
    expect(s.status).toBe('break')
    expect(s.run.blockActuals[0]!.endedAt).toBe(NOW + 30 * MIN)
    expect(s.run.phaseEndsAt).toBe(NOW + 50 * MIN)
  })

  it('completing the last block completes the session', () => {
    let s = reduce(twoBlockSession(), { type: 'START', now: NOW })
    s = reduce(s, { type: 'END_BLOCK', now: NOW + 90 * MIN })
    s = reduce(s, { type: 'TICK', now: NOW + 110 * MIN }) // break elapses
    s = reduce(s, { type: 'END_BREAK', now: NOW + 115 * MIN })
    expect(s.run.currentBlockIndex).toBe(1)
    s = reduce(s, { type: 'END_BLOCK', now: NOW + 200 * MIN })
    expect(s.status).toBe('completed')
    expect(s.run.phase).toBeNull()
    expect(s.run.blockActuals).toHaveLength(2)
    expect(s.run.blockActuals.every((a) => a.endedAt !== null)).toBe(true)
  })

  it('SKIP_BREAK during a running break starts the next block and counts the skip', () => {
    let s = reduce(twoBlockSession(), { type: 'START', now: NOW })
    s = reduce(s, { type: 'END_BLOCK', now: NOW + 90 * MIN })
    expect(s.run.phase).toBe('break')
    s = reduce(s, { type: 'SKIP_BREAK', now: NOW + 95 * MIN })
    expect(s.status).toBe('active')
    expect(s.run.currentBlockIndex).toBe(1)
    expect(s.run.breaksSkipped).toBe(1)
  })

  it('SKIP_BREAK after the break has elapsed is a no-op (nothing left to skip)', () => {
    let s = reduce(twoBlockSession(), { type: 'START', now: NOW })
    s = reduce(s, { type: 'END_BLOCK', now: NOW + 90 * MIN })
    s = reduce(s, { type: 'TICK', now: NOW + 111 * MIN })
    expect(reduce(s, { type: 'SKIP_BREAK', now: NOW + 112 * MIN })).toBe(s)
  })

  it('END_BREAK during a running break is a no-op (breaks are enforced)', () => {
    let s = reduce(twoBlockSession(), { type: 'START', now: NOW })
    s = reduce(s, { type: 'END_BLOCK', now: NOW + 90 * MIN })
    expect(reduce(s, { type: 'END_BREAK', now: NOW + 95 * MIN })).toBe(s)
  })

  it('ABANDON works from active and break, closing open block actuals', () => {
    const active = reduce(twoBlockSession(), { type: 'START', now: NOW })
    const abandonedFromActive = reduce(active, { type: 'ABANDON', now: NOW + 10 * MIN })
    expect(abandonedFromActive.status).toBe('abandoned')
    expect(abandonedFromActive.run.blockActuals[0]!.endedAt).toBe(NOW + 10 * MIN)

    let s = reduce(active, { type: 'END_BLOCK', now: NOW + 90 * MIN })
    s = reduce(s, { type: 'ABANDON', now: NOW + 95 * MIN })
    expect(s.status).toBe('abandoned')
  })

  it('END_INPUT records the early switch on the open block without changing its timing', () => {
    const active = reduce(twoBlockSession(), { type: 'START', now: NOW })
    const s = reduce(active, { type: 'END_INPUT', now: NOW + 12 * MIN })
    expect(s.run.blockActuals[0]!.inputEndedAt).toBe(NOW + 12 * MIN)
    expect(s.status).toBe('active')
    expect(s.run.phaseEndsAt).toBe(active.run.phaseEndsAt) // block end unchanged
  })

  it('END_INPUT is a no-op when already set, on breaks, and on planned sessions', () => {
    const planned = twoBlockSession()
    expect(reduce(planned, { type: 'END_INPUT', now: NOW })).toBe(planned)

    const active = reduce(planned, { type: 'START', now: NOW })
    const once = reduce(active, { type: 'END_INPUT', now: NOW + 5 * MIN })
    expect(reduce(once, { type: 'END_INPUT', now: NOW + 6 * MIN })).toBe(once)

    const onBreak = reduce(active, { type: 'END_BLOCK', now: NOW + 90 * MIN })
    expect(reduce(onBreak, { type: 'END_INPUT', now: NOW + 91 * MIN })).toBe(onBreak)
  })

  it('the next block starts with a fresh input leg, keeping block 1 history', () => {
    let s = reduce(twoBlockSession(), { type: 'START', now: NOW })
    s = reduce(s, { type: 'END_INPUT', now: NOW + 10 * MIN })
    s = reduce(s, { type: 'END_BLOCK', now: NOW + 90 * MIN })
    s = reduce(s, { type: 'SKIP_BREAK', now: NOW + 95 * MIN })
    expect(s.run.currentBlockIndex).toBe(1)
    expect(s.run.blockActuals[0]!.inputEndedAt).toBe(NOW + 10 * MIN)
    expect(s.run.blockActuals[1]!.inputEndedAt).toBeUndefined()
  })

  it('ABANDON is a no-op on completed sessions', () => {
    let s = reduce(
      createSession({
        id: 's2',
        userId: 'u1',
        language: 'Korean',
        blocks: [{ id: 'b1', activities: [], plannedMinutes: 90 }],
        breakMinutes: 20,
        now: NOW,
      }),
      { type: 'START', now: NOW },
    )
    s = reduce(s, { type: 'TICK', now: NOW + 90 * MIN })
    expect(s.status).toBe('completed')
    expect(reduce(s, { type: 'ABANDON', now: NOW + 91 * MIN })).toBe(s)
  })

  it('rehydration: persisted mid-block state resolves correctly on the first TICK', () => {
    // Simulates: user starts a session, closes the tab, reopens much later.
    const persisted = reduce(twoBlockSession(), { type: 'START', now: NOW })
    const rehydrated = reduce(persisted, { type: 'TICK', now: NOW + 95 * MIN })
    expect(rehydrated.status).toBe('break')
    expect(rehydrated.run.phaseEndsAt).toBe(NOW + 110 * MIN) // break window preserved
  })
})
