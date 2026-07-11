// Pure selection logic for extra-practice sessions. Practice is "off the
// record": nothing here (or in the practice UI) ever touches SRS state.

import type { Word } from '../../domain/entities'

export type PracticeOrder = 'random' | 'hardest' | 'easiest'

export interface PracticeConfig {
  count: number
  order: PracticeOrder
}

/**
 * Picks up to `count` words in the requested order. `rng` is injectable for
 * deterministic tests (defaults to Math.random).
 */
export function pickPracticeCards(
  words: Word[],
  config: PracticeConfig,
  rng: () => number = Math.random,
): Word[] {
  const pool = [...words]

  if (config.order === 'random') {
    // Fisher–Yates
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[pool[i], pool[j]] = [pool[j]!, pool[i]!]
    }
  } else if (config.order === 'hardest') {
    // Lowest ease first; more lapses breaks ties.
    pool.sort((a, b) => a.srs.ease - b.srs.ease || b.srs.lapses - a.srs.lapses)
  } else {
    pool.sort((a, b) => b.srs.ease - a.srs.ease || a.srs.lapses - b.srs.lapses)
  }

  return pool.slice(0, Math.max(0, config.count))
}
