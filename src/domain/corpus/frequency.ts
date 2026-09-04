// Turns the learner's own native speech into a personal frequency list.
// Pure: no React, no Supabase, no network. Counting runs client-side from the
// stored transcripts — ten sources is ~150KB of text, so there is nothing to cache.

import { CORPUS_DOMAIN_TOKENS } from '../entities'

/** The shape frequency counting needs from a CorpusSource — kept narrow so tests stay cheap. */
export interface CountableSource {
  transcript: string
  speakers: 'solo' | 'mixed'
  domain: string
}

export interface Candidate {
  surface: string
  count: number
  rank: number // 1-based, most frequent first
}

export interface CorpusStats {
  /** Own-speech tokens: 'mixed' sources contribute half, since Whisper can't split speakers. */
  tokens: number
  distinct: number
  /** Surfaces seen MIN_STABLE_COUNT+ times — the ones whose rank isn't noise. */
  stable: number
  estimatedCoveragePct: number
  byDomain: Record<string, number>
}

/**
 * A word needs a few sightings before its rank means anything. Below this, a surface
 * is as likely to be a one-off as a staple.
 */
export const MIN_STABLE_COUNT = 3

/** Two-way audio is one blended transcript, so only about half of it is the learner. */
const MIXED_SPEAKER_WEIGHT = 0.5

/** New distinct surfaces per 100 tokens, below which more recording adds little. */
export const SATURATION_FLOOR = 10

const FILLERS: Record<string, Set<string>> = {
  en: new Set(['uh', 'um', 'erm', 'hmm', 'mhm', 'uhhuh', 'yeah', 'ah', 'oh', 'eh']),
  es: new Set(['eh', 'este', 'mmm', 'ajá', 'aja', 'ehh']),
  fr: new Set(['euh', 'heu', 'ben', 'hein', 'bah']),
  de: new Set(['äh', 'ähm', 'hm', 'tja', 'ne']),
  pt: new Set(['né', 'ahn', 'hum', 'eh']),
  it: new Set(['eh', 'boh', 'mah', 'cioè']),
  ja: new Set(['えーと', 'あの', 'えっと', 'まあ']),
  zh: new Set(['嗯', '呃', '那个', '这个']),
}

/**
 * Whisper brackets non-speech it hears — "[laughter]", "(music)". Strip the whole span
 * before segmenting: the segmenter discards the brackets, so by token time "laughter"
 * is indistinguishable from a word the learner actually said.
 */
const TRANSCRIBER_ARTIFACTS = /[[(][^\])]*[\])]/g

function fillersFor(locale: string): Set<string> {
  return FILLERS[locale.slice(0, 2).toLowerCase()] ?? FILLERS.en
}

/**
 * Splits text into lowercased word-like tokens. Intl.Segmenter handles scripts without
 * spaces (Japanese, Chinese, Thai) for free, which a regex split would not.
 */
export function tokenize(text: string, locale: string): string[] {
  if (!text.trim()) return []
  const fillers = fillersFor(locale)
  const segmenter = new Intl.Segmenter(localeOrDefault(locale), { granularity: 'word' })
  const tokens: string[] = []
  for (const segment of segmenter.segment(text.replace(TRANSCRIBER_ARTIFACTS, ' '))) {
    if (!segment.isWordLike) continue
    const token = segment.segment.toLowerCase().trim()
    if (!token) continue
    if (fillers.has(token)) continue
    // Bare numbers carry no vocabulary value; "3" is not a word worth a flashcard.
    if (/^\d+$/.test(token)) continue
    tokens.push(token)
  }
  return tokens
}

/** Intl throws on a malformed locale, and the app allows "Other" with an empty code. */
function localeOrDefault(locale: string): string {
  try {
    return Intl.getCanonicalLocales(locale)[0] ?? 'en'
  } catch {
    return 'en'
  }
}

/** Weighted occurrence count per surface form across every source. */
export function countSurfaces(sources: CountableSource[], locale: string): Map<string, number> {
  const counts = new Map<string, number>()
  for (const source of sources) {
    const weight = source.speakers === 'mixed' ? MIXED_SPEAKER_WEIGHT : 1
    for (const token of tokenize(source.transcript, locale)) {
      counts.set(token, (counts.get(token) ?? 0) + weight)
    }
  }
  return counts
}

/** Ranked candidates, most frequent first, ties broken alphabetically so output is stable. */
export function rankCandidates(
  counts: Map<string, number>,
  opts: { minCount?: number } = {},
): Candidate[] {
  const minCount = opts.minCount ?? 1
  return [...counts.entries()]
    .filter(([, count]) => count >= minCount)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([surface, count], i) => ({ surface, count, rank: i + 1 }))
}

export function corpusStats(sources: CountableSource[], locale: string): CorpusStats {
  const counts = countSurfaces(sources, locale)
  let tokens = 0
  let stable = 0
  for (const count of counts.values()) {
    tokens += count
    if (count >= MIN_STABLE_COUNT) stable += 1
  }

  const byDomain: Record<string, number> = {}
  for (const source of sources) {
    const weight = source.speakers === 'mixed' ? MIXED_SPEAKER_WEIGHT : 1
    const key = source.domain || 'other'
    byDomain[key] = (byDomain[key] ?? 0) + tokenize(source.transcript, locale).length * weight
  }

  return {
    tokens: Math.round(tokens),
    distinct: counts.size,
    stable,
    estimatedCoveragePct: estimateCoverage(stable),
    byDomain,
  }
}

/**
 * New distinct surfaces per 100 tokens contributed by the most recent source.
 * Starts near 35–40 on an empty corpus and decays; once it is under SATURATION_FLOOR,
 * another recording session buys very little. Returns null with fewer than two sources.
 */
export function saturation(sources: CountableSource[], locale: string): number | null {
  if (sources.length < 2) return null
  const previous = sources.slice(0, -1)
  const latest = sources[sources.length - 1]

  const seen = new Set(countSurfaces(previous, locale).keys())
  const latestTokens = tokenize(latest.transcript, locale)
  if (latestTokens.length === 0) return null

  let added = 0
  for (const token of latestTokens) {
    if (!seen.has(token)) {
      seen.add(token)
      added += 1
    }
  }
  return (added / latestTokens.length) * 100
}

/**
 * Share of everyday spoken tokens the learner's stable list covers. Derived from the
 * Zipf distribution of conversational speech, where the top few hundred words do most
 * of the work: ~300 entries already covers roughly two-thirds of what people say, and
 * the climb from there is slow. Interpolated between anchor points, clamped at 92%.
 */
export function estimateCoverage(stable: number): number {
  const anchors: [entries: number, coverage: number][] = [
    [0, 0],
    [50, 35],
    [100, 45],
    [200, 58],
    [300, 66],
    [500, 74],
    [750, 80],
    [1000, 84],
    [2000, 92],
  ]
  if (stable <= 0) return 0
  const last = anchors[anchors.length - 1]
  if (stable >= last[0]) return last[1]

  for (let i = 1; i < anchors.length; i++) {
    const [hiEntries, hiCoverage] = anchors[i]
    if (stable > hiEntries) continue
    const [loEntries, loCoverage] = anchors[i - 1]
    const t = (stable - loEntries) / (hiEntries - loEntries)
    return Math.round(loCoverage + t * (hiCoverage - loCoverage))
  }
  return last[1]
}

/** Which of the learner's chosen life domains still need speech, for the balance dots. */
export function domainsCovered(stats: CorpusStats, domains: string[]): Record<string, boolean> {
  const covered: Record<string, boolean> = {}
  for (const domain of domains) {
    covered[domain] = (stats.byDomain[domain] ?? 0) >= CORPUS_DOMAIN_TOKENS
  }
  return covered
}
