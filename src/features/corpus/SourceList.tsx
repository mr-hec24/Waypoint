import { useState } from 'react'
import type { CorpusSource } from '../../domain/entities'
import { domainLabel } from './domains'

interface Props {
  sources: CorpusSource[]
  onSaveTranscript: (source: CorpusSource, transcript: string) => void
  onDiscardAudio: (source: CorpusSource) => void
  onDelete: (source: CorpusSource) => void
  busy?: boolean
}

export function SourceList({ sources, onSaveTranscript, onDiscardAudio, onDelete, busy }: Props) {
  const [openId, setOpenId] = useState<string | null>(null)

  if (sources.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-stone-300 bg-card p-6 text-center text-sm text-stone-400">
        Nothing recorded yet. Answer a prompt above, or paste something you have already written.
      </div>
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {sources.map((source) => (
        <li key={source.id} className="rounded-xl border border-stone-200 bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">
                {source.label || 'Untitled'}
              </p>
              <p className="mt-0.5 text-xs text-stone-500">
                {[
                  domainLabel(source.domain),
                  `${source.tokenCount.toLocaleString()} words`,
                  source.durationSec > 0 ? formatDuration(source.durationSec) : null,
                  source.speakers === 'mixed' ? 'two-way · half-counted' : null,
                  source.recordingId ? null : source.kind === 'transcript' ? null : 'audio deleted',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              {source.status === 'failed' && (
                <p className="mt-1 text-xs text-output-deep">{source.error ?? 'Failed'}</p>
              )}
              {source.status === 'transcribing' && (
                <p className="mt-1 text-xs text-input">Transcribing…</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setOpenId(openId === source.id ? null : source.id)}
              className="shrink-0 text-xs font-medium text-stone-500 hover:text-ink"
            >
              {openId === source.id ? '▾ Close' : '▸ Text'}
            </button>
          </div>

          {openId === source.id && (
            <TranscriptEditor
              source={source}
              busy={busy}
              onSave={(text) => onSaveTranscript(source, text)}
              onDiscardAudio={() => onDiscardAudio(source)}
              onDelete={() => onDelete(source)}
            />
          )}
        </li>
      ))}
    </ul>
  )
}

function TranscriptEditor({
  source,
  busy,
  onSave,
  onDiscardAudio,
  onDelete,
}: {
  source: CorpusSource
  busy?: boolean
  onSave: (text: string) => void
  onDiscardAudio: () => void
  onDelete: () => void
}) {
  const [text, setText] = useState(source.transcript)
  const dirty = text !== source.transcript

  return (
    <div className="mt-3 border-t border-stone-200 pt-3">
      {source.speakers === 'mixed' && (
        <p className="mb-2 text-xs text-stone-500">
          This one has two voices in it and transcription can&apos;t tell you apart, so it only
          half-counts. Delete the other person&apos;s lines to make it count fully.
        </p>
      )}
      <textarea
        rows={8}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="w-full resize-y rounded-lg border border-stone-300 bg-card px-3 py-2 text-sm outline-none focus:border-primary-500"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!dirty || busy}
          onClick={() => onSave(text)}
          className="rounded-[10px] bg-primary-700 px-4 pt-[10px] pb-[8px] text-[13px] font-bold text-[#F7F2E8] transition-colors hover:bg-primary-800 disabled:opacity-50"
        >
          {dirty ? 'Save changes' : 'Saved'}
        </button>
        {source.recordingId && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (confirm('Delete the audio and keep the text? This cannot be undone.')) {
                onDiscardAudio()
              }
            }}
            className="text-xs font-medium text-stone-500 hover:text-ink disabled:opacity-50"
          >
            Delete audio, keep text
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (confirm(`Delete "${source.label || 'this source'}" entirely?`)) onDelete()
          }}
          className="ml-auto text-xs font-medium text-output-deep hover:text-output disabled:opacity-50"
        >
          Delete
        </button>
      </div>
    </div>
  )
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.round(seconds % 60)
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
}
