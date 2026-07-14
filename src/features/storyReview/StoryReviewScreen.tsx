import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthProvider'
import { useProfile } from '../../services/queries/profile'
import {
  useStoryReview,
  useWritingReview,
  useSaveStoryReview,
} from '../../services/queries/storyReviews'
import { useSaveDeck, useSaveWord } from '../../services/queries/flashcards'
import { deckRepo } from '../../services/supabase/deckRepo'
import { recordingRepo } from '../../services/supabase/recordingRepo'
import { activityLogRepo } from '../../services/supabase/logRepos'
import { AudioPlayer } from '../../components/AudioPlayer'
import { transcription } from '../../services/transcription'
import {
  isReviewAssistAvailable,
  requestCorrections,
  type AssistResultRow,
} from '../../services/reviewAssist'
import {
  emptyRow,
  segmentsToRows,
  textToRows,
  suggestionToWord,
  type FlashcardSuggestion,
} from './rows'
import { activeJourney } from '../../domain/entities'
import type { StoryReview, StoryReviewRow, Word } from '../../domain/entities'

const STORY_DECK_NAME = 'From stories'

const cellClass =
  'w-full resize-y rounded-lg border border-stone-200 bg-[#FFFDF8] px-2.5 py-2 text-[13.5px] outline-none placeholder:text-[#B0A48C] focus:ring-2 focus:ring-primary-700/40'

/** What a review is anchored to: a story recording or a saved piece of writing. */
export type ReviewSource =
  | { type: 'recording'; recordingId: string }
  | { type: 'writing'; logId: string }

export function StoryReviewScreen() {
  const { recordingId } = useParams()
  return (
    <div className="mx-auto min-h-dvh w-full max-w-5xl px-4 py-6 md:px-8">
      <Link to="/logs" className="text-xs text-stone-500 hover:text-stone-700">
        ← Logs
      </Link>
      <h2 className="font-display mb-4 text-[27px] font-bold">Story review</h2>
      <StoryReviewWorkbench
        source={recordingId ? { type: 'recording', recordingId } : undefined}
      />
    </div>
  )
}

export function WritingReviewScreen() {
  const { logId } = useParams()
  return (
    <div className="mx-auto min-h-dvh w-full max-w-5xl px-4 py-6 md:px-8">
      <Link to="/logs" className="text-xs text-stone-500 hover:text-stone-700">
        ← Logs
      </Link>
      <h2 className="font-display mb-4 text-[27px] font-bold">Writing review</h2>
      <StoryReviewWorkbench source={logId ? { type: 'writing', logId } : undefined} />
    </div>
  )
}

/**
 * The three-column workbench (said/wrote · meant · correct). Used standalone
 * via the review screens and embedded inside the session runner's output leg.
 */
export function StoryReviewWorkbench({
  source,
  onCardAdded,
}: {
  source: ReviewSource | undefined
  /** Fired after a mined flashcard is saved — lets the host collect the words. */
  onCardAdded?: (word: Word) => void
}) {
  const { userId } = useAuth()
  const { data: profile } = useProfile()

  const recordingId = source?.type === 'recording' ? source.recordingId : undefined
  const writingLogId = source?.type === 'writing' ? source.logId : undefined

  const { data: recordings } = useQuery({
    queryKey: ['recordings', userId],
    queryFn: () => recordingRepo.list(userId!),
    enabled: Boolean(userId && recordingId),
  })
  const recording = recordings?.find((r) => r.id === recordingId)

  const { data: writingLog, isLoading: writingLoading } = useQuery({
    queryKey: ['activityLog', userId, writingLogId],
    queryFn: () => activityLogRepo.get(userId!, writingLogId!),
    enabled: Boolean(userId && writingLogId),
  })
  const writingDetails =
    writingLog?.kind === 'writing' ? writingLog.details : null

  const recordingReview = useStoryReview(recordingId)
  const writingReview = useWritingReview(writingLogId)
  const savedReview = recordingId ? recordingReview.data : writingReview.data
  const reviewLoading = recordingId ? recordingReview.isLoading : writingReview.isLoading
  const saveReview = useSaveStoryReview()

  // Local working copy; autosaved with a debounce.
  const [review, setReview] = useState<StoryReview | null>(null)
  const initialized = useRef(false)
  useEffect(() => {
    if (initialized.current || reviewLoading || !userId || !source) return
    initialized.current = true
    setReview(
      savedReview ?? {
        id: crypto.randomUUID(),
        userId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        recordingId: recordingId ?? null,
        writingLogId: writingLogId ?? null,
        status: 'draft',
        rows: [],
      },
    )
  }, [savedReview, reviewLoading, userId, source, recordingId, writingLogId])

  // Debounced autosave + flush on unmount.
  const dirty = useRef(false)
  const latest = useRef<StoryReview | null>(null)
  latest.current = review
  const saveMutate = saveReview.mutate
  useEffect(() => {
    if (!review || !dirty.current) return
    const t = setTimeout(() => {
      dirty.current = false
      saveMutate(review)
    }, 1500)
    return () => clearTimeout(t)
  }, [review, saveMutate])
  useEffect(
    () => () => {
      if (dirty.current && latest.current) saveMutate(latest.current)
    },
    [saveMutate],
  )

  function update(mutate: (r: StoryReview) => StoryReview) {
    dirty.current = true
    setReview((r) => (r ? mutate(r) : r))
  }

  const updateRow = (rowId: string, patch: Partial<StoryReviewRow>) =>
    update((r) => ({
      ...r,
      rows: r.rows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)),
    }))

  // ---- audio playback ----
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!recording) return
    recordingRepo
      .getPlaybackUrl(recording)
      .then(setAudioUrl)
      .catch(() => setAudioUrl(null))
  }, [recording])

  // The language this review works in: from its source, falling back to the
  // active journey (so a Japanese recording is reviewed in Japanese even
  // while the Korean journey is active).
  const reviewLanguage =
    recording?.language ||
    writingLog?.language ||
    (profile ? (activeJourney(profile)?.language ?? '') : '')

  // ---- transcription ----
  const [canTranscribe, setCanTranscribe] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  useEffect(() => {
    void transcription.isAvailable().then(setCanTranscribe)
  }, [])

  async function handleTranscribe() {
    if (!recording) return
    setTranscribing(true)
    setError(null)
    try {
      const result = await transcription.transcribe(recording, reviewLanguage)
      update((r) => ({ ...r, rows: segmentsToRows(result.segments) }))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setTranscribing(false)
    }
  }

  // ---- corrections ----
  const [canAssist, setCanAssist] = useState(false)
  const [assisting, setAssisting] = useState(false)
  const [suggestions, setSuggestions] = useState<Record<string, FlashcardSuggestion[]>>({})
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    void isReviewAssistAvailable().then(setCanAssist)
  }, [])

  const pendingRows = review?.rows.filter((r) => r.intention.trim() && !r.translation.trim()) ?? []

  async function handleAssist() {
    if (!review || pendingRows.length === 0) return
    setAssisting(true)
    setError(null)
    try {
      const results = await requestCorrections(
        reviewLanguage,
        pendingRows.map((r) => ({ id: r.id, transcript: r.transcript, intention: r.intention })),
      )
      const byId = new Map<string, AssistResultRow>(results.map((res) => [res.rowId, res]))
      update((r) => ({
        ...r,
        rows: r.rows.map((row) => {
          const res = byId.get(row.id)
          return res ? { ...row, translation: res.corrected, note: res.explanation } : row
        }),
      }))
      setSuggestions((prev) => {
        const next = { ...prev }
        for (const res of results) if (res.flashcards.length > 0) next[res.rowId] = res.flashcards
        return next
      })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setAssisting(false)
    }
  }

  // ---- flashcards ----
  const saveDeck = useSaveDeck()
  const saveWord = useSaveWord()

  // One mined-cards deck per language, fetched fresh so reviews in a
  // non-active language still land in the right deck.
  const ensureStoryDeck = useCallback(async (): Promise<string> => {
    const decks = await deckRepo.listAll(userId!, reviewLanguage)
    const existing = decks.find((d) => d.name === STORY_DECK_NAME)
    if (existing) return existing.id
    const now = Date.now()
    const deck = {
      id: crypto.randomUUID(),
      userId: userId!,
      createdAt: now,
      updatedAt: now,
      name: STORY_DECK_NAME,
      language: reviewLanguage,
    }
    await saveDeck.mutateAsync(deck)
    return deck.id
  }, [userId, reviewLanguage, saveDeck])

  const [addedTerms, setAddedTerms] = useState<Set<string>>(new Set())

  async function handleAddCard(row: StoryReviewRow, suggestion: FlashcardSuggestion) {
    if (!userId || !source) return
    setError(null)
    try {
      const deckId = await ensureStoryDeck()
      const wordSource: Word['source'] =
        source.type === 'recording'
          ? { type: 'voice_memo', recordingId: source.recordingId, transcriptSpan: row.span ?? [0, 0] }
          : { type: 'writing', logId: source.logId }
      const word = suggestionToWord(suggestion, row, wordSource, deckId, userId, Date.now())
      await saveWord.mutateAsync(word)
      updateRow(row.id, { wordIds: [...row.wordIds, word.id] })
      setAddedTerms((prev) => new Set(prev).add(`${row.id}:${suggestion.term}`))
      onCardAdded?.(word)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  // ---- render ----
  const sourceMissing =
    (recordingId && recordings && !recording) ||
    (writingLogId && !writingLoading && writingLog === null)
  if (!review || sourceMissing) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-6">
        {sourceMissing ? (
          <p className="font-medium">
            {recordingId ? 'Recording not found.' : 'Writing not found.'}
          </p>
        ) : (
          <p className="text-sm text-stone-400">Loading review…</p>
        )}
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="mb-4 flex items-center justify-between">
        {recording ? (
          <p className="text-xs text-stone-400">
            {new Date(recording.createdAt).toLocaleString()} ·{' '}
            {Math.round(recording.durationSec / 60)} min
          </p>
        ) : writingLog ? (
          <p className="text-xs text-stone-400">
            {new Date(writingLog.occurredAt).toLocaleString()} · {writingLog.durationMinutes} min
            of writing
          </p>
        ) : (
          <span />
        )}
        <button
          onClick={() =>
            update((r) => ({ ...r, status: r.status === 'draft' ? 'reviewed' : 'draft' }))
          }
          className={`rounded-full px-4 pt-[7px] pb-[5px] text-[11px] font-extrabold tracking-[.12em] uppercase ${
            review.status === 'reviewed'
              ? 'bg-primary-700 text-[#F7F2E8]'
              : 'bg-[#F1E4C3] text-rest-text'
          }`}
        >
          {review.status === 'reviewed' ? '✓ Reviewed' : 'Mark reviewed'}
        </button>
      </div>

      {audioUrl && (
        <div className="mb-6">
          <AudioPlayer src={audioUrl} durationSec={recording?.durationSec} />
        </div>
      )}

      {/* Writing source: the original text is the reference material. */}
      {writingDetails && (
        <div className="mb-6 rounded-xl border border-stone-200 bg-card p-4">
          <p className="text-[10px] font-extrabold tracking-[.16em] text-stone-500 uppercase">
            Your writing
          </p>
          {writingDetails.promptText && (
            <p className="font-display mt-1 text-[12.5px] text-stone-600 italic">
              Prompt — {writingDetails.promptText}
            </p>
          )}
          <p className="mt-2 text-[13.5px] leading-relaxed whitespace-pre-wrap">
            {writingDetails.text}
          </p>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {recordingId && canTranscribe && review.rows.length === 0 && (
          <button
            onClick={handleTranscribe}
            disabled={transcribing}
            className="rounded-[10px] bg-primary-700 px-4 pt-[11px] pb-[9px] text-sm font-bold text-[#F7F2E8] hover:bg-primary-800 disabled:opacity-50"
          >
            {transcribing ? 'Transcribing…' : 'Transcribe recording'}
          </button>
        )}
        {writingDetails && review.rows.length === 0 && (
          <button
            onClick={() =>
              update((r) => ({ ...r, rows: textToRows(writingDetails.text) }))
            }
            className="rounded-[10px] bg-primary-700 px-4 pt-[11px] pb-[9px] text-sm font-bold text-[#F7F2E8] hover:bg-primary-800"
          >
            Split into rows
          </button>
        )}
        {canAssist && pendingRows.length > 0 && (
          <button
            onClick={handleAssist}
            disabled={assisting}
            className="rounded-[10px] bg-output px-4 pt-[11px] pb-[9px] text-sm font-bold text-[#F7F2E8] hover:bg-output-deep disabled:opacity-50"
          >
            {assisting
              ? 'Thinking…'
              : `Get corrections · ${pendingRows.length} row${pendingRows.length > 1 ? 's' : ''}`}
          </button>
        )}
        <button
          onClick={() => update((r) => ({ ...r, rows: [...r.rows, emptyRow(crypto.randomUUID())] }))}
          className="rounded-[10px] border border-stone-300 bg-card px-4 pt-[11px] pb-[9px] text-sm font-bold text-stone-700 hover:bg-stone-100"
        >
          + Add row
        </button>
      </div>

      {error && <p className="mb-4 text-sm text-output-deep">{error}</p>}

      {review.rows.length === 0 && (
        <p className="rounded-xl border border-dashed border-stone-300 bg-card p-8 text-center text-sm text-stone-400">
          {writingDetails
            ? 'Split your writing into rows, then work through each sentence.'
            : canTranscribe
              ? 'Transcribe the recording, or add rows manually while listening back.'
              : 'Listen back and add a row for each sentence you said.'}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {review.rows.map((row, i) => (
          <div key={row.id} className="rounded-xl border border-stone-200 bg-card p-3.5">
            <div className="grid gap-2 md:grid-cols-3">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-extrabold tracking-[.16em] text-stone-500 uppercase">
                  {writingLogId ? 'What you wrote' : 'What you said'}
                </span>
                <textarea
                  rows={2}
                  value={row.transcript}
                  onChange={(e) => updateRow(row.id, { transcript: e.target.value })}
                  className={cellClass}
                  placeholder={
                    writingLogId ? 'A sentence from your writing…' : 'Transcribe what you actually said…'
                  }
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-extrabold tracking-[.16em] text-input uppercase">
                  What you meant
                </span>
                <textarea
                  rows={2}
                  value={row.intention}
                  onChange={(e) => updateRow(row.id, { intention: e.target.value })}
                  className={cellClass}
                  placeholder="What did you want to say?"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-extrabold tracking-[.16em] text-primary-700 uppercase">
                  The right way
                </span>
                <textarea
                  rows={2}
                  value={row.translation}
                  onChange={(e) => updateRow(row.id, { translation: e.target.value })}
                  className={cellClass}
                  placeholder="The natural way to say it"
                />
              </label>
            </div>

            {row.note && (
              <p className="font-display mt-2 text-[12.5px] text-stone-600 italic">
                Note — {row.note}
              </p>
            )}

            {suggestions[row.id] && suggestions[row.id]!.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {suggestions[row.id]!.map((s) => {
                  const added = addedTerms.has(`${row.id}:${s.term}`)
                  return (
                    <button
                      key={s.term}
                      disabled={added}
                      onClick={() => handleAddCard(row, s)}
                      title={s.definition}
                      className={`rounded-full px-3 pt-[5px] pb-[3px] text-xs font-bold transition-colors ${
                        added
                          ? 'bg-primary-700 text-[#F7F2E8]'
                          : 'border border-output bg-transparent text-output hover:bg-output/10'
                      }`}
                    >
                      {added
                        ? `✓ ${s.term} · ${s.isPhrase ? 'phrase' : 'word'}`
                        : `+ ${s.term}`}
                    </button>
                  )
                })}
              </div>
            )}

            <div className="mt-2.5 flex gap-3 text-[11.5px] text-stone-500">
              {i > 0 && (
                <button
                  onClick={() =>
                    update((r) => {
                      const rows = [...r.rows]
                      const prev = rows[i - 1]!
                      rows[i - 1] = {
                        ...prev,
                        transcript: `${prev.transcript} ${row.transcript}`.trim(),
                        intention: `${prev.intention} ${row.intention}`.trim(),
                        translation: `${prev.translation} ${row.translation}`.trim(),
                        wordIds: [...prev.wordIds, ...row.wordIds],
                        span:
                          prev.span && row.span ? [prev.span[0], row.span[1]] : (prev.span ?? row.span),
                      }
                      rows.splice(i, 1)
                      return { ...r, rows }
                    })
                  }
                  className="hover:text-stone-700"
                >
                  ↑ Merge into previous
                </button>
              )}
              <button
                onClick={() =>
                  update((r) => ({ ...r, rows: r.rows.filter((x) => x.id !== row.id) }))
                }
                className="hover:text-output-deep"
              >
                Delete row
              </button>
            </div>
          </div>
        ))}
      </div>

      {review.rows.length > 0 && (
        <button
          onClick={() => update((r) => ({ ...r, rows: [...r.rows, emptyRow(crypto.randomUUID())] }))}
          className="mt-3 w-full rounded-[10px] border border-dashed border-[#CFC2A6] px-4 pt-[13px] pb-[11px] text-sm font-bold text-stone-500 hover:border-primary-700 hover:text-primary-700"
        >
          + Add row
        </button>
      )}

      <p className="mt-6 text-center text-xs text-stone-500">
        {saveReview.isPending ? 'Saving…' : 'Changes save automatically.'}
      </p>
    </div>
  )
}
