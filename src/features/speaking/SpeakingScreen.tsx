import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { useActiveLanguage } from '../../services/queries/profile'
import {
  useActivityLogsByKind,
  useDeleteActivityLog,
  useSetLogTitle,
} from '../../services/queries/logs'
import { useLanguageWords } from '../../services/queries/flashcards'
import { StorySpeaking } from '../runner/StorySpeaking'
import { PracticeRunner } from '../flashcards/ReviewScreen'
import { groupHistory, type HistoryItem } from '../logging/grouping'
import type { StorySpeakingLog, Word } from '../../domain/entities'

const inputClass =
  'rounded-lg border border-stone-300 bg-card px-3 py-2 text-sm outline-none focus:border-primary-500'

/** The story-speaking attempts a history item covers, newest first. */
function attemptsOf(item: HistoryItem): StorySpeakingLog[] {
  if (item.type === 'group') return item.attempts
  return item.log.kind === 'story_speaking' ? [item.log] : []
}

/** Cards mined from any of these attempts' recordings. */
function cardsFor(attempts: StorySpeakingLog[], words: Word[] | undefined): Word[] {
  if (!words) return []
  const recordingIds = new Set(
    attempts.map((a) => a.details.recordingId).filter((id): id is string => Boolean(id)),
  )
  return words.filter((w) => w.source.type === 'voice_memo' && recordingIds.has(w.source.recordingId))
}

function matchesQuery(item: HistoryItem, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return attemptsOf(item).some((log) => {
    const haystack = [
      log.title ?? '',
      log.details.promptText,
      new Date(log.occurredAt).toLocaleDateString(),
      new Date(log.occurredAt).toLocaleString(),
    ]
      .join(' ')
      .toLowerCase()
    return haystack.includes(q)
  })
}

export function SpeakingScreen() {
  const { userId } = useAuth()
  const language = useActiveLanguage()
  const { data: logs, isLoading } = useActivityLogsByKind('story_speaking')
  const { data: words } = useLanguageWords()
  const setLogTitle = useSetLogTitle()
  const deleteLog = useDeleteActivityLog()

  const [exerciseOpen, setExerciseOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [practice, setPractice] = useState<Word[] | null>(null)
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  if (practice) {
    return (
      <PracticeRunner
        cards={practice}
        exitLabel="Back to stories"
        onExit={() => setPractice(null)}
      />
    )
  }

  const items = logs ? groupHistory(logs) : undefined
  const filtered = items?.filter((i) => matchesQuery(i, query))

  function startRename(key: string, current: string | null) {
    setEditingKey(key)
    setDraft(current ?? '')
  }

  function commitRename(ids: string[], current: string | null) {
    const trimmed = draft.trim()
    setEditingKey(null)
    if (trimmed === (current ?? '')) return
    setLogTitle.mutate({ ids, title: trimmed || null })
  }

  function renderItem(item: HistoryItem) {
    const attempts = attemptsOf(item)
    if (attempts.length === 0) return null
    const key = item.type === 'group' ? item.groupId : item.log.id
    const expanded = expandedKey === key
    const editing = editingKey === key
    const currentTitle = attempts.find((a) => a.title)?.title ?? null
    const ids = attempts.map((a) => a.id)
    const latest = attempts[0]!
    const totalMinutes = attempts.reduce((sum, a) => sum + a.durationMinutes, 0)
    const cards = cardsFor(attempts, words)
    const title = currentTitle || latest.details.promptText || 'Story speaking'

    return (
      <div key={key} className="rounded-xl border border-stone-200 bg-card px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => setExpandedKey(expanded ? null : key)}
            className="min-w-0 flex-1 text-left"
          >
            <p className="truncate text-sm font-bold">
              {title}
              {attempts.length > 1 && (
                <span className="ml-1.5 text-xs font-semibold text-output">
                  {attempts.length} attempts
                </span>
              )}
              <span className="ml-1.5 text-xs font-normal text-stone-400">
                {expanded ? '▾' : '▸'}
              </span>
            </p>
            <p className="truncate text-xs text-stone-500">
              {new Date(latest.occurredAt).toLocaleString()} · {totalMinutes} min
              {cards.length > 0 && ` · ${cards.length} card${cards.length > 1 ? 's' : ''} mined`}
            </p>
          </button>
          {cards.length > 0 && (
            <button
              onClick={() => setPractice(cards)}
              className="shrink-0 rounded-lg bg-primary-50 px-3 pt-[7px] pb-[5px] text-xs font-bold text-primary-700 hover:bg-primary-100"
            >
              Study {cards.length}
            </button>
          )}
          <button
            onClick={() => (editing ? setEditingKey(null) : startRename(key, currentTitle))}
            title="Rename"
            className="shrink-0 text-xs text-stone-500 hover:text-stone-700"
          >
            ✎
          </button>
        </div>

        {editing && (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => commitRename(ids, currentTitle)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename(ids, currentTitle)
              if (e.key === 'Escape') setEditingKey(null)
            }}
            placeholder="Name this story — empty clears the name"
            className={`mt-2 w-full ${inputClass}`}
          />
        )}

        {expanded && (
          <div className="mt-3 flex flex-col gap-1 border-t border-stone-100 pt-3">
            {latest.details.promptText && (
              <p className="font-display mb-1 text-[12.5px] text-stone-600 italic">
                Prompt — {latest.details.promptText}
              </p>
            )}
            {attempts.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 py-1">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold">
                    {a.details.attemptNumber != null ? `Take ${a.details.attemptNumber}` : 'Take'}
                  </p>
                  <p className="truncate text-xs text-stone-500">
                    {new Date(a.occurredAt).toLocaleString()} · {a.durationMinutes} min
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {a.details.recordingId && (
                    <Link
                      to={`/recordings/${a.details.recordingId}/review`}
                      className="text-xs font-bold text-output hover:underline"
                    >
                      Review
                    </Link>
                  )}
                  <button
                    onClick={() => deleteLog.mutate(a.id)}
                    className="text-xs text-stone-500 hover:text-output-deep"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-[27px] font-bold">Story speaking</h2>
        <button
          onClick={() => setExerciseOpen((o) => !o)}
          className="rounded-lg bg-output px-4 pt-[10px] pb-2 text-sm font-bold text-[#F7F2E8] hover:bg-output-deep"
        >
          {exerciseOpen ? 'Close session' : '+ Start speaking'}
        </button>
      </div>
      <p className="mb-4 text-sm text-stone-500">
        Tell a story out loud, review the gaps, drill the new vocab, and retell it — as many
        cycles as it takes.
      </p>

      {exerciseOpen && userId && language && (
        <div className="mb-6">
          <StorySpeaking userId={userId} sessionId={null} language={language} />
        </div>
      )}

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search stories by title, prompt, or date…"
        className={`mb-4 w-full ${inputClass}`}
      />

      <div className="flex flex-col gap-2">
        {isLoading && <p className="text-sm text-stone-400">Loading…</p>}
        {filtered?.length === 0 && (
          <p className="rounded-xl border border-dashed border-stone-300 bg-card p-6 text-center text-sm text-stone-400">
            {query.trim()
              ? 'No stories match that search.'
              : 'No stories yet — hit "Start speaking" and tell your first one.'}
          </p>
        )}
        {filtered?.map(renderItem)}
      </div>
    </div>
  )
}
