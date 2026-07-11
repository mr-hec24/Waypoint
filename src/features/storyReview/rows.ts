// Pure helpers for the story-review workbench.

import type { StoryReviewRow, Word } from '../../domain/entities'
import { newSrsState } from '../../domain/entities'
import type { TranscriptSegment } from '../../services/transcription'

/** Segments shorter than this merge into the previous row (fillers like "Sí." or "Eh…"). */
const MIN_SEGMENT_CHARS = 15

export function emptyRow(id: string): StoryReviewRow {
  return { id, transcript: '', intention: '', translation: '', note: '', wordIds: [], span: null }
}

/**
 * One row per transcript segment, except very short segments, which merge into
 * the previous row (extending its time span) so rows stay sentence-sized.
 */
export function segmentsToRows(
  segments: TranscriptSegment[],
  makeId: () => string = () => crypto.randomUUID(),
): StoryReviewRow[] {
  const rows: StoryReviewRow[] = []
  for (const segment of segments) {
    const text = segment.text.trim()
    if (!text) continue
    const prev = rows[rows.length - 1]
    if (prev && text.length < MIN_SEGMENT_CHARS) {
      prev.transcript = `${prev.transcript} ${text}`
      prev.span = [prev.span?.[0] ?? segment.startSec, segment.endSec]
    } else {
      rows.push({
        ...emptyRow(makeId()),
        transcript: text,
        span: [segment.startSec, segment.endSec],
      })
    }
  }
  return rows
}

/**
 * Splits written text into sentence-sized rows for the writing review.
 * Sentence boundaries: ., !, ?, … (and newlines); short fragments merge
 * into the previous row, mirroring segmentsToRows.
 */
export function textToRows(
  text: string,
  makeId: () => string = () => crypto.randomUUID(),
): StoryReviewRow[] {
  const pieces = text
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
  const rows: StoryReviewRow[] = []
  for (const piece of pieces) {
    const prev = rows[rows.length - 1]
    if (prev && piece.length < MIN_SEGMENT_CHARS) {
      prev.transcript = `${prev.transcript} ${piece}`
    } else {
      rows.push({ ...emptyRow(makeId()), transcript: piece })
    }
  }
  return rows
}

export interface FlashcardSuggestion {
  term: string
  definition: string
  isPhrase: boolean
}

/** Build a Word for the mined-cards deck from an accepted suggestion. */
export function suggestionToWord(
  suggestion: FlashcardSuggestion,
  row: StoryReviewRow,
  source: Word['source'],
  deckId: string,
  userId: string,
  now: number,
  id: string = crypto.randomUUID(),
): Word {
  return {
    id,
    userId,
    createdAt: now,
    updatedAt: now,
    deckId,
    term: suggestion.term,
    reading: null,
    definition: suggestion.definition,
    exampleSentence: row.translation.trim() || null,
    srs: newSrsState(now),
    source,
    frequencyRank: null,
    encounterCount: 1,
  }
}
