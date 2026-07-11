import { describe, expect, it } from 'vitest'
import { pickPracticeCards } from './practice'
import { newSrsState } from '../../domain/entities'
import type { Word } from '../../domain/entities'

function word(id: string, ease: number, lapses = 0): Word {
  return {
    id,
    userId: 'u1',
    createdAt: 0,
    updatedAt: 0,
    deckId: 'd1',
    term: id,
    reading: null,
    definition: '',
    exampleSentence: null,
    srs: { ...newSrsState(0), ease, lapses },
    source: { type: 'manual' },
    frequencyRank: null,
    encounterCount: 0,
  }
}

const WORDS = [word('a', 2.5), word('b', 1.3, 4), word('c', 2.8), word('d', 1.3, 1), word('e', 2.1)]

describe('pickPracticeCards', () => {
  it('respects the count and never duplicates', () => {
    const picked = pickPracticeCards(WORDS, { count: 3, order: 'random' }, () => 0.42)
    expect(picked).toHaveLength(3)
    expect(new Set(picked.map((w) => w.id)).size).toBe(3)
  })

  it('caps at the pool size and tolerates zero', () => {
    expect(pickPracticeCards(WORDS, { count: 99, order: 'random' })).toHaveLength(5)
    expect(pickPracticeCards(WORDS, { count: 0, order: 'random' })).toHaveLength(0)
  })

  it('hardest first: lowest ease, most lapses breaking ties', () => {
    const picked = pickPracticeCards(WORDS, { count: 3, order: 'hardest' })
    expect(picked.map((w) => w.id)).toEqual(['b', 'd', 'e'])
  })

  it('easiest first: highest ease', () => {
    const picked = pickPracticeCards(WORDS, { count: 2, order: 'easiest' })
    expect(picked.map((w) => w.id)).toEqual(['c', 'a'])
  })

  it('random uses the injected rng deterministically and does not mutate input', () => {
    const before = WORDS.map((w) => w.id)
    const first = pickPracticeCards(WORDS, { count: 5, order: 'random' }, () => 0.99)
    const second = pickPracticeCards(WORDS, { count: 5, order: 'random' }, () => 0.99)
    expect(first.map((w) => w.id)).toEqual(second.map((w) => w.id))
    expect(WORDS.map((w) => w.id)).toEqual(before)
  })
})
