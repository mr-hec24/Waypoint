import { requireSupabase } from '../../lib/supabaseClient'
import type { Deck } from '../../domain/entities'
import type { DeckRepo } from '../repositories'
import { baseFromRow, throwIfError, type BaseRow } from './mapping'

interface DeckRow extends BaseRow {
  name: string
  language: string
}

function rowToDeck(row: DeckRow): Deck {
  return { ...baseFromRow(row), name: row.name, language: row.language }
}

export const deckRepo: DeckRepo = {
  async listAll(userId, language) {
    let query = requireSupabase().from('decks').select('*').eq('user_id', userId)
    if (language) query = query.eq('language', language)
    const { data, error } = await query.order('created_at')
    throwIfError(error)
    return (data as DeckRow[]).map(rowToDeck)
  },

  async put(deck) {
    const { error } = await requireSupabase().from('decks').upsert({
      id: deck.id,
      user_id: deck.userId,
      name: deck.name,
      language: deck.language,
    })
    throwIfError(error)
  },

  async remove(id) {
    const { error } = await requireSupabase().from('decks').delete().eq('id', id)
    throwIfError(error)
  },
}
