import { requireSupabase } from '../../lib/supabaseClient'
import type { StoryReview } from '../../domain/entities'
import type { StoryReviewRepo } from '../repositories'
import { baseFromRow, throwIfError, type BaseRow } from './mapping'

interface StoryReviewRow extends BaseRow {
  recording_id: string | null
  writing_log_id: string | null
  status: StoryReview['status']
  rows: StoryReview['rows']
}

function rowToStoryReview(row: StoryReviewRow): StoryReview {
  return {
    ...baseFromRow(row),
    recordingId: row.recording_id,
    writingLogId: row.writing_log_id ?? null,
    status: row.status,
    rows: row.rows,
  }
}

export const storyReviewRepo: StoryReviewRepo = {
  async getByRecording(userId, recordingId) {
    const { data, error } = await requireSupabase()
      .from('story_reviews')
      .select('*')
      .eq('user_id', userId)
      .eq('recording_id', recordingId)
      .maybeSingle()
    throwIfError(error)
    return data ? rowToStoryReview(data as StoryReviewRow) : null
  },

  async getByWritingLog(userId, writingLogId) {
    const { data, error } = await requireSupabase()
      .from('story_reviews')
      .select('*')
      .eq('user_id', userId)
      .eq('writing_log_id', writingLogId)
      .maybeSingle()
    throwIfError(error)
    return data ? rowToStoryReview(data as StoryReviewRow) : null
  },

  async listAll(userId) {
    const { data, error } = await requireSupabase()
      .from('story_reviews')
      .select('*')
      .eq('user_id', userId)
    throwIfError(error)
    return (data as StoryReviewRow[]).map(rowToStoryReview)
  },

  async put(review) {
    const { error } = await requireSupabase().from('story_reviews').upsert({
      id: review.id,
      user_id: review.userId,
      recording_id: review.recordingId,
      writing_log_id: review.writingLogId,
      status: review.status,
      rows: review.rows,
    })
    throwIfError(error)
  },
}
