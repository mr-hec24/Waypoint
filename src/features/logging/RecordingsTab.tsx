import { useState } from 'react'
import { Link } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthProvider'
import { useActiveLanguage } from '../../services/queries/profile'
import { recordingRepo } from '../../services/supabase/recordingRepo'
import { AudioPlayer } from '../../components/AudioPlayer'
import { useStoryReviews } from '../../services/queries/storyReviews'
import type { Recording, StoryReview } from '../../domain/entities'

export function RecordingsTab() {
  const { userId } = useAuth()
  const language = useActiveLanguage()
  const queryClient = useQueryClient()
  const { data: recordings, isLoading } = useQuery({
    queryKey: ['recordings', userId, language],
    queryFn: () => recordingRepo.list(userId!, language!),
    enabled: Boolean(userId && language),
  })
  const { data: reviews } = useStoryReviews()
  const reviewByRecording = new Map(reviews?.map((r) => [r.recordingId, r]) ?? [])
  const deleteRecording = useMutation({
    mutationFn: (r: Recording) => recordingRepo.remove(r),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recordings', userId] }),
  })

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-stone-500">
        Your story-speaking takes. Listen back and judge your own progress — no scores here.
      </p>
      {isLoading && <p className="text-sm text-stone-400">Loading…</p>}
      {recordings?.length === 0 && (
        <p className="rounded-xl border border-dashed border-stone-300 bg-card p-6 text-center text-sm text-stone-400">
          No recordings yet — they&apos;re created during story-speaking activities in a session.
        </p>
      )}
      {recordings?.map((r) => (
        <RecordingRow
          key={r.id}
          recording={r}
          review={reviewByRecording.get(r.id)}
          onDelete={() => deleteRecording.mutate(r)}
        />
      ))}
    </div>
  )
}

function RecordingRow({
  recording,
  review,
  onDelete,
}: {
  recording: Recording
  review: StoryReview | undefined
  onDelete: () => void
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadUrl() {
    setLoading(true)
    setError(null)
    try {
      setUrl(await recordingRepo.getPlaybackUrl(recording))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const mins = Math.floor(recording.durationSec / 60)
  const secs = String(Math.round(recording.durationSec % 60)).padStart(2, '0')

  return (
    <div className="rounded-xl border border-stone-200 bg-card px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">
            {new Date(recording.createdAt).toLocaleString()}
          </p>
          <p className="text-xs text-stone-500">
            {mins}:{secs} · {recording.context.replace('_', ' ')}
            {review && (
              <span
                className={`ml-2 rounded-full px-2 pt-[3px] pb-[1px] text-[10px] font-extrabold tracking-[.08em] uppercase ${
                  review.status === 'reviewed'
                    ? 'bg-primary-700 text-[#F7F2E8]'
                    : 'border border-rest text-rest-text'
                }`}
              >
                {review.status === 'reviewed' ? 'Reviewed' : 'In review'}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to={`/recordings/${recording.id}/review`}
            className="rounded-lg border border-output px-3 pt-[7px] pb-[5px] text-sm font-bold text-output hover:bg-output/10"
          >
            {review ? 'Continue review' : 'Review'}
          </Link>
          {!url && (
            <button
              onClick={loadUrl}
              disabled={loading}
              className="rounded-lg bg-primary-50 px-3 pt-[7px] pb-[5px] text-sm font-bold text-primary-700 hover:bg-primary-100 disabled:opacity-50"
            >
              {loading ? '…' : 'Play'}
            </button>
          )}
          <button
            onClick={() => {
              if (confirm('Delete this recording?')) onDelete()
            }}
            className="text-xs text-stone-500 hover:text-output-deep"
          >
            Delete
          </button>
        </div>
      </div>
      {url && (
        <div className="mt-3">
          <AudioPlayer src={url} durationSec={recording.durationSec} />
        </div>
      )}
      {error && <p className="mt-2 text-sm text-output-deep">{error}</p>}
    </div>
  )
}
