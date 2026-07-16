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
import { WritingExercise } from '../runner/WritingExercise'
import { PracticeRunner } from '../flashcards/ReviewScreen'
import type { WritingLog, Word } from '../../domain/entities'

const inputClass =
  'rounded-lg border border-stone-300 bg-card px-3 py-2 text-sm outline-none focus:border-primary-500'

/** Cards mined from this writing's review. */
function cardsFor(log: WritingLog, words: Word[] | undefined): Word[] {
  if (!words) return []
  return words.filter((w) => w.source.type === 'writing' && w.source.logId === log.id)
}

function matchesQuery(log: WritingLog, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const haystack = [
    log.title ?? '',
    log.details.promptText,
    log.details.text,
    new Date(log.occurredAt).toLocaleDateString(),
    new Date(log.occurredAt).toLocaleString(),
  ]
    .join(' ')
    .toLowerCase()
  return haystack.includes(q)
}

export function WritingScreen() {
  const { userId } = useAuth()
  const language = useActiveLanguage()
  const { data: logs, isLoading } = useActivityLogsByKind('writing')
  const { data: words } = useLanguageWords()
  const setLogTitle = useSetLogTitle()
  const deleteLog = useDeleteActivityLog()

  const [exerciseOpen, setExerciseOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [practice, setPractice] = useState<Word[] | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  if (practice) {
    return (
      <PracticeRunner
        cards={practice}
        exitLabel="Back to writings"
        onExit={() => setPractice(null)}
      />
    )
  }

  const writings = logs?.filter((l): l is WritingLog => l.kind === 'writing')
  const filtered = writings?.filter((l) => matchesQuery(l, query))

  function startRename(log: WritingLog) {
    setEditingId(log.id)
    setDraft(log.title ?? '')
  }

  function commitRename(log: WritingLog) {
    const trimmed = draft.trim()
    setEditingId(null)
    if (trimmed === (log.title ?? '')) return
    setLogTitle.mutate({ ids: [log.id], title: trimmed || null })
  }

  function renderLog(log: WritingLog) {
    const expanded = expandedId === log.id
    const editing = editingId === log.id
    const cards = cardsFor(log, words)
    const wordCount = log.details.text.trim() === '' ? 0 : log.details.text.trim().split(/\s+/).length
    const title = log.title || log.details.promptText || 'Untitled writing'

    return (
      <div key={log.id} className="rounded-xl border border-stone-200 bg-card px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => setExpandedId(expanded ? null : log.id)}
            className="min-w-0 flex-1 text-left"
          >
            <p className="truncate text-sm font-bold">
              {title}
              <span className="ml-1.5 text-xs font-normal text-stone-400">
                {expanded ? '▾' : '▸'}
              </span>
            </p>
            <p className="truncate text-xs text-stone-500">
              {new Date(log.occurredAt).toLocaleString()} · {log.durationMinutes} min
              {wordCount > 0 && ` · ${wordCount} words`}
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
            onClick={() => (editing ? setEditingId(null) : startRename(log))}
            title="Rename"
            className="shrink-0 text-xs text-stone-500 hover:text-stone-700"
          >
            ✎
          </button>
          <button
            onClick={() => deleteLog.mutate(log.id)}
            className="shrink-0 text-xs text-stone-500 hover:text-output-deep"
          >
            Delete
          </button>
        </div>

        {editing && (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => commitRename(log)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename(log)
              if (e.key === 'Escape') setEditingId(null)
            }}
            placeholder="Name this writing — empty clears the name"
            className={`mt-2 w-full ${inputClass}`}
          />
        )}

        {expanded && (
          <div className="mt-3 flex flex-col gap-2 border-t border-stone-100 pt-3">
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
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-[27px] font-bold">Writing</h2>
        <button
          onClick={() => setExerciseOpen((o) => !o)}
          className="rounded-lg bg-output px-4 pt-[10px] pb-2 text-sm font-bold text-[#F7F2E8] hover:bg-output-deep"
        >
          {exerciseOpen ? 'Close session' : '+ Start writing'}
        </button>
      </div>
      <p className="mb-4 text-sm text-stone-500">
        Write freely in your target language, then review it sentence by sentence and mine it
        for flashcards.
      </p>

      {exerciseOpen && userId && language && (
        <div className="mb-6">
          <WritingExercise userId={userId} sessionId={null} language={language} />
        </div>
      )}

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search writings by title, prompt, keywords, or date…"
        className={`mb-4 w-full ${inputClass}`}
      />

      <div className="flex flex-col gap-2">
        {isLoading && <p className="text-sm text-stone-400">Loading…</p>}
        {filtered?.length === 0 && (
          <p className="rounded-xl border border-dashed border-stone-300 bg-card p-6 text-center text-sm text-stone-400">
            {query.trim()
              ? 'No writings match that search.'
              : 'Nothing written yet — hit "Start writing" for your first piece.'}
          </p>
        )}
        {filtered?.map(renderLog)}
      </div>
    </div>
  )
}
