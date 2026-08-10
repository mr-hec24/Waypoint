import { describe, expect, it } from 'vitest'
import { milestoneMessage, starterListNudge } from './messages'
import { CORPUS_CORE_TOKENS, CORPUS_SEED_TOKENS, EMPTY_ONBOARDING } from '../../domain/entities'

describe('milestoneMessage', () => {
  it('invites a first attempt on an empty corpus', () => {
    expect(milestoneMessage(0, null)).toMatch(/one prompt/i)
  })

  it('counts down to the core while below it', () => {
    expect(milestoneMessage(CORPUS_CORE_TOKENS - 500, null)).toMatch(/500 more words/)
  })

  it('calls the core captured once past it', () => {
    expect(milestoneMessage(CORPUS_CORE_TOKENS + 1, 40)).toMatch(/core captured/i)
  })

  it('says the seed is reached at the recommended size', () => {
    expect(milestoneMessage(CORPUS_SEED_TOKENS, 40)).toMatch(/seed reached/i)
  })

  it('calls diminishing returns once saturation drops, even below the seed', () => {
    // The stop signal comes from their own data, not from hitting a quota.
    expect(milestoneMessage(CORPUS_CORE_TOKENS + 100, 4)).toMatch(/diminishing returns/i)
  })

  it('does not call diminishing returns before the core is captured', () => {
    // Early on, every source is small and saturation is noisy — telling someone to stop
    // at 300 words would leave them with an unusable list.
    expect(milestoneMessage(200, 1)).toMatch(/more words/)
  })
})

describe('starterListNudge', () => {
  it('acknowledges a deliberate skip', () => {
    expect(starterListNudge({ ...EMPTY_ONBOARDING, corpusSkipped: true }, 0)).toMatch(/skipped/i)
  })

  it('invites a first build when never skipped', () => {
    expect(starterListNudge(EMPTY_ONBOARDING, 0)).toMatch(/build a starter deck/i)
  })

  it('reports part-built progress', () => {
    expect(starterListNudge(EMPTY_ONBOARDING, 1000)).toMatch(/part-built/i)
  })

  it('switches to top-up language once seeded', () => {
    expect(starterListNudge(EMPTY_ONBOARDING, CORPUS_SEED_TOKENS)).toMatch(/top up/i)
  })
})
