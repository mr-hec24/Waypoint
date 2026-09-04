// Copy for the coverage meter and the Today nudge, kept together so the two stay in step.
// Same split as library/reps.ts — message helpers out of the component file.

import { CORPUS_CORE_TOKENS, CORPUS_SEED_TOKENS, type OnboardingState } from '../../domain/entities'
import { SATURATION_FLOOR } from '../../domain/corpus/frequency'

/** Where they are on the way to a usable list, in one sentence. */
export function milestoneMessage(tokens: number, saturationPct: number | null): string {
  if (tokens === 0) return 'Nothing yet. One answer to one prompt is enough to start.'
  if (tokens < CORPUS_CORE_TOKENS) {
    return `Keep going — about ${CORPUS_CORE_TOKENS - tokens} more words and your core is captured.`
  }
  // The honest stopping signal: their own data says another session buys little.
  if (saturationPct !== null && saturationPct < SATURATION_FLOOR) {
    return 'Diminishing returns — that last one barely added anything new. Good place to stop; add more whenever you like.'
  }
  if (tokens < CORPUS_SEED_TOKENS) {
    return 'Core captured. Your list is usable now — more topics will sharpen it.'
  }
  return 'Recommended seed reached. Build your list, and top it up as you go.'
}

export function starterListNudge(onboarding: OnboardingState, tokens: number): string {
  if (tokens === 0) {
    return onboarding.corpusSkipped
      ? 'You skipped this at signup — ten minutes of talking gets you a first deck.'
      : 'Build a starter deck from the words you actually use.'
  }
  if (tokens < CORPUS_SEED_TOKENS) return 'Your starter list is part-built. Add another topic.'
  return 'Top up your starter list whenever you have ten minutes.'
}
