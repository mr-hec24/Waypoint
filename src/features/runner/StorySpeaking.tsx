import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { startRecording, extensionFor, type RecorderHandle } from '../../services/audioRecorder'
import { recordingRepo } from '../../services/supabase/recordingRepo'
import { activityLogRepo } from '../../services/supabase/logRepos'
import { useSetLogTitle } from '../../services/queries/logs'
import { StoryReviewWorkbench } from '../storyReview/StoryReviewScreen'
import { PracticeRunner } from '../flashcards/ReviewScreen'
import type { StorySpeakingLog, Word } from '../../domain/entities'

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

type Phase = 'idle' | 'recording' | 'saving' | 'reviewing' | 'studying' | 'error'

/** One sitting's loop on one prompt: retakes share the group, a new prompt mints a new one. */
function newLoop() {
  return {
    prompt: PROMPTS[Math.floor(Math.random() * PROMPTS.length)]!,
    attemptGroupId: crypto.randomUUID(),
    attemptNumber: 1,
  }
}

export function StorySpeaking({
  userId,
  sessionId,
  language,
}: {
  userId: string
  /** Null when run standalone, outside a planned session. */
  sessionId: string | null
  language: string
}) {
  const [loop, setLoop] = useState(newLoop)
  const [phase, setPhase] = useState<Phase>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [savedRecordingId, setSavedRecordingId] = useState<string | null>(null)
  // Cards mined across every cycle of this prompt — the study step drills them all.
  const [minedWords, setMinedWords] = useState<Word[]>([])
  // One log per saved take; the group title is written to all of them.
  const [logIds, setLogIds] = useState<string[]>([])
  const [title, setTitle] = useState('')
  const lastSavedTitle = useRef<string | null>(null)
  const handle = useRef<RecorderHandle | null>(null)
  const queryClient = useQueryClient()
  const setLogTitle = useSetLogTitle()

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
        title: title.trim() || null,
        details: {
          promptText: loop.prompt,
          recordingId,
          attemptGroupId: loop.attemptGroupId,
          attemptNumber: loop.attemptNumber,
        },
      }
      await activityLogRepo.put(log)
      setLogIds((ids) => [...ids, log.id])
      // The inline workbench reads the recordings list — make sure it sees the new one.
      await queryClient.invalidateQueries({ queryKey: ['recordings', userId] })
      setSavedRecordingId(recordingId)
      setPhase('reviewing')
    } catch (e) {
      setError((e as Error).message)
      setPhase('error')
    }
  }

  function saveTitle() {
    const trimmed = title.trim()
    if (logIds.length === 0 || trimmed === (lastSavedTitle.current ?? '')) return
    lastSavedTitle.current = trimmed
    setLogTitle.mutate({ ids: logIds, title: trimmed || null })
  }

  /** Same prompt, next take. */
  function nextTake() {
    setLoop((l) => ({ ...l, attemptNumber: l.attemptNumber + 1 }))
    setSavedRecordingId(null)
    setPhase('idle')
  }

  /** Done with this story — fresh prompt, fresh group. */
  function resetLoop() {
    setLoop(newLoop())
    setMinedWords([])
    setLogIds([])
    setTitle('')
    lastSavedTitle.current = null
    setSavedRecordingId(null)
    setPhase('idle')
  }

  const mm = Math.floor(elapsed / 60)
  const ss = String(elapsed % 60).padStart(2, '0')

  return (
    <div className="w-full rounded-xl border border-night-border bg-night-panel p-4">
      <p className="text-[10.5px] font-extrabold tracking-[.18em] text-[#D9A084] uppercase">
        Output · Story speaking
      </p>
      <p className="mt-1.5 text-[13.5px] text-[#C9D3C6]">{loop.prompt}</p>
      {loop.attemptNumber > 1 && phase !== 'studying' && (
        <p className="mt-1 text-xs font-bold text-night-sage">
          Take {loop.attemptNumber} · same prompt — work the new vocab into the retelling.
        </p>
      )}

      <div className="mt-3">
        {phase === 'idle' && (
          <button
            onClick={begin}
            className="rounded-lg bg-output px-4 pt-[10px] pb-2 text-sm font-bold text-[#F7F2E8] hover:bg-output-deep"
          >
            {loop.attemptNumber > 1 ? `Record take ${loop.attemptNumber}` : 'Start recording'}
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
        {phase === 'reviewing' && (
          <div>
            <p className="mb-3 text-sm font-bold text-[#D9A084]">
              Saved — now review it: transcribe what you said, write what you meant, and mine
              it for flashcards.
            </p>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={saveTitle}
              placeholder="Name this story (optional)"
              className="mb-3 w-full rounded-lg border border-night-border bg-transparent px-3 py-2 text-sm text-[#C9D3C6] outline-none placeholder:text-night-sage focus:border-[#D9A084]"
            />
            {savedRecordingId && (
              <div key={savedRecordingId} className="rounded-xl bg-paper p-3 text-ink">
                <StoryReviewWorkbench
                  source={{ type: 'recording', recordingId: savedRecordingId }}
                  onCardAdded={(word) =>
                    setMinedWords((prev) =>
                      prev.some((w) => w.id === word.id) ? prev : [...prev, word],
                    )
                  }
                />
              </div>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {minedWords.length > 0 && (
                <button
                  onClick={() => setPhase('studying')}
                  className="rounded-lg bg-output px-4 pt-[10px] pb-2 text-sm font-bold text-[#F7F2E8] hover:bg-output-deep"
                >
                  Study {minedWords.length} card{minedWords.length > 1 ? 's' : ''}, then retake
                </button>
              )}
              <button
                onClick={nextTake}
                className={`rounded-lg px-4 pt-[10px] pb-2 text-sm font-bold ${
                  minedWords.length > 0
                    ? 'border border-output text-output hover:bg-output/10'
                    : 'bg-output text-[#F7F2E8] hover:bg-output-deep'
                }`}
              >
                Record take {loop.attemptNumber + 1}
              </button>
              <button
                onClick={resetLoop}
                className="rounded-lg border border-night-border px-4 pt-[10px] pb-2 text-sm font-bold text-night-sage hover:text-[#C9D3C6]"
              >
                Done — new prompt
              </button>
            </div>
          </div>
        )}
        {phase === 'studying' && (
          <div className="rounded-xl bg-paper p-3 pt-5 text-ink">
            <PracticeRunner cards={minedWords} exitLabel="Record next take" onExit={nextTake} />
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
