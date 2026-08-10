// Lemmatization + translation via the "vocab_build" Supabase Edge Function
// (Claude server-side; the API key never reaches the client).
//
// Only word lists cross this boundary — never the transcripts they came from.

import { supabase } from '../lib/supabaseClient'

/** Lemmas per translate call. Small enough to stay well inside the output budget. */
const TRANSLATE_BATCH = 100

export interface LemmaGroup {
  lemma: string
  surfaces: string[]
  partOfSpeech: string
  drop: boolean
  dropReason: string
}

export interface TranslatedEntry {
  lemma: string
  translation: string
  reading: string
  exampleTarget: string
  exampleNative: string
}

let availability: Promise<boolean> | null = null

export function isVocabBuildAvailable(): Promise<boolean> {
  availability ??= (async () => {
    if (!supabase) return false
    try {
      const { data, error } = await supabase.functions.invoke('vocab_build', {
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

/**
 * supabase-js collapses every non-2xx into a generic FunctionsHttpError with data:null,
 * so the function's own message is only reachable through error.context — the raw
 * Response. Without reading it the caller can never see anything but
 * "Edge Function returned a non-2xx status code".
 */
export async function errorDetail(error: unknown): Promise<string | null> {
  const context = (error as { context?: unknown }).context
  if (!(context instanceof Response)) return null
  try {
    const body = (await context.clone().json()) as { error?: unknown }
    return typeof body.error === 'string' ? body.error : null
  } catch {
    try {
      const text = await context.clone().text()
      return text.slice(0, 300) || null
    } catch {
      return null
    }
  }
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('Supabase is not configured')
  const { data, error } = await supabase.functions.invoke('vocab_build', { body })
  if (error) {
    const detail = await errorDetail(error)
    throw new Error(detail ?? `Building your list failed: ${error.message}`)
  }
  const result = data as T & { error?: string }
  if (result.error) throw new Error(result.error)
  return result
}

/** One call for the whole list, so merging decisions see every candidate at once. */
export async function normalizeCandidates(
  nativeLanguage: string,
  candidates: { surface: string; count: number }[],
): Promise<LemmaGroup[]> {
  const result = await invoke<{ groups: LemmaGroup[] }>({
    mode: 'normalize',
    nativeLanguage,
    candidates,
  })
  return result.groups ?? []
}

export async function translateLemmas(
  nativeLanguage: string,
  targetLanguage: string,
  lemmas: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<TranslatedEntry[]> {
  const entries: TranslatedEntry[] = []
  for (let i = 0; i < lemmas.length; i += TRANSLATE_BATCH) {
    const batch = lemmas.slice(i, i + TRANSLATE_BATCH)
    const result = await invoke<{ entries: TranslatedEntry[] }>({
      mode: 'translate',
      nativeLanguage,
      targetLanguage,
      lemmas: batch,
    })
    entries.push(...(result.entries ?? []))
    onProgress?.(Math.min(i + batch.length, lemmas.length), lemmas.length)
  }
  return entries
}
