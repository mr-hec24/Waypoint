import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useActiveLanguage } from '../../services/queries/profile'
import { useCourses, useSaveActivityLog } from '../../services/queries/logs'
import { PILLAR_BY_KIND, type ActivityKind, type ActivityLog } from '../../domain/entities'

const LOGGABLE: { kind: ActivityKind; label: string }[] = [
  { kind: 'immersion', label: 'Immersion' },
  { kind: 'conversation', label: 'Conversation' },
  { kind: 'writing', label: 'Writing' },
  { kind: 'course', label: 'Course progress' },
  { kind: 'story_speaking', label: 'Story speaking' },
]

const inputClass =
  'rounded-lg border border-stone-300 bg-card px-3 py-2 text-sm outline-none focus:border-primary-500'

export function QuickLogForm({ kinds }: { kinds?: ActivityKind[] }) {
  const { userId } = useAuth()
  const language = useActiveLanguage()
  const { data: courses } = useCourses()
  const saveLog = useSaveActivityLog()

  const options = kinds ? LOGGABLE.filter((o) => kinds.includes(o.kind)) : LOGGABLE
  const [kind, setKind] = useState<ActivityKind>(options[0]?.kind ?? 'immersion')
  const [minutes, setMinutes] = useState(30)
  const [notes, setNotes] = useState('')
  const [medium, setMedium] = useState<'video' | 'audio' | 'reading' | 'other'>('video')
  const [title, setTitle] = useState('')
  const [partnerType, setPartnerType] = useState<'tutor' | 'exchange' | 'self' | 'other'>('tutor')
  const [text, setText] = useState('')
  const [courseId, setCourseId] = useState('')
  const [unitLabel, setUnitLabel] = useState('')

  function buildDetails(): ActivityLog['details'] {
    switch (kind) {
      case 'immersion':
        return { medium, title }
      case 'conversation':
        return { partnerType }
      case 'writing':
        return { promptText: '', text }
      case 'course':
        return { courseId, unitLabel }
      case 'story_speaking':
        return { promptText: '', recordingId: null }
      case 'flashcards':
        return { cardsReviewed: 0, cardsCorrect: 0 }
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!userId || !language) return
    const now = Date.now()
    saveLog.mutate({
      id: crypto.randomUUID(),
      userId,
      createdAt: now,
      updatedAt: now,
      kind,
      pillar: PILLAR_BY_KIND[kind],
      language,
      sessionId: null,
      occurredAt: now,
      durationMinutes: minutes,
      notes: notes.trim(),
      title: null,
      details: buildDetails(),
    } as ActivityLog)
    setNotes('')
    setTitle('')
    setText('')
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 rounded-xl border border-stone-200 bg-card p-4"
    >
      <p className="text-xs font-semibold tracking-wide text-stone-400 uppercase">Log activity</p>
      <div className="flex gap-2">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as ActivityKind)}
          className={`flex-1 ${inputClass}`}
        >
          {options.map((o) => (
            <option key={o.kind} value={o.kind}>
              {o.label}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={1}
          value={minutes}
          onChange={(e) => setMinutes(Math.max(1, Number(e.target.value) || 0))}
          className={`w-20 ${inputClass}`}
        />
        <span className="self-center text-xs text-stone-400">min</span>
      </div>

      {kind === 'immersion' && (
        <div className="flex gap-2">
          <select
            value={medium}
            onChange={(e) => setMedium(e.target.value as typeof medium)}
            className={inputClass}
          >
            <option value="video">Video</option>
            <option value="audio">Audio / music</option>
            <option value="reading">Reading</option>
            <option value="other">Other</option>
          </select>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What did you watch/read/listen to?"
            className={`flex-1 ${inputClass}`}
          />
        </div>
      )}

      {kind === 'conversation' && (
        <select
          value={partnerType}
          onChange={(e) => setPartnerType(e.target.value as typeof partnerType)}
          className={inputClass}
        >
          <option value="tutor">With a tutor (italki etc.)</option>
          <option value="exchange">Language exchange partner</option>
          <option value="self">Self-talk</option>
          <option value="other">Other</option>
        </select>
      )}

      {kind === 'writing' && (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="Paste or type what you wrote (optional)"
          className={inputClass}
        />
      )}

      {kind === 'course' && (
        <div className="flex gap-2">
          <select
            required
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            className={`flex-1 ${inputClass}`}
          >
            <option value="">Pick a course…</option>
            {courses?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            value={unitLabel}
            onChange={(e) => setUnitLabel(e.target.value)}
            placeholder="e.g. Lesson 12"
            className={`flex-1 ${inputClass}`}
          />
        </div>
      )}

      <input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional)"
        className={inputClass}
      />

      <button
        type="submit"
        disabled={saveLog.isPending}
        className="rounded-lg bg-primary-700 px-4 py-2.5 text-sm font-semibold text-[#F7F2E8] transition-colors hover:bg-primary-800 disabled:opacity-50"
      >
        Log it
      </button>
      {saveLog.isError && (
        <p className="text-sm text-output-deep">{(saveLog.error as Error).message}</p>
      )}
    </form>
  )
}
