import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { useActiveLanguage } from '../../services/queries/profile'
import { QuickLogForm } from './QuickLogForm'
import { RecordingsTab } from './RecordingsTab'
import {
  localDateString,
  useActivityLogs,
  useCourses,
  useDeleteActivityLog,
  useDeleteCourse,
  useSaveCourse,
  useSaveSleepLog,
  useSleepLogs,
} from '../../services/queries/logs'
import type { ActivityKind, ActivityLog, Pillar, SleepLog } from '../../domain/entities'

const KIND_LABELS: Record<ActivityKind, string> = {
  flashcards: 'Flashcards',
  course: 'Course',
  immersion: 'Immersion',
  story_speaking: 'Story speaking',
  writing: 'Writing',
  conversation: 'Conversation',
}

type Tab = 'input' | 'output' | 'rest'

const inputClass =
  'rounded-lg border border-stone-300 bg-card px-3 py-2 text-sm outline-none focus:border-primary-500'

export function LogsScreen() {
  const [tab, setTab] = useState<Tab>('input')

  return (
    <div>
      <h2 className="font-display mb-4 text-[27px] font-bold">Logs</h2>
      <div className="mb-6 flex gap-2 border-b border-stone-200">
        {(['input', 'output', 'rest'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex flex-1 flex-col items-center gap-1 px-3 pt-2 pb-2.5 text-[10.5px] font-extrabold tracking-[.14em] uppercase transition-colors ${
              tab === t ? 'text-primary-700' : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            <span
              aria-hidden
              className={`h-[5px] w-[5px] rounded-full ${tab === t ? 'bg-output' : 'bg-transparent'}`}
            />
            {t}
          </button>
        ))}
      </div>

      {tab === 'input' && <InputTab />}
      {tab === 'output' && <OutputTab />}
      {tab === 'rest' && <RestTab />}
    </div>
  )
}

// ---------- Input ----------

function InputTab() {
  return (
    <div className="flex flex-col gap-6">
      <QuickLogForm kinds={['immersion', 'course']} />
      <CoursesSection />
      <HistorySection pillar="input" />
    </div>
  )
}

// ---------- Output ----------

function OutputTab() {
  return (
    <div className="flex flex-col gap-6">
      <QuickLogForm kinds={['conversation', 'writing']} />
      <div>
        <p className="mb-2 text-xs font-semibold tracking-wide text-stone-400 uppercase">
          Story recordings
        </p>
        <RecordingsTab />
      </div>
      <HistorySection pillar="output" />
    </div>
  )
}

// ---------- Rest ----------

function RestTab() {
  const { userId } = useAuth()
  const { data: sleepLogs } = useSleepLogs()
  const saveSleep = useSaveSleepLog()

  const [date, setDate] = useState(localDateString())
  const [bedTime, setBedTime] = useState('23:00')
  const [wakeTime, setWakeTime] = useState('07:00')
  const [quality, setQuality] = useState<SleepLog['quality']>(3)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!userId) return
    const now = Date.now()
    saveSleep.mutate({
      id: crypto.randomUUID(),
      userId,
      createdAt: now,
      updatedAt: now,
      date,
      bedTime,
      wakeTime,
      quality,
      notes: '',
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-2 rounded-xl border border-stone-200 bg-card p-4"
      >
        <p className="text-xs font-semibold tracking-wide text-stone-400 uppercase">
          Log sleep — fuel for the roadtrip
        </p>
        <div className="grid grid-cols-3 gap-2">
          <label className="flex flex-col gap-1 text-xs text-stone-500">
            Date
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-stone-500">
            Bed
            <input type="time" value={bedTime} onChange={(e) => setBedTime(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-stone-500">
            Wake
            <input type="time" value={wakeTime} onChange={(e) => setWakeTime(e.target.value)} className={inputClass} />
          </label>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-stone-500">Quality</span>
          {([1, 2, 3, 4, 5] as const).map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setQuality(q)}
              className={`h-9 w-9 rounded-lg text-sm font-semibold ${
                quality === q ? 'bg-primary-700 text-[#F7F2E8]' : 'bg-stone-100 text-stone-500'
              }`}
            >
              {q}
            </button>
          ))}
        </div>
        <button
          type="submit"
          disabled={saveSleep.isPending}
          className="rounded-lg bg-primary-700 px-4 py-2.5 text-sm font-semibold text-[#F7F2E8] transition-colors hover:bg-primary-800 disabled:opacity-50"
        >
          Save
        </button>
        {saveSleep.isSuccess && <p className="text-xs text-primary-700">Saved.</p>}
      </form>

      {sleepLogs?.map((log) => (
        <div
          key={log.id}
          className="flex items-center justify-between rounded-xl border border-stone-200 bg-card px-4 py-3 text-sm"
        >
          <span>{log.date}</span>
          <span className="text-stone-400">
            {log.bedTime} → {log.wakeTime}
          </span>
          <span className="font-medium">{'★'.repeat(log.quality)}</span>
        </div>
      ))}
    </div>
  )
}

// ---------- shared sections ----------

/** Per-kind detail view shown when a history entry is expanded. */
function LogDetails({ log }: { log: ActivityLog }) {
  switch (log.kind) {
    case 'writing':
      return (
        <div className="flex flex-col gap-2">
          {log.details.promptText && (
            <p className="font-display text-[12.5px] text-stone-600 italic">
              Prompt — {log.details.promptText}
            </p>
          )}
          <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap">
            {log.details.text || 'No text saved.'}
          </p>
          <Link
            to={`/writing/${log.id}/review`}
            className="self-start rounded-lg border border-output px-3 pt-[6px] pb-[4px] text-xs font-bold text-output hover:bg-output/10"
          >
            Review this writing
          </Link>
        </div>
      )
    case 'immersion':
      return (
        <p className="text-[13px] text-stone-600">
          {log.details.medium}
          {log.details.title && ` — ${log.details.title}`}
        </p>
      )
    case 'story_speaking':
      return (
        <p className="font-display text-[12.5px] text-stone-600 italic">
          {log.details.promptText ? `Prompt — ${log.details.promptText}` : 'Story speaking take.'}
        </p>
      )
    case 'course':
      return (
        <p className="text-[13px] text-stone-600">
          {log.details.unitLabel || 'Course progress.'}
        </p>
      )
    case 'conversation':
      return <p className="text-[13px] text-stone-600">Partner: {log.details.partnerType}</p>
    case 'flashcards':
      return (
        <p className="text-[13px] text-stone-600">
          {log.details.cardsReviewed > 0
            ? `${log.details.cardsCorrect}/${log.details.cardsReviewed} correct`
            : 'Flashcard review.'}
        </p>
      )
  }
}

function HistorySection({ pillar }: { pillar: Pillar }) {
  // Stable range: computed once per mount so the query key doesn't churn
  // on every render (that churn made the list refetch forever).
  const [range] = useState(() => {
    const to = Date.now()
    return { from: to - 7 * 24 * 60 * 60 * 1000, to }
  })
  const { data: logs, isLoading } = useActivityLogs(range.from, range.to)
  const deleteLog = useDeleteActivityLog()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const filtered = logs?.filter((l) => l.pillar === pillar)

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[10.5px] font-extrabold tracking-[.2em] text-stone-500 uppercase">
        Last 7 days
      </p>
      {isLoading && <p className="text-sm text-stone-400">Loading…</p>}
      {filtered?.length === 0 && (
        <p className="text-sm text-stone-400">Nothing logged yet this week.</p>
      )}
      {filtered?.map((log) => {
        const expanded = expandedId === log.id
        return (
          <div key={log.id} className="rounded-xl border border-stone-200 bg-card px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={() => setExpandedId(expanded ? null : log.id)}
                className="min-w-0 flex-1 text-left"
              >
                <p className="text-sm font-bold">
                  {KIND_LABELS[log.kind]}
                  <span className="ml-1.5 text-xs font-normal text-stone-400">
                    {expanded ? '▾' : '▸'}
                  </span>
                </p>
                <p className="truncate text-xs text-stone-500">
                  {new Date(log.occurredAt).toLocaleString()} · {log.durationMinutes} min
                  {log.notes && ` · ${log.notes}`}
                </p>
              </button>
              <button
                onClick={() => deleteLog.mutate(log.id)}
                className="shrink-0 text-xs text-stone-500 hover:text-output-deep"
              >
                Delete
              </button>
            </div>
            {expanded && (
              <div className="mt-3 border-t border-stone-100 pt-3">
                <LogDetails log={log} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function CoursesSection() {
  const { userId } = useAuth()
  const language = useActiveLanguage()
  const { data: courses } = useCourses()
  const saveCourse = useSaveCourse()
  const deleteCourse = useDeleteCourse()
  const [name, setName] = useState('')
  const [platform, setPlatform] = useState('')

  function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!userId || !language || !name.trim()) return
    const now = Date.now()
    saveCourse.mutate({
      id: crypto.randomUUID(),
      userId,
      createdAt: now,
      updatedAt: now,
      language,
      name: name.trim(),
      platform: platform.trim(),
      totalUnits: null,
      completedUnits: 0,
      unitLabel: 'lesson',
    })
    setName('')
    setPlatform('')
  }

  return (
    <div className="flex flex-col gap-3">
      <form
        onSubmit={handleCreate}
        className="flex flex-col gap-2 rounded-xl border border-stone-200 bg-card p-4"
      >
        <p className="text-xs font-semibold tracking-wide text-stone-400 uppercase">
          Track an external course
        </p>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Course name (e.g. Language Transfer Spanish)"
          className={inputClass}
        />
        <input
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          placeholder="Platform (optional)"
          className={inputClass}
        />
        <button
          type="submit"
          disabled={saveCourse.isPending}
          className="rounded-lg bg-primary-700 px-4 py-2.5 text-sm font-semibold text-[#F7F2E8] transition-colors hover:bg-primary-800 disabled:opacity-50"
        >
          Add course
        </button>
      </form>

      {courses?.map((course) => (
        <div key={course.id} className="rounded-xl border border-stone-200 bg-card px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{course.name}</p>
              <p className="text-xs text-stone-400">
                {course.platform && `${course.platform} · `}
                {course.completedUnits}
                {course.totalUnits ? ` / ${course.totalUnits}` : ''} {course.unitLabel}s done
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() =>
                  saveCourse.mutate({ ...course, completedUnits: course.completedUnits + 1 })
                }
                className="rounded-lg bg-primary-50 px-3 py-1.5 text-sm font-semibold text-primary-700 hover:bg-primary-100"
              >
                +1 {course.unitLabel}
              </button>
              <button
                onClick={() => {
                  if (confirm(`Remove course "${course.name}"?`)) deleteCourse.mutate(course.id)
                }}
                className="text-xs text-stone-400 hover:text-output-deep"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
