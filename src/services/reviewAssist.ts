// Corrections + flashcard suggestions via the "review-assist" Supabase Edge
// Function (Claude server-side; the API key never reaches the client).

import { supabase } from '../lib/supabaseClient'
import type { FlashcardSuggestion } from '../features/storyReview/rows'

export interface AssistInputRow {
  id: string
  transcript: string
  intention: string
}

export interface AssistResultRow {
  rowId: string
  corrected: string
  explanation: string
  flashcards: FlashcardSuggestion[]
}

let availability: Promise<boolean> | null = null

export function isReviewAssistAvailable(): Promise<boolean> {
  availability ??= (async () => {
    if (!supabase) return false
    try {
      const { data, error } = await supabase.functions.invoke('review_assist', {
        body: { ping: true },
      })
      if (error) return false
      return Boolean((data as { available?: boolean })?.available)
    } catch {
      return false
    }
  })()
  return availability
}

export async function requestCorrections(
  targetLanguage: string,
  rows: AssistInputRow[],
): Promise<AssistResultRow[]> {
  if (!supabase) throw new Error('Supabase is not configured')
  const { data, error } = await supabase.functions.invoke('review_assist', {
    body: { targetLanguage, rows },
  })
  if (error) throw new Error(`Corrections failed: ${error.message}`)
  const result = data as { rows: AssistResultRow[]; error?: string }
  if (result.error) throw new Error(result.error)
  return result.rows
}
