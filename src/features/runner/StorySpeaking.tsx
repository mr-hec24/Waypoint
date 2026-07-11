import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { startRecording, extensionFor, type RecorderHandle } from '../../services/audioRecorder'
import { recordingRepo } from '../../services/supabase/recordingRepo'
import { activityLogRepo } from '../../services/supabase/logRepos'
import { StoryReviewWorkbench } from '../storyReview/StoryReviewScreen'
import type { StorySpeakingLog } from '../../domain/entities'

const PROMPTS = [
  'Tell the story of a trip you will never forget.',
  'Describe your childhood home, room by room.',
  'Talk about a person who changed how you see the world.',
  'Retell the plot of the last movie or show you loved.',
  'Describe your perfect ordinary day, morning to night.',
  'Tell the story of how you ended up learning this language.',
  'Describe a meal that means something to you, and why.',
  'Talk about a mistake that taught you something.',
]

type Phase = 'idle' | 'recording' | 'saving' | 'saved' | 'error'

export function StorySpeaking({
  userId,
  sessionId,
  language,
}: {
  userId: string
  sessionId: string
  language: string
}) {
  const [prompt] = useState(() => PROMPTS[Math.floor(Math.random() * PROMPTS.length)]!)
  const [phase, setPhase] = useState<Phase>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [savedRecordingId, setSavedRecordingId] = useState<string | null>(null)
  const handle = useRef<RecorderHandle | null>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (phase !== 'recording') return
    const id = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [phase])

  // Release the mic if the user leaves mid-recording.
  useEffect(() => () => handle.current?.cancel(), [])

  async function begin() {
    setError(null)
    try {
      handle.current = await startRecording()
      setElapsed(0)
      setPhase('recording')
    } catch (e) {
      setError((e as Error).message)
      setPhase('error')
    }
  }

  async function finish() {
    if (!handle.current) return
    setPhase('saving')
    try {
      const result = await handle.current.stop()
      handle.current = null
      const now = Date.now()
      const recordingId = crypto.randomUUID()
      await recordingRepo.create(
        {
          id: recordingId,
          userId,
          createdAt: now,
          updatedAt: now,
          language,
          mimeType: result.mimeType,
          durationSec: result.durationSec,
          context: 'story_speaking',
          storagePath: `${userId}/${recordingId}.${extensionFor(result.mimeType)}`,
        },
        result.blob,
      )
      const log: StorySpeakingLog = {
        id: crypto.randomUUID(),
        userId,
        createdAt: now,
        updatedAt: now,
        kind: 'story_speaking',
        pillar: 'output',
        language,
        sessionId,
        occurredAt: now,
        durationMinutes: Math.max(1, Math.round(result.durationSec / 60)),
        notes: '',
        details: { promptText: prompt, recordingId },
      }
      await activityLogRepo.put(log)
      // The inline workbench reads the recordings list — make sure it sees the new one.
      await queryClient.invalidateQueries({ queryKey: ['recordings', userId] })
      setSavedRecordingId(recordingId)
      setPhase('saved')
    } catch (e) {
      setError((e as Error).message)
      setPhase('error')
    }
  }

  const mm = Math.floor(elapsed / 60)
  const ss = String(elapsed % 60).padStart(2, '0')

  return (
    <div className="w-full rounded-xl border border-night-border bg-night-panel p-4">
      <p className="text-[10.5px] font-extrabold tracking-[.18em] text-[#D9A084] uppercase">
        Output · Story speaking
      </p>
      <p className="mt-1.5 text-[13.5px] text-[#C9D3C6]">{prompt}</p>

      <div className="mt-3">
        {phase === 'idle' && (
          <button
            onClick={begin}
            className="rounded-lg bg-output px-4 pt-[10px] pb-2 text-sm font-bold text-[#F7F2E8] hover:bg-output-deep"
          >
            Start recording
          </button>
        )}
        {phase === 'recording' && (
          <button
            onClick={finish}
            className="animate-pulse rounded-lg bg-output-deep px-4 pt-[10px] pb-2 text-sm font-bold text-[#F7F2E8] tabular-nums"
          >
            Stop &amp; save ({mm}:{ss})
          </button>
        )}
        {phase === 'saving' && <p className="text-sm text-night-sage">Uploading…</p>}
        {phase === 'saved' && (
          <div>
            <p className="mb-3 text-sm font-bold text-[#D9A084]">
              Saved — now review it: transcribe what you said, write what you meant, and mine
              it for flashcards.
            </p>
            {savedRecordingId && (
              <div className="rounded-xl bg-paper p-3 text-ink">
                <StoryReviewWorkbench
                  source={{ type: 'recording', recordingId: savedRecordingId }}
                />
              </div>
            )}
          </div>
        )}
        {phase === 'error' && (
          <div className="flex flex-col gap-1">
            <p className="text-sm text-[#E8A188]">{error}</p>
            <button onClick={begin} className="self-start text-sm text-[#D9A084] underline">
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
