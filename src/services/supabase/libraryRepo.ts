import { requireSupabase } from '../../lib/supabaseClient'
import type { LibraryItem, LibraryItemType } from '../../domain/entities'
import type { LibraryRepo } from '../repositories'
import { baseFromRow, msToIso, throwIfError, tsToMs, type BaseRow } from './mapping'

interface LibraryItemRow extends BaseRow {
  language: string
  type: LibraryItemType
  title: string
  url: string | null
  starred: boolean
  repetitions: number
  last_rep_at: string | null
}

function rowToItem(row: LibraryItemRow): LibraryItem {
  return {
    ...baseFromRow(row),
    language: row.language,
    type: row.type,
    title: row.title,
    url: row.url,
    starred: row.starred,
    // Default when the 0007 columns aren't present yet (deploy can precede the dashboard migration).
    repetitions: row.repetitions ?? 0,
    lastRepAt: row.last_rep_at ? tsToMs(row.last_rep_at) : null,
  }
}

export const libraryRepo: LibraryRepo = {
  async listAll(userId, language) {
    let query = requireSupabase().from('library_items').select('*').eq('user_id', userId)
    if (language) query = query.eq('language', language)
    const { data, error } = await query.order('created_at')
    throwIfError(error)
    return (data as LibraryItemRow[]).map(rowToItem)
  },

  async put(item) {
    const { error } = await requireSupabase().from('library_items').upsert({
      id: item.id,
      user_id: item.userId,
      language: item.language,
      type: item.type,
      title: item.title,
      url: item.url,
      starred: item.starred,
      repetitions: item.repetitions,
      last_rep_at: item.lastRepAt ? msToIso(item.lastRepAt) : null,
    })
    throwIfError(error)
  },

  async remove(id) {
    const { error } = await requireSupabase().from('library_items').delete().eq('id', id)
    throwIfError(error)
  },

  async setStarred(userId, language, id) {
    // Clear the current star for this journey first so the partial unique index never conflicts.
    const cleared = await requireSupabase()
      .from('library_items')
      .update({ starred: false })
      .eq('user_id', userId)
      .eq('language', language)
      .eq('starred', true)
    throwIfError(cleared.error)
    const starred = await requireSupabase()
      .from('library_items')
      .update({ starred: true })
      .eq('id', id)
    throwIfError(starred.error)
  },
}
