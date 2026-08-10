import { requireSupabase } from '../../lib/supabaseClient'
import type { Recording } from '../../domain/entities'
import type { RecordingRepo } from '../repositories'
import { baseFromRow, throwIfError, type BaseRow } from './mapping'

const BUCKET = 'recordings'

interface RecordingRow extends BaseRow {
  language: string
  mime_type: string
  duration_sec: number
  context: Recording['context']
  storage_path: string
}

function rowToRecording(row: RecordingRow): Recording {
  return {
    ...baseFromRow(row),
    language: row.language ?? '',
    mimeType: row.mime_type,
    durationSec: row.duration_sec,
    context: row.context,
    storagePath: row.storage_path,
  }
}

export const recordingRepo: RecordingRepo = {
  async get(userId, id) {
    const { data, error } = await requireSupabase()
      .from('recordings')
      .select('*')
      .eq('user_id', userId)
      .eq('id', id)
      .maybeSingle()
    throwIfError(error)
    return data ? rowToRecording(data as RecordingRow) : null
  },

  async list(userId, language) {
    let query = requireSupabase().from('recordings').select('*').eq('user_id', userId)
    if (language) query = query.eq('language', language)
    const { data, error } = await query.order('created_at', { ascending: false })
    throwIfError(error)
    return (data as RecordingRow[]).map(rowToRecording)
  },

  async create(recording, blob) {
    const sb = requireSupabase()
    const { error: uploadError } = await sb.storage
      .from(BUCKET)
      .upload(recording.storagePath, blob, { contentType: recording.mimeType })
    throwIfError(uploadError)
    const { error } = await sb.from('recordings').insert({
      id: recording.id,
      user_id: recording.userId,
      language: recording.language,
      mime_type: recording.mimeType,
      duration_sec: recording.durationSec,
      context: recording.context,
      storage_path: recording.storagePath,
    })
    throwIfError(error)
  },

  async getPlaybackUrl(recording) {
    const { data, error } = await requireSupabase()
      .storage.from(BUCKET)
      .createSignedUrl(recording.storagePath, 3600)
    throwIfError(error)
    return data!.signedUrl
  },

  async remove(recording) {
    const sb = requireSupabase()
    const { error: storageError } = await sb.storage.from(BUCKET).remove([recording.storagePath])
    throwIfError(storageError)
    const { error } = await sb.from('recordings').delete().eq('id', recording.id)
    throwIfError(error)
  },
}
