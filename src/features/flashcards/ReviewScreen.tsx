import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { useActiveLanguage, useProfile } from '../../services/queries/profile'
import { useDecks, useGradeWord, useReviewQueue } from '../../services/queries/flashcards'
import { wordRepo } from '../../services/supabase/wordRepo'
import { pickPracticeCards, type PracticeOrder } from './practice'
import type { SrsGrade, Word } from '../../domain/entities'

const GRADES: { grade: SrsGrade; label: string; className: string }[] = [
  { grade: 0, label: 'Again', className: 'bg-output-deep hover:brightness-95' },
  { grade: 1, label: 'Hard', className: 'bg-rest hover:brightness-95' },
  { grade: 2, label: 'Good', className: 'bg-primary-700 hover:bg-primary-800' },
  { grade: 3, label: 'Easy', className: 'bg-input hover:brightness-95' },
]

export function ReviewScreen() {
  const { data: profile } = useProfile()
  const { data: queue, isLoading } = useReviewQueue(profile?.settings.newCardsPerDay ?? 10)
  const gradeWord = useGradeWord()

  // Local queue: words graded "again" come back at the end of this same session.
  const [queueState, setQueueState] = useState<{ initial: Word[]; index: number; retry: Word[] } | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [done, setDone] = useState(0)
  const [practiceCards, setPracticeCards] = useState<Word[] | null>(null)
  const [showSetup, setShowSetup] = useState(false)

  if (isLoading) return <p className="text-sm text-stone-400">Loading queue…</p>

  if (practiceCards) {
    return (
      <PracticeRunner
        cards={practiceCards}
        onExit={() => {
          setPracticeCards(null)
          setShowSetup(false)
        }}
      />
    )
  }

  const state =
    queueState ?? (queue ? { initial: queue, index: 0, retry: [] as Word[] } : null)
  if (!state) return null

  const current: Word | undefined =
    state.index < state.initial.length
      ? state.initial[state.index]
      : state.retry[state.index - state.initial.length]

  if (!current || showSetup) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        {!showSetup && (
          <>
            <span className="flex h-11 w-11 items-center justify-center rounded-full border-4 border-primary-700">
              <span className="h-3 w-3 rounded-full bg-output" />
            </span>
            <h2 className="font-display text-xl font-bold">
              {done > 0 ? `All done — ${done} cards reviewed.` : 'Nothing due right now.'}
            </h2>
            <p className="text-sm text-stone-500">
              {done > 0
                ? 'Come back when the next cards fall due.'
                : 'Add words to a deck to get started.'}
            </p>
            <Link to="/decks" className="text-sm font-bold text-primary-700 underline">
              Manage decks
            </Link>
          </>
        )}
        {showSetup && (
          <button
            onClick={() => setShowSetup(false)}
            className="self-start text-xs text-stone-500 hover:text-stone-700"
          >
            ← Back to review
          </button>
        )}
        <PracticeSetup onStart={setPracticeCards} />
      </div>
    )
  }

  function grade(g: SrsGrade) {
    if (!current) return
    gradeWord.mutate({ word: current, grade: g })
    setQueueState({
      ...state!,
      index: state!.index + 1,
      // "Again" cards get another pass at the end of this sitting.
      retry: g === 0 ? [...state!.retry, { ...current }] : state!.retry,
    })
    setRevealed(false)
    if (g !== 0) setDone((d) => d + 1)
  }

  const remaining = state.initial.length + state.retry.length - state.index

  return (
    <div className="flex flex-col items-center">
      <p className="mb-1 text-[10.5px] font-extrabold tracking-[.2em] text-stone-500 uppercase">
        {remaining} cards to go
      </p>
      <button
        onClick={() => setShowSetup(true)}
        className="mb-4 text-xs text-stone-500 underline decoration-dotted underline-offset-2 hover:text-stone-700"
      >
        Extra practice instead
      </button>

      <div className="w-full max-w-md rounded-xl border border-stone-200 bg-card px-8 py-10 text-center shadow-[0_1px_2px_rgba(42,37,28,.06)]">
        <p className="font-display text-[30px] font-bold">{current.term}</p>
        {current.reading && <p className="mt-1 text-stone-500">{current.reading}</p>}

        {revealed && (
          <div className="mt-6 flex flex-col items-center">
            <span aria-hidden className="mb-6 w-11 border-t-2 border-dashed border-[#CFC2A6]" />
            <p className="text-[17px]">{current.definition}</p>
            {current.exampleSentence && (
              <p className="font-display mt-2 text-[13.5px] text-stone-600 italic">
                {current.exampleSentence}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 w-full max-w-md">
        {!revealed ? (
          <button
            onClick={() => setRevealed(true)}
            className="w-full rounded-[10px] bg-ink px-5 pt-[15px] pb-[13px] font-bold text-[#F7F2E8] transition-colors hover:bg-stone-800"
          >
            Show answer
          </button>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {GRADES.map(({ grade: g, label, className }) => (
              <button
                key={g}
                onClick={() => grade(g)}
                className={`rounded-[9px] px-2 pt-[13px] pb-[11px] text-[13px] font-extrabold text-[#F7F2E8] transition-all ${className}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Extra practice setup — pick a deck, a count, and an order. Practice is
 * "off the record": it never touches SRS state or the review log.
 */
function PracticeSetup({ onStart }: { onStart: (cards: Word[]) => void }) {
  const { userId } = useAuth()
  const language = useActiveLanguage()
  const { data: decks } = useDecks()
  const [deckId, setDeckId] = useState<string>('')
  const [count, setCount] = useState(10)
  const [order, setOrder] = useState<PracticeOrder>('random')
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectClass =
    'rounded-lg border border-stone-300 bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-700/40'

  async function start() {
    if (!userId) return
    setStarting(true)
    setError(null)
    try {
      const pool = await wordRepo.listAll(userId, deckId ? { deckId } : { language })
      const cards = pickPracticeCards(pool, { count, order })
      if (cards.length === 0) {
        setError('No cards in that deck yet.')
        return
      }
      onStart(cards)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="mt-6 w-full max-w-md rounded-xl border border-stone-200 bg-card p-4 text-left">
      <p className="text-[10.5px] font-extrabold tracking-[.2em] text-stone-500 uppercase">
        Extra practice · off the record
      </p>
      <p className="mt-1 text-xs text-stone-500">
        Drill any cards you like — it never changes your review schedule.
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <label className="flex flex-col gap-1 text-xs text-stone-500">
          Deck
          <select value={deckId} onChange={(e) => setDeckId(e.target.value)} className={selectClass}>
            <option value="">All decks</option>
            {decks?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-stone-500">
          Cards
          <select
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className={selectClass}
          >
            {[5, 10, 20, 50].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-stone-500">
          Order
          <select
            value={order}
            onChange={(e) => setOrder(e.target.value as PracticeOrder)}
            className={selectClass}
          >
            <option value="random">Random</option>
            <option value="hardest">Hardest first</option>
            <option value="easiest">Easiest first</option>
          </select>
        </label>
      </div>
      {error && <p className="mt-2 text-sm text-output-deep">{error}</p>}
      <button
        onClick={start}
        disabled={starting}
        className="mt-3 w-full rounded-[10px] bg-primary-700 px-4 pt-[12px] pb-[10px] text-sm font-bold text-[#F7F2E8] hover:bg-primary-800 disabled:opacity-50"
      >
        {starting ? 'Picking cards…' : 'Start practice'}
      </button>
    </div>
  )
}

export function PracticeRunner({
  cards,
  onExit,
  exitLabel = 'Back to review',
}: {
  cards: Word[]
  onExit: () => void
  exitLabel?: string
}) {
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [hits, setHits] = useState(0)

  const current = cards[index]

  if (!current) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-full border-4 border-primary-700">
          <span className="h-3 w-3 rounded-full bg-output" />
        </span>
        <h2 className="font-display text-xl font-bold">
          {hits}/{cards.length} — nice drive.
        </h2>
        <p className="text-sm text-stone-500">Practice doesn&apos;t touch your schedule.</p>
        <button onClick={onExit} className="text-sm font-bold text-primary-700 underline">
          {exitLabel}
        </button>
      </div>
    )
  }

  function answer(gotIt: boolean) {
    if (gotIt) setHits((h) => h + 1)
    setIndex((i) => i + 1)
    setRevealed(false)
  }

  return (
    <div className="flex flex-col items-center">
      <p className="mb-1 text-[10.5px] font-extrabold tracking-[.2em] text-stone-500 uppercase">
        Extra practice · off the record
      </p>
      <p className="mb-4 text-xs text-stone-500">
        {cards.length - index} to go · nothing here changes your schedule
      </p>

      <div className="w-full max-w-md rounded-xl border border-stone-200 bg-card px-8 py-10 text-center shadow-[0_1px_2px_rgba(42,37,28,.06)]">
        <p className="font-display text-[30px] font-bold">{current.term}</p>
        {current.reading && <p className="mt-1 text-stone-500">{current.reading}</p>}
        {revealed && (
          <div className="mt-6 flex flex-col items-center">
            <span aria-hidden className="mb-6 w-11 border-t-2 border-dashed border-[#CFC2A6]" />
            <p className="text-[17px]">{current.definition}</p>
            {current.exampleSentence && (
              <p className="font-display mt-2 text-[13.5px] text-stone-600 italic">
                {current.exampleSentence}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 w-full max-w-md">
        {!revealed ? (
          <button
            onClick={() => setRevealed(true)}
            className="w-full rounded-[10px] bg-ink px-5 pt-[15px] pb-[13px] font-bold text-[#F7F2E8] transition-colors hover:bg-stone-800"
          >
            Show answer
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => answer(false)}
              className="rounded-[9px] border border-stone-300 bg-card px-2 pt-[13px] pb-[11px] text-[13px] font-extrabold text-stone-700 hover:bg-stone-100"
            >
              Missed it
            </button>
            <button
              onClick={() => answer(true)}
              className="rounded-[9px] bg-primary-700 px-2 pt-[13px] pb-[11px] text-[13px] font-extrabold text-[#F7F2E8] hover:bg-primary-800"
            >
              Got it
            </button>
          </div>
        )}
      </div>

      <button onClick={onExit} className="mt-6 text-xs text-stone-500 hover:text-stone-700">
        End practice
      </button>
    </div>
  )
}
