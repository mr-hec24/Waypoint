// Lemmatization + translation via the "vocab_build" Supabase Edge Function
// (Claude server-side; the API key never reaches the client).
//
// Only word lists cross this boundary — never the transcripts they came from.

import { supabase } from '../lib/supabaseClient'

// Batch sizes exist to stay inside the edge function's wall-clock budget. A single
// call over the whole list gets the worker killed with HTTP 546 long before the model
// finishes generating.
const TRANSLATE_BATCH = 60
const NORMALIZE_BATCH = 150

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

/**
 * Chunked, because one call over the whole list exceeds the edge function's budget.
 *
 * Candidates are sorted alphabetically before chunking rather than left in frequency
 * order: that puts inflections of the same word next to each other ("go", "goes",
 * "going"), so they usually land in the same chunk and can still be merged. Frequency
 * order would scatter them, and a lemma split across two chunks stays split.
 */
export async function normalizeCandidates(
  nativeLanguage: string,
  candidates: { surface: string; count: number }[],
  onProgress?: (done: number, total: number) => void,
): Promise<LemmaGroup[]> {
  const ordered = [...candidates].sort((a, b) => a.surface.localeCompare(b.surface))
  const groups: LemmaGroup[] = []

  for (let i = 0; i < ordered.length; i += NORMALIZE_BATCH) {
    const batch = ordered.slice(i, i + NORMALIZE_BATCH)
    const result = await invoke<{ groups: LemmaGroup[] }>({
      mode: 'normalize',
      nativeLanguage,
      candidates: batch,
    })
    groups.push(...(result.groups ?? []))
    onProgress?.(Math.min(i + batch.length, ordered.length), ordered.length)
  }

  return mergeGroups(groups)
}

/**
 * Folds together lemmas that different chunks reported separately. Keeps the first
 * chunk's part of speech, and only drops a lemma when every chunk agreed it was junk —
 * one chunk seeing a usable sense is enough to keep the word.
 */
export function mergeGroups(groups: LemmaGroup[]): LemmaGroup[] {
  const byLemma = new Map<string, LemmaGroup>()

  for (const group of groups) {
    const key = group.lemma.trim().toLowerCase()
    if (!key) continue
    const existing = byLemma.get(key)
    if (!existing) {
      byLemma.set(key, { ...group, surfaces: [...group.surfaces] })
      continue
    }
    for (const surface of group.surfaces) {
      if (!existing.surfaces.includes(surface)) existing.surfaces.push(surface)
    }
    if (!group.drop) {
      existing.drop = false
      existing.dropReason = ''
    }
  }

  return [...byLemma.values()]
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
