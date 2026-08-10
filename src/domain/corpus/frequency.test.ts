import { describe, expect, it } from 'vitest'
import {
  corpusStats,
  countSurfaces,
  domainsCovered,
  estimateCoverage,
  rankCandidates,
  saturation,
  tokenize,
  MIN_STABLE_COUNT,
  type CountableSource,
} from './frequency'

function solo(transcript: string, domain = 'work'): CountableSource {
  return { transcript, speakers: 'solo', domain }
}

function mixed(transcript: string, domain = 'work'): CountableSource {
  return { transcript, speakers: 'mixed', domain }
}

describe('tokenize', () => {
  it('lowercases and strips punctuation', () => {
    expect(tokenize("I went to work. Work was fine!", 'en')).toEqual([
      'i',
      'went',
      'to',
      'work',
      'work',
      'was',
      'fine',
    ])
  })

  it('drops fillers for the given locale', () => {
    expect(tokenize('um I uh went', 'en')).toEqual(['i', 'went'])
    // "este" is a Spanish filler but a real word in English — locale decides.
    expect(tokenize('este bien', 'es')).toEqual(['bien'])
    expect(tokenize('um bien', 'es')).toEqual(['um', 'bien'])
  })

  it('drops transcriber artifacts and bare numbers', () => {
    expect(tokenize('[laughter] I paid 20 euros', 'en')).toEqual(['i', 'paid', 'euros'])
  })

  it('segments scripts without spaces', () => {
    // Japanese has no word delimiters; a regex split would return one token.
    const tokens = tokenize('今日は仕事に行きました', 'ja')
    expect(tokens.length).toBeGreaterThan(2)
    expect(tokens.join('')).not.toContain(' ')
  })

  it('falls back to a default locale rather than throwing on a bad code', () => {
    expect(tokenize('hello there', '')).toEqual(['hello', 'there'])
    expect(tokenize('hello there', 'not-a-locale!!')).toEqual(['hello', 'there'])
  })

  it('returns nothing for empty input', () => {
    expect(tokenize('   ', 'en')).toEqual([])
  })
})

describe('countSurfaces', () => {
  it('sums occurrences across sources', () => {
    const counts = countSurfaces([solo('work work'), solo('work home')], 'en')
    expect(counts.get('work')).toBe(3)
    expect(counts.get('home')).toBe(1)
  })

  it('half-counts mixed-speaker sources, since Whisper cannot split speakers', () => {
    const counts = countSurfaces([mixed('work work work work')], 'en')
    expect(counts.get('work')).toBe(2)
  })
})

describe('rankCandidates', () => {
  it('orders by count, breaking ties alphabetically for stable output', () => {
    const counts = new Map([
      ['b', 2],
      ['c', 5],
      ['a', 2],
    ])
    expect(rankCandidates(counts).map((c) => c.surface)).toEqual(['c', 'a', 'b'])
    expect(rankCandidates(counts)[0].rank).toBe(1)
  })

  it('applies minCount', () => {
    const counts = new Map([
      ['common', 4],
      ['once', 1],
    ])
    expect(rankCandidates(counts, { minCount: 3 }).map((c) => c.surface)).toEqual(['common'])
  })
})

describe('corpusStats', () => {
  it('counts only surfaces at or above the stable threshold', () => {
    const stats = corpusStats([solo('a a a b b c')], 'en')
    expect(MIN_STABLE_COUNT).toBe(3)
    expect(stats.distinct).toBe(3)
    expect(stats.stable).toBe(1) // only "a" reaches 3
    expect(stats.tokens).toBe(6)
  })

  it('attributes tokens to their domain, bucketing untagged sources as other', () => {
    const stats = corpusStats([solo('one two', 'work'), solo('three', '')], 'en')
    expect(stats.byDomain.work).toBe(2)
    expect(stats.byDomain.other).toBe(1)
  })
})

describe('saturation', () => {
  it('is null until there is a previous source to compare against', () => {
    expect(saturation([], 'en')).toBeNull()
    expect(saturation([solo('all new words here')], 'en')).toBeNull()
  })

  it('reports 100 when every word in the latest source is new', () => {
    expect(saturation([solo('alpha beta'), solo('gamma delta')], 'en')).toBe(100)
  })

  it('reports 0 when the latest source repeats what is already known', () => {
    expect(saturation([solo('alpha beta'), solo('alpha beta')], 'en')).toBe(0)
  })

  it('decays as the corpus grows', () => {
    const first = [solo('alpha beta'), solo('alpha gamma')]
    const later = [solo('alpha beta'), solo('alpha gamma'), solo('alpha beta gamma delta')]
    expect(saturation(first, 'en')).toBe(50) // gamma is new of two tokens
    expect(saturation(later, 'en')).toBe(25) // only delta is new of four
  })
})

describe('estimateCoverage', () => {
  it('is zero for an empty list and monotonic as entries grow', () => {
    expect(estimateCoverage(0)).toBe(0)
    const points = [50, 100, 300, 500, 1000, 2000].map(estimateCoverage)
    for (let i = 1; i < points.length; i++) {
      expect(points[i]).toBeGreaterThan(points[i - 1])
    }
  })

  it('interpolates between anchors', () => {
    // Halfway between 200 entries (58%) and 300 entries (66%).
    expect(estimateCoverage(250)).toBe(62)
  })

  it('clamps above the top anchor', () => {
    expect(estimateCoverage(10_000)).toBe(estimateCoverage(2000))
  })
})

describe('domainsCovered', () => {
  it('fills a domain only once it clears the token threshold', () => {
    const stats = corpusStats(
      [solo(Array(500).fill('word').join(' '), 'work'), solo('a little', 'food')],
      'en',
    )
    expect(domainsCovered(stats, ['work', 'food', 'kids'])).toEqual({
      work: true,
      food: false,
      kids: false,
    })
  })
})
