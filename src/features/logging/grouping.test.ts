import { describe, expect, it } from 'vitest'
import { groupHistory, groupTitle } from './grouping'
import type { ActivityLog, StorySpeakingLog } from '../../domain/entities'

function speakingLog(overrides: {
  id: string
  occurredAt: number
  title?: string | null
  attemptGroupId?: string
  attemptNumber?: number
  promptText?: string
}): StorySpeakingLog {
  return {
    id: overrides.id,
    userId: 'u1',
    createdAt: overrides.occurredAt,
    updatedAt: overrides.occurredAt,
    kind: 'story_speaking',
    pillar: 'output',
    language: 'es',
    sessionId: null,
    occurredAt: overrides.occurredAt,
    durationMinutes: 3,
    notes: '',
    title: overrides.title ?? null,
    details: {
      promptText: overrides.promptText ?? 'Retell the plot of the last movie or show you loved.',
      recordingId: `rec-${overrides.id}`,
      attemptGroupId: overrides.attemptGroupId,
      attemptNumber: overrides.attemptNumber,
    },
  }
}

function writingLog(id: string, occurredAt: number): ActivityLog {
  return {
    id,
    userId: 'u1',
    createdAt: occurredAt,
    updatedAt: occurredAt,
    kind: 'writing',
    pillar: 'output',
    language: 'es',
    sessionId: null,
    occurredAt,
    durationMinutes: 10,
    notes: '',
    title: null,
    details: { promptText: '', text: 'hola' },
  }
}

describe('groupHistory', () => {
  it('collapses attempts sharing a group id, anchored at the latest attempt', () => {
    const logs = [
      speakingLog({ id: 'take3', occurredAt: 3000, attemptGroupId: 'g1', attemptNumber: 3 }),
      writingLog('w1', 2500),
      speakingLog({ id: 'take2', occurredAt: 2000, attemptGroupId: 'g1', attemptNumber: 2 }),
      speakingLog({ id: 'take1', occurredAt: 1000, attemptGroupId: 'g1', attemptNumber: 1 }),
    ]
    const items = groupHistory(logs)
    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({ type: 'group', groupId: 'g1' })
    const group = items[0] as Extract<(typeof items)[number], { type: 'group' }>
    expect(group.attempts.map((a) => a.id)).toEqual(['take3', 'take2', 'take1'])
    expect(items[1]).toMatchObject({ type: 'single', log: { id: 'w1' } })
  })

  it('keeps separate sittings on the same prompt as separate groups', () => {
    const logs = [
      speakingLog({ id: 'b1', occurredAt: 5000, attemptGroupId: 'g2', attemptNumber: 1 }),
      speakingLog({ id: 'a2', occurredAt: 2000, attemptGroupId: 'g1', attemptNumber: 2 }),
      speakingLog({ id: 'a1', occurredAt: 1000, attemptGroupId: 'g1', attemptNumber: 1 }),
    ]
    const items = groupHistory(logs)
    expect(items.map((i) => (i.type === 'group' ? i.groupId : null))).toEqual(['g2', 'g1'])
  })

  it('passes legacy story-speaking logs (no group id) through as singles', () => {
    const items = groupHistory([speakingLog({ id: 'legacy', occurredAt: 1000 })])
    expect(items).toEqual([{ type: 'single', log: expect.objectContaining({ id: 'legacy' }) }])
  })
})

describe('groupTitle', () => {
  const attempts = (title1: string | null, title2: string | null) => [
    speakingLog({ id: 't2', occurredAt: 2000, attemptGroupId: 'g', attemptNumber: 2, title: title2 }),
    speakingLog({ id: 't1', occurredAt: 1000, attemptGroupId: 'g', attemptNumber: 1, title: title1 }),
  ]

  it('prefers any attempt with a user title', () => {
    expect(groupTitle(attempts('My Dune retelling', null))).toBe('My Dune retelling')
  })

  it('falls back to the prompt text when untitled', () => {
    expect(groupTitle(attempts(null, null))).toBe(
      'Retell the plot of the last movie or show you loved.',
    )
  })
})
