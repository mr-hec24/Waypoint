import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { newSrsState } from '../../domain/entities'
import { useDeckWords, useDecks, useDeleteWord, useSaveWord } from '../../services/queries/flashcards'

export function DeckDetailScreen() {
  const { deckId } = useParams()
  const { userId } = useAuth()
  const { data: decks } = useDecks()
  const { data: words, isLoading } = useDeckWords(deckId)
  const saveWord = useSaveWord()
  const deleteWord = useDeleteWord()

  const deck = decks?.find((d) => d.id === deckId)

  const [term, setTerm] = useState('')
  const [reading, setReading] = useState('')
  const [definition, setDefinition] = useState('')
  const [example, setExample] = useState('')

  function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!term.trim() || !deckId || !userId) return
    const now = Date.now()
    saveWord.mutate({
      id: crypto.randomUUID(),
      userId,
      createdAt: now,
      updatedAt: now,
      deckId,
      term: term.trim(),
      reading: reading.trim() || null,
      definition: definition.trim(),
      exampleSentence: example.trim() || null,
      srs: newSrsState(now),
      source: { type: 'manual' },
      frequencyRank: null,
      encounterCount: 0,
    })
    setTerm('')
    setReading('')
    setDefinition('')
    setExample('')
  }

  const inputClass =
    'rounded-lg border border-stone-300 bg-card px-3.5 py-2.5 text-sm outline-none focus:border-primary-500'

  return (
    <div>
      <Link to="/decks" className="text-sm text-stone-400 hover:text-stone-600">
        ← Decks
      </Link>
      <h2 className="font-display mt-1 mb-4 text-[27px] font-bold">{deck?.name ?? 'Deck'}</h2>

      <form
        onSubmit={handleAdd}
        className="flex flex-col gap-2 rounded-xl border border-stone-200 bg-card p-4"
      >
        <div className="grid grid-cols-2 gap-2">
          <input
            required
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Word / phrase"
            className={inputClass}
          />
          <input
            value={reading}
            onChange={(e) => setReading(e.target.value)}
            placeholder="Reading (optional)"
            className={inputClass}
          />
        </div>
        <input
          required
          value={definition}
          onChange={(e) => setDefinition(e.target.value)}
          placeholder="Meaning / translation"
          className={inputClass}
        />
        <input
          value={example}
          onChange={(e) => setExample(e.target.value)}
          placeholder="Example sentence (optional)"
          className={inputClass}
        />
        <button
          type="submit"
          disabled={saveWord.isPending}
          className="rounded-lg bg-primary-700 px-4 py-2.5 text-sm font-semibold text-[#F7F2E8] transition-colors hover:bg-primary-800 disabled:opacity-50"
        >
          Add word
        </button>
      </form>

      <div className="mt-6 flex flex-col gap-2">
        {isLoading && <p className="text-sm text-stone-400">Loading…</p>}
        {words?.length === 0 && (
          <p className="text-center text-sm text-stone-400">No words yet.</p>
        )}
        {words?.map((w) => (
          <div
            key={w.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-card px-4 py-3"
          >
            <div className="min-w-0">
              <p className="font-medium">
                {w.term}
                {w.reading && <span className="ml-2 text-sm text-stone-400">{w.reading}</span>}
              </p>
              <p className="truncate text-sm text-stone-500">{w.definition}</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-500">
                {w.srs.state}
              </span>
              <button
                onClick={() => deleteWord.mutate(w)}
                className="text-xs text-stone-400 hover:text-output-deep"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
