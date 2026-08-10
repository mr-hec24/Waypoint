import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useActiveLanguage, useProfile } from '../../services/queries/profile'
import { useSaveDeck } from '../../services/queries/flashcards'
import { deckRepo } from '../../services/supabase/deckRepo'
import { wordRepo } from '../../services/supabase/wordRepo'
import {
  isVocabBuildAvailable,
  normalizeCandidates,
  translateLemmas,
  type TranslatedEntry,
} from '../../services/vocabBuild'
import {
  countSurfaces,
  rankCandidates,
  MIN_STABLE_COUNT,
  type CountableSource,
} from '../../domain/corpus/frequency'
import { newSrsState, type CorpusSource, type Word } from '../../domain/entities'

/** The deck personal-corpus cards land in, mirroring the "From stories" convention. */
const CORPUS_DECK_NAME = 'Your words'

/** Beyond this, one build gets expensive and slow; the rest waits for the next pass. */
const MAX_ENTRIES_PER_BUILD = 600

interface Row extends TranslatedEntry {
  count: number
  rank: number
  keep: boolean
}

type Phase = 'checking' | 'unavailable' | 'normalizing' | 'translating' | 'review' | 'saving' | 'error'

interface Props {
  sources: CorpusSource[]
  locale: string
  onCancel: () => void
  onFinished: () => void
}

export function ListReview({ sources, locale, onCancel, onFinished }: Props) {
  const { userId } = useAuth()
  const language = useActiveLanguage()
  const { data: profile } = useProfile()
  const saveDeck = useSaveDeck()

  const [phase, setPhase] = useState<Phase>('checking')
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [rows, setRows] = useState<Row[]>([])
  const [error, setError] = useState<string | null>(null)

  const nativeName = profile?.nativeLanguage.name || 'your language'

  // The ranked list the AI never sees in raw form — only surfaces and counts leave.
  const candidates = useMemo(() => {
    const countable: CountableSource[] = sources.map((s) => ({
      transcript: s.transcript,
      speakers: s.speakers,
      domain: s.domain,
    }))
    return rankCandidates(countSurfaces(countable, locale), { minCount: MIN_STABLE_COUNT })
      .slice(0, MAX_ENTRIES_PER_BUILD)
      .map((c) => ({ surface: c.surface, count: Math.round(c.count), rank: c.rank }))
  }, [sources, locale])

  useEffect(() => {
    let cancelled = false

    async function build() {
      if (!profile || !language) return
      if (!(await isVocabBuildAvailable())) {
        if (!cancelled) setPhase('unavailable')
        return
      }
      try {
        if (!cancelled) setPhase('normalizing')
        const groups = await normalizeCandidates(
          nativeName,
          candidates.map((c) => ({ surface: c.surface, count: c.count })),
        )
        if (cancelled) return

        // Roll each group's surface counts up to its lemma, then re-rank on the merged totals:
        // "go" beating "went" individually is not the same as "go" as a lemma.
        const countBySurface = new Map(candidates.map((c) => [c.surface, c.count]))
        const kept = groups
          .filter((g) => !g.drop && g.lemma.trim())
          .map((g) => ({
            lemma: g.lemma,
            count: g.surfaces.reduce((sum, s) => sum + (countBySurface.get(s) ?? 0), 0),
          }))
          .sort((a, b) => b.count - a.count || a.lemma.localeCompare(b.lemma))

        if (kept.length === 0) {
          if (!cancelled) {
            setError('Nothing usable came back. Try adding more speech first.')
            setPhase('error')
          }
          return
        }

        if (!cancelled) {
          setPhase('translating')
          setProgress({ done: 0, total: kept.length })
        }
        const translated = await translateLemmas(
          nativeName,
          language,
          kept.map((k) => k.lemma),
          (done, total) => {
            if (!cancelled) setProgress({ done, total })
          },
        )
        if (cancelled) return

        const byLemma = new Map(translated.map((t) => [t.lemma, t]))
        setRows(
          kept
            .map((k, i) => {
              const entry = byLemma.get(k.lemma)
              if (!entry) return null
              return { ...entry, count: k.count, rank: i + 1, keep: true }
            })
            .filter((r): r is Row => r !== null),
        )
        setPhase('review')
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message)
          setPhase('error')
        }
      }
    }

    void build()
    return () => {
      cancelled = true
    }
  }, [candidates, nativeName, language, profile])

  async function createCards() {
    if (!userId || !language) return
    setPhase('saving')
    try {
      const decks = await deckRepo.listAll(userId, language)
      let deckId = decks.find((d) => d.name === CORPUS_DECK_NAME)?.id
      if (!deckId) {
        const now = Date.now()
        deckId = crypto.randomUUID()
        await saveDeck.mutateAsync({
          id: deckId,
          userId,
          createdAt: now,
          updatedAt: now,
          name: CORPUS_DECK_NAME,
          language,
        })
      }

      // Don't duplicate a term the learner already has in this deck from an earlier build.
      const existing = new Set((await wordRepo.listByDeck(userId, deckId)).map((w) => w.term))

      for (const row of rows) {
        if (!row.keep || existing.has(row.translation)) continue
        const now = Date.now()
        const word: Word = {
          id: crypto.randomUUID(),
          userId,
          createdAt: now,
          updatedAt: now,
          deckId,
          term: row.translation,
          reading: row.reading || null,
          definition: row.lemma,
          exampleSentence: row.exampleTarget || null,
          srs: newSrsState(now),
          source: { type: 'corpus' },
          // Their personal rank, not a generic corpus rank.
          frequencyRank: row.rank,
          encounterCount: row.count,
        }
        await wordRepo.put(word)
      }
      onFinished()
    } catch (e) {
      setError((e as Error).message)
      setPhase('error')
    }
  }

  const keepCount = rows.filter((r) => r.keep).length

  if (phase === 'checking' || phase === 'normalizing' || phase === 'translating') {
    return (
      <Busy
        title={phase === 'translating' ? 'Translating your words' : 'Sorting your words'}
        detail={
          phase === 'translating'
            ? `${progress.done} of ${progress.total}`
            : `${candidates.length} candidates from your own speech`
        }
        onCancel={onCancel}
      />
    )
  }

  if (phase === 'unavailable') {
    return (
      <Shell onCancel={onCancel}>
        <p className="text-sm text-stone-600">
          Building the list needs the translation service, which isn&apos;t configured on this
          deployment yet. Your recordings are saved — come back once it&apos;s set up.
        </p>
      </Shell>
    )
  }

  if (phase === 'error') {
    return (
      <Shell onCancel={onCancel}>
        <p className="text-sm text-output-deep">{error}</p>
      </Shell>
    )
  }

  return (
    <Shell onCancel={onCancel}>
      <p className="max-w-prose text-sm text-stone-500">
        These are your most-used words, ranked by how often you actually said them. Untick anything
        you don&apos;t want. They&apos;ll enter your reviews a few a day, not all at once.
      </p>

      <ul className="mt-4 flex flex-col gap-1.5">
        {rows.map((row) => (
          <li
            key={row.lemma}
            className={`rounded-xl border p-3 ${
              row.keep ? 'border-stone-200 bg-card' : 'border-stone-200 bg-paper opacity-50'
            }`}
          >
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={row.keep}
                onChange={() =>
                  setRows((prev) =>
                    prev.map((r) => (r.lemma === row.lemma ? { ...r, keep: !r.keep } : r)),
                  )
                }
                className="mt-1"
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-[15px] font-bold text-ink">{row.translation}</span>
                  {row.reading && (
                    <span className="text-xs text-stone-500">{row.reading}</span>
                  )}
                  <span className="text-sm text-stone-600">{row.lemma}</span>
                  <span className="ml-auto text-xs text-stone-400">
                    #{row.rank} · said {row.count}×
                  </span>
                </span>
                {row.exampleTarget && (
                  <span className="mt-1 block text-xs text-stone-500">
                    {row.exampleTarget}
                    {row.exampleNative && ` — ${row.exampleNative}`}
                  </span>
                )}
              </span>
            </label>
          </li>
        ))}
      </ul>

      <div className="sticky bottom-0 mt-5 flex flex-wrap items-center gap-3 border-t border-stone-200 bg-paper py-4">
        <button
          type="button"
          disabled={keepCount === 0 || phase === 'saving'}
          onClick={createCards}
          className="rounded-[10px] bg-primary-700 px-5 pt-[16px] pb-[14px] text-[15px] font-bold text-[#F7F2E8] transition-colors hover:bg-primary-800 disabled:opacity-50"
        >
          {phase === 'saving' ? 'Creating…' : `Create ${keepCount} cards`}
        </button>
        <span className="text-xs text-stone-500">They go into a deck called “{CORPUS_DECK_NAME}”.</span>
      </div>
    </Shell>
  )
}

function Shell({ children, onCancel }: { children: React.ReactNode; onCancel: () => void }) {
  return (
    <div className="mx-auto min-h-dvh max-w-2xl p-5 pb-20">
      <header className="mb-4 flex items-start justify-between gap-4">
        <h1 className="font-display text-[27px] font-bold">Your list</h1>
        <button
          type="button"
          onClick={onCancel}
          className="shrink-0 text-sm font-medium text-stone-500 hover:text-ink"
        >
          Back
        </button>
      </header>
      {children}
    </div>
  )
}

function Busy({
  title,
  detail,
  onCancel,
}: {
  title: string
  detail: string
  onCancel: () => void
}) {
  return (
    <Shell onCancel={onCancel}>
      <div className="rounded-xl border border-stone-200 bg-card p-6 text-center">
        <p className="font-display text-[19px] font-bold text-ink">{title}</p>
        <p className="mt-1 text-sm text-stone-500">{detail}</p>
        <p className="mt-3 text-xs text-stone-400">
          Only the word list is sent for translation — never your recordings or transcripts.
        </p>
      </div>
    </Shell>
  )
}
