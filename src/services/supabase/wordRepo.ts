import { requireSupabase } from '../../lib/supabaseClient'
import type { Word } from '../../domain/entities'
import type { ReviewLogRepo, WordRepo } from '../repositories'
import type { ReviewLog } from '../../domain/entities'
import { baseFromRow, msToIso, throwIfError, tsToMs, type BaseRow } from './mapping'

interface WordRow extends BaseRow {
  deck_id: string
  term: string
  reading: string | null
  definition: string
  example_sentence: string | null
  ease: number
  interval_days: number
  reps: number
  lapses: number
  due: string
  srs_state: 'new' | 'learning' | 'review'
  source: Word['source']
  frequency_rank: number | null
  encounter_count: number
}

function rowToWord(row: WordRow): Word {
  return {
    ...baseFromRow(row),
    deckId: row.deck_id,
    term: row.term,
    reading: row.reading,
    definition: row.definition,
    exampleSentence: row.example_sentence,
    srs: {
      ease: row.ease,
      intervalDays: row.interval_days,
      reps: row.reps,
      lapses: row.lapses,
      due: tsToMs(row.due),
      state: row.srs_state,
    },
    source: row.source,
    frequencyRank: row.frequency_rank,
    encounterCount: row.encounter_count,
  }
}

function wordToRow(word: Word) {
  return {
    id: word.id,
    user_id: word.userId,
    deck_id: word.deckId,
    term: word.term,
    reading: word.reading,
    definition: word.definition,
    example_sentence: word.exampleSentence,
    ease: word.srs.ease,
    interval_days: word.srs.intervalDays,
    reps: word.srs.reps,
    lapses: word.srs.lapses,
    due: msToIso(word.srs.due),
    srs_state: word.srs.state,
    source: word.source,
    frequency_rank: word.frequencyRank,
    encounter_count: word.encounterCount,
  }
}

export const wordRepo: WordRepo = {
  async listAll(userId, opts) {
    // Words carry no language of their own — the deck does. Filter through an
    // inner join when scoping to a journey.
    const sb = requireSupabase()
    let query = opts?.language
      ? sb.from('words').select('*, decks!inner(language)').eq('decks.language', opts.language)
      : sb.from('words').select('*')
    query = query.eq('user_id', userId)
    if (opts?.deckId) query = query.eq('deck_id', opts.deckId)
    const { data, error } = await query.order('created_at')
    throwIfError(error)
    return (data as WordRow[]).map(rowToWord)
  },

  async listByDeck(userId, deckId) {
    const { data, error } = await requireSupabase()
      .from('words')
      .select('*')
      .eq('user_id', userId)
      .eq('deck_id', deckId)
      .order('created_at')
    throwIfError(error)
    return (data as WordRow[]).map(rowToWord)
  },

  async dueForReview(userId, language, now, limit) {
    const { data, error } = await requireSupabase()
      .from('words')
      .select('*, decks!inner(language)')
      .eq('user_id', userId)
      .eq('decks.language', language)
      .neq('srs_state', 'new')
      .lte('due', msToIso(now))
      .order('due')
      .limit(limit)
    throwIfError(error)
    return (data as WordRow[]).map(rowToWord)
  },

  async newCards(userId, language, limit) {
    const { data, error } = await requireSupabase()
      .from('words')
      .select('*, decks!inner(language)')
      .eq('user_id', userId)
      .eq('decks.language', language)
      .eq('srs_state', 'new')
      .order('created_at')
      .limit(limit)
    throwIfError(error)
    return (data as WordRow[]).map(rowToWord)
  },

  async put(word) {
    const { error } = await requireSupabase().from('words').upsert(wordToRow(word))
    throwIfError(error)
  },

  async remove(id) {
    const { error } = await requireSupabase().from('words').delete().eq('id', id)
    throwIfError(error)
  },
}

export const reviewLogRepo: ReviewLogRepo = {
  async append(log: ReviewLog) {
    const { error } = await requireSupabase().from('review_logs').insert({
      id: log.id,
      user_id: log.userId,
      word_id: log.wordId,
      reviewed_at: msToIso(log.reviewedAt),
      grade: log.grade,
      prev_interval_days: log.prevIntervalDays,
      new_interval_days: log.newIntervalDays,
      ease: log.ease,
    })
    throwIfError(error)
  },
}
