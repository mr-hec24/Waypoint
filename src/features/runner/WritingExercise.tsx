import { useRef, useState } from 'react'
import { activityLogRepo } from '../../services/supabase/logRepos'
import { StoryReviewWorkbench } from '../storyReview/StoryReviewScreen'
import type { WritingLog } from '../../domain/entities'

const WRITING_PROMPTS = [
  'Describe your day yesterday, hour by hour.',
  'Write a review of the last thing you watched or read.',
  'Explain how to cook a dish you love, step by step.',
  'Write a letter to yourself one year from now.',
  'Describe your hometown to someone who has never been there.',
  'Retell a childhood memory that still makes you smile.',
  'Argue for or against something you feel strongly about.',
  'Describe your dream trip: where, with whom, and why.',
]

export function WritingExercise({
  userId,
  sessionId,
  language,
}: {
  userId: string
  /** Null when run standalone, outside a planned session. */
  sessionId: string | null
  language: string
}) {
  const [promptIndex, setPromptIndex] = useState(() =>
    Math.floor(Math.random() * WRITING_PROMPTS.length),
  )
  const [ownPrompt, setOwnPrompt] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [focusMode, setFocusMode] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const startedAt = useRef(Date.now())
  // One log per exercise: the first save creates it, later saves update it.
  const logId = useRef<string | null>(null)

  const prompt = ownPrompt ?? WRITING_PROMPTS[promptIndex]!
  const wordCount = text.trim() === '' ? 0 : text.trim().split(/\s+/).length

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const now = Date.now()
      logId.current ??= crypto.randomUUID()
      const minutes = Math.min(120, Math.max(1, Math.round((now - startedAt.current) / 60000)))
      const log: WritingLog = {
        id: logId.current,
        userId,
        createdAt: now,
        updatedAt: now,
        kind: 'writing',
        pillar: 'output',
        language,
        sessionId,
        occurredAt: now,
        durationMinutes: minutes,
        notes: '',
        title: title.trim() || null,
        details: { promptText: prompt, text },
      }
      await activityLogRepo.put(log)
      setSavedAt(now)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const editor = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10.5px] font-extrabold tracking-[.18em] text-[#D9A084] uppercase">
            Output · Writing
          </p>
          <p className={`mt-1.5 text-[13.5px] ${focusMode ? 'text-stone-600' : 'text-[#C9D3C6]'}`}>
            {prompt}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {ownPrompt === null && !savedAt && (
            <button
              onClick={() => setPromptIndex((i) => (i + 1) % WRITING_PROMPTS.length)}
              className="text-xs text-[#D9A084] underline"
            >
              Another prompt
            </button>
          )}
          <button
            onClick={() => setFocusMode((f) => !f)}
            className={`text-xs font-bold underline decoration-dotted underline-offset-2 ${
              focusMode ? 'text-primary-700' : 'text-[#D9A084]'
            }`}
          >
            {focusMode ? 'Exit focus mode' : 'Focus mode'}
          </button>
        </div>
      </div>

      {ownPrompt === null ? (
        !savedAt && (
          <button
            onClick={() => setOwnPrompt('')}
            className={`mt-1 text-xs ${focusMode ? 'text-stone-500 hover:text-stone-700' : 'text-night-sage hover:text-[#C9D3C6]'}`}
          >
            …or write about your own topic
          </button>
        )
      ) : (
        <input
          autoFocus
          value={ownPrompt}
          onChange={(e) => setOwnPrompt(e.target.value)}
          placeholder="What do you want to write about?"
          className="mt-2 w-full rounded-lg border border-stone-300 bg-card px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-700/40"
        />
      )}

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Name this writing (optional)"
        className="mt-3 w-full rounded-lg border border-stone-300 bg-card px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-700/40"
      />

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={focusMode ? undefined : 10}
        placeholder="Write in your target language. Don't worry about mistakes — just keep going."
        className={`mt-3 w-full rounded-lg border border-stone-300 bg-card px-3.5 py-3 text-sm leading-relaxed text-ink outline-none focus:ring-2 focus:ring-primary-700/40 ${
          focusMode ? 'min-h-0 flex-1 resize-none' : 'resize-y'
        }`}
      />

      <div className="mt-2 flex items-center justify-between">
        <span className={`text-xs ${focusMode ? 'text-stone-500' : 'text-night-sage'}`}>
          {wordCount} words
          {savedAt && !saving && (
            <span className="ml-2 font-bold text-primary-700">Saved ✓</span>
          )}
        </span>
        <button
          onClick={handleSave}
          disabled={saving || text.trim().length === 0}
          className="rounded-lg bg-output px-4 pt-[10px] pb-2 text-sm font-bold text-[#F7F2E8] hover:bg-output-deep disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-[#E8A188]">{error}</p>}
    </>
  )

  if (focusMode) {
    // Distraction-free: fills the screen, hides the session timer. The session
    // keeps running on timestamps regardless.
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-paper p-5 text-ink md:p-10">
        <div className="mx-auto flex h-full w-full max-w-2xl flex-col">{editor}</div>
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="rounded-xl border border-night-border bg-night-panel p-4">{editor}</div>

      {savedAt && logId.current && (
        <div className="mt-3">
          <button
            onClick={() => setReviewing((r) => !r)}
            className="rounded-[10px] border border-output px-4 pt-[10px] pb-2 text-sm font-bold text-output hover:bg-output/10"
          >
            {reviewing ? 'Hide review' : 'Review your writing'}
          </button>
          {reviewing && (
            <div className="mt-3 rounded-xl bg-paper p-3 text-ink">
              <StoryReviewWorkbench source={{ type: 'writing', logId: logId.current }} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
