import { requireSupabase } from '../../lib/supabaseClient'
import type { CorpusSource, CorpusSourceKind, CorpusSourceStatus } from '../../domain/entities'
import type { CorpusRepo } from '../repositories'
import { baseFromRow, throwIfError, type BaseRow } from './mapping'

interface CorpusSourceRow extends BaseRow {
  language: string
  kind: CorpusSourceKind
  label: string
  domain: string
  prompt_id: string | null
  recording_id: string | null
  speakers: 'solo' | 'mixed'
  status: CorpusSourceStatus
  error: string | null
  transcript: string
  token_count: number
  duration_sec: number
}

function rowToSource(row: CorpusSourceRow): CorpusSource {
  return {
    ...baseFromRow(row),
    language: row.language,
    kind: row.kind,
    label: row.label,
    domain: row.domain,
    promptId: row.prompt_id,
    recordingId: row.recording_id,
    speakers: row.speakers,
    status: row.status,
    error: row.error,
    transcript: row.transcript,
    tokenCount: row.token_count,
    // numeric comes back as a string from PostgREST.
    durationSec: Number(row.duration_sec) || 0,
  }
}

export const corpusRepo: CorpusRepo = {
  async listAll(userId, language) {
    const { data, error } = await requireSupabase()
      .from('corpus_sources')
      .select('*')
      .eq('user_id', userId)
      .eq('language', language)
      .order('created_at')
    throwIfError(error)
    return (data as CorpusSourceRow[]).map(rowToSource)
  },

  async put(source) {
    const { error } = await requireSupabase().from('corpus_sources').upsert({
      id: source.id,
      user_id: source.userId,
      language: source.language,
      kind: source.kind,
      label: source.label,
      domain: source.domain,
      prompt_id: source.promptId,
      recording_id: source.recordingId,
      speakers: source.speakers,
      status: source.status,
      error: source.error,
      transcript: source.transcript,
      token_count: source.tokenCount,
      duration_sec: source.durationSec,
    })
    throwIfError(error)
  },

  async remove(id) {
    const { error } = await requireSupabase().from('corpus_sources').delete().eq('id', id)
    throwIfError(error)
  },
}
