import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { useProfile } from '../../services/queries/profile'
import { useDecks, useDeleteDeck, useSaveDeck } from '../../services/queries/flashcards'

export function DecksScreen() {
  const { userId } = useAuth()
  const { data: profile } = useProfile()
  const { data: decks, isLoading } = useDecks()
  const saveDeck = useSaveDeck()
  const deleteDeck = useDeleteDeck()
  const [name, setName] = useState('')

  function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || !userId) return
    const now = Date.now()
    saveDeck.mutate({
      id: crypto.randomUUID(),
      userId,
      createdAt: now,
      updatedAt: now,
      name: name.trim(),
      language: profile?.activeLanguage ?? '',
    })
    setName('')
  }

  return (
    <div>
      <h2 className="font-display mb-2 text-[27px] font-bold">Decks</h2>
      <p className="max-w-prose text-sm text-stone-500">
        Add words manually, mine them from your story reviews, or build a deck out of the
        vocabulary you already use every day.
      </p>

      <Link
        to="/vocabulary/build"
        className="mt-4 block rounded-xl border border-stone-200 bg-card px-4 py-3 hover:border-primary-700"
      >
        <p className="text-sm font-bold">Build cards from your own speech →</p>
        <p className="mt-0.5 text-xs text-stone-500">
          Talk about your day, and the words you actually say become your deck.
        </p>
      </Link>

      <form onSubmit={handleCreate} className="mt-6 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New deck name"
          className="flex-1 rounded-lg border border-stone-300 bg-card px-3.5 py-2.5 text-sm outline-none focus:border-primary-500"
        />
        <button
          type="submit"
          disabled={saveDeck.isPending || !name.trim()}
          className="rounded-lg bg-primary-700 px-4 py-2.5 text-sm font-semibold text-[#F7F2E8] transition-colors hover:bg-primary-800 disabled:opacity-50"
        >
          Create
        </button>
      </form>

      <div className="mt-6 flex flex-col gap-2">
        {isLoading && <p className="text-sm text-stone-400">Loading…</p>}
        {decks?.length === 0 && (
          <p className="rounded-xl border border-dashed border-stone-300 bg-card p-6 text-center text-sm text-stone-400">
            No decks yet — create your first one above.
          </p>
        )}
        {decks?.map((deck) => (
          <div
            key={deck.id}
            className="flex items-center justify-between rounded-xl border border-stone-200 bg-card px-4 py-3"
          >
            <Link to={`/decks/${deck.id}`} className="flex-1 font-medium hover:text-primary-700">
              {deck.name}
              {deck.language && (
                <span className="ml-2 text-xs font-normal text-stone-400">{deck.language}</span>
              )}
            </Link>
            <button
              onClick={() => {
                if (confirm(`Delete deck "${deck.name}" and all its words?`))
                  deleteDeck.mutate(deck.id)
              }}
              className="text-xs text-stone-400 hover:text-output-deep"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
