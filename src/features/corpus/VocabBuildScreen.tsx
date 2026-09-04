import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { useActiveLanguage, useProfile } from '../../services/queries/profile'
import {
  useCorpusSources,
  useDeleteCorpusSource,
  useDiscardCorpusAudio,
  useSaveCorpusSource,
} from '../../services/queries/corpus'
import { startRecording, extensionFor, type RecorderHandle } from '../../services/audioRecorder'
import { recordingRepo } from '../../services/supabase/recordingRepo'
import { transcription } from '../../services/transcription'
import { corpusStats, saturation, tokenize, domainsCovered } from '../../domain/corpus/frequency'
import type { CorpusSource } from '../../domain/entities'
import { CoveragePanel } from './CoveragePanel'
import { SourceList } from './SourceList'
import { PromptCard } from './PromptCard'
import { nextPrompt, type CorpusPrompt } from './prompts'
import { ListReview } from './ListReview'

/** Whisper's upload ceiling. Roughly 25 minutes of a typical 128 kbps mp3. */
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

const ACCEPTED_AUDIO = 'audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/webm,.mp3,.m4a,.wav'

type Tab = 'record' | 'upload' | 'transcript'
type Phase = 'idle' | 'recording' | 'saving' | 'transcribing' | 'error'

interface Props {
  /** Onboarding embeds this without its own header and hands back control when done. */
  embedded?: boolean
  onDone?: () => void
}

export function VocabBuildScreen({ embedded, onDone }: Props) {
  const navigate = useNavigate()
  const { userId } = useAuth()
  const language = useActiveLanguage()
  const { data: profile } = useProfile()
  const { data: sources, isLoading } = useCorpusSources()
  const saveSource = useSaveCorpusSource()
  const deleteSource = useDeleteCorpusSource()
  const discardAudio = useDiscardCorpusAudio()

  const [tab, setTab] = useState<Tab>('record')
  const [phase, setPhase] = useState<Phase>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [prompt, setPrompt] = useState<CorpusPrompt | null>(null)
  const [reviewing, setReviewing] = useState(false)
  const handle = useRef<RecorderHandle | null>(null)

  const locale = profile?.nativeLanguage.code || 'en'
  // Memoized: the `?? []` fallback would otherwise mint a new array every render and
  // retrigger the prompt effect in a loop.
  const savedDomains = profile?.onboarding.domains
  const domains = useMemo(() => savedDomains ?? [], [savedDomains])
  const ready = useMemo(() => (sources ?? []).filter((s) => s.status === 'ready'), [sources])
  const stats = useMemo(() => corpusStats(ready, locale), [ready, locale])
  const saturationPct = useMemo(() => saturation(ready, locale), [ready, locale])
  const covered = useMemo(() => domainsCovered(stats, domains), [stats, domains])

  // Steer toward the topics they have said least about — breadth is what personalises the list.
  useEffect(() => {
    if (prompt || !sources) return
    setPrompt(nextPrompt(domains, stats.byDomain, sources.map((s) => s.promptId ?? '')))
  }, [prompt, sources, domains, stats.byDomain])

  useEffect(() => {
    if (phase !== 'recording') return
    const id = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [phase])

  // Release the mic if the user navigates away mid-recording.
  useEffect(() => () => handle.current?.cancel(), [])

  function shufflePrompt() {
    const used = (sources ?? []).map((s) => s.promptId ?? '')
    setPrompt(nextPrompt(domains, stats.byDomain, [...used, prompt?.id ?? '']))
  }

  function baseSource(overrides: Partial<CorpusSource>): CorpusSource {
    const now = Date.now()
    return {
      id: crypto.randomUUID(),
      userId: userId!,
      createdAt: now,
      updatedAt: now,
      language: language!,
      kind: 'transcript',
      label: '',
      domain: '',
      promptId: null,
      recordingId: null,
      speakers: 'solo',
      status: 'ready',
      error: null,
      transcript: '',
      tokenCount: 0,
      durationSec: 0,
      ...overrides,
    }
  }

  /** Uploads audio, transcribes it, and stores the result as one source. */
  async function ingestAudio(
    blob: Blob,
    meta: { mimeType: string; durationSec: number; label: string; domain: string; promptId: string | null; speakers: 'solo' | 'mixed'; kind: 'recording' | 'upload' },
  ) {
    const now = Date.now()
    const recordingId = crypto.randomUUID()
    await recordingRepo.create(
      {
        id: recordingId,
        userId: userId!,
        createdAt: now,
        updatedAt: now,
        language: language!,
        mimeType: meta.mimeType,
        durationSec: meta.durationSec,
        context: 'native_corpus',
        storagePath: `${userId}/${recordingId}.${extensionFor(meta.mimeType)}`,
      },
      blob,
    )

    const source = baseSource({
      kind: meta.kind,
      label: meta.label,
      domain: meta.domain,
      promptId: meta.promptId,
      recordingId,
      speakers: meta.speakers,
      status: 'transcribing',
      durationSec: meta.durationSec,
    })
    await saveSource.mutateAsync(source)

    setPhase('transcribing')
    try {
      const recording = await recordingRepo.get(userId!, recordingId)
      // The edge function only forwards a real ISO-639-1 code; the native picker stores one.
      const result = await transcription.transcribe(recording!, locale)
      await saveSource.mutateAsync({
        ...source,
        status: 'ready',
        transcript: result.text,
        tokenCount: tokenize(result.text, locale).length,
        updatedAt: Date.now(),
      })
    } catch (e) {
      await saveSource.mutateAsync({
        ...source,
        status: 'failed',
        error: (e as Error).message,
        updatedAt: Date.now(),
      })
      throw e
    }
  }

  async function beginRecording() {
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

  async function finishRecording() {
    if (!handle.current) return
    setPhase('saving')
    try {
      const result = await handle.current.stop()
      handle.current = null
      await ingestAudio(result.blob, {
        mimeType: result.mimeType,
        durationSec: result.durationSec,
        label: prompt?.text ?? 'Recording',
        domain: prompt?.domain ?? '',
        promptId: prompt?.id ?? null,
        speakers: 'solo',
        kind: 'recording',
      })
      setPhase('idle')
      setPrompt(null) // pick a fresh gap next
    } catch (e) {
      setError((e as Error).message)
      setPhase('error')
    }
  }

  function cancelRecording() {
    handle.current?.cancel()
    handle.current = null
    setPhase('idle')
  }

  async function handleUpload(file: File, speakers: 'solo' | 'mixed') {
    setError(null)
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(
        `That file is ${(file.size / 1024 / 1024).toFixed(0)}MB. Audio uploads max out at 25MB — about 25 minutes at typical mp3 quality. Split it, or record here instead.`,
      )
      setPhase('error')
      return
    }
    setPhase('saving')
    try {
      await ingestAudio(file, {
        mimeType: file.type || 'audio/mpeg',
        durationSec: 0,
        label: file.name,
        domain: prompt?.domain ?? '',
        promptId: null,
        speakers,
        kind: 'upload',
      })
      setPhase('idle')
    } catch (e) {
      setError((e as Error).message)
      setPhase('error')
    }
  }

  async function handlePastedTranscript(text: string, label: string, domain: string, speakers: 'solo' | 'mixed') {
    setError(null)
    try {
      await saveSource.mutateAsync(
        baseSource({
          kind: 'transcript',
          label: label || 'Pasted text',
          domain,
          speakers,
          transcript: text,
          tokenCount: tokenize(text, locale).length,
        }),
      )
    } catch (e) {
      setError((e as Error).message)
      setPhase('error')
    }
  }

  if (!userId || !language || !profile) return null

  if (reviewing) {
    return (
      <ListReview
        sources={ready}
        locale={locale}
        onCancel={() => setReviewing(false)}
        onFinished={() => {
          setReviewing(false)
          if (onDone) onDone()
          else navigate('/decks')
        }}
      />
    )
  }

  const busy = phase === 'saving' || phase === 'transcribing'

  return (
    <div className={embedded ? '' : 'mx-auto min-h-dvh max-w-2xl p-5 pb-20'}>
      {!embedded && (
        <header className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-[27px] font-bold">Your starter words</h1>
            <p className="mt-1 max-w-prose text-sm text-stone-500">
              Talk about your own life in {profile.nativeLanguage.name || 'your own language'}. The
              app counts what you actually say and turns the most-used words into your first deck —
              no generic top-1000 list, just the vocabulary your days are already made of.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="shrink-0 text-sm font-medium text-stone-500 hover:text-ink"
          >
            Done
          </button>
        </header>
      )}

      <CoveragePanel
        stats={stats}
        saturationPct={saturationPct}
        domains={domains}
        covered={covered}
      />

      <div className="mt-4 rounded-xl border border-stone-200 bg-card p-4">
        <div className="mb-3 flex gap-1">
          {(
            [
              ['record', 'Record here'],
              ['upload', 'Upload audio'],
              ['transcript', 'Paste text'],
            ] as [Tab, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              disabled={phase === 'recording'}
              className={
                tab === value
                  ? 'rounded-lg bg-stone-200 px-3 py-1.5 text-[13px] font-bold text-ink disabled:opacity-50'
                  : 'rounded-lg px-3 py-1.5 text-[13px] font-medium text-stone-500 hover:text-ink disabled:opacity-50'
              }
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'record' && (
          <RecordTab
            prompt={prompt}
            phase={phase}
            elapsed={elapsed}
            busy={busy}
            onShuffle={shufflePrompt}
            onBegin={beginRecording}
            onFinish={finishRecording}
            onCancel={cancelRecording}
          />
        )}
        {tab === 'upload' && <UploadTab busy={busy} onUpload={handleUpload} />}
        {tab === 'transcript' && <TranscriptTab busy={busy} onAdd={handlePastedTranscript} />}

        {error && <p className="mt-3 text-sm text-output-deep">{error}</p>}
        {phase === 'transcribing' && (
          <p className="mt-3 text-sm text-input">Transcribing — this takes a moment.</p>
        )}
      </div>

      <p className="mt-4 text-[10.5px] font-extrabold tracking-[.2em] text-stone-500 uppercase">
        What you&apos;ve recorded
      </p>
      <div className="mt-2">
        {isLoading ? (
          <p className="text-sm text-stone-400">Loading…</p>
        ) : (
          <SourceList
            sources={sources ?? []}
            busy={busy}
            onSaveTranscript={(source, text) =>
              saveSource.mutate({
                ...source,
                transcript: text,
                tokenCount: tokenize(text, locale).length,
                updatedAt: Date.now(),
              })
            }
            onDiscardAudio={(source) => discardAudio.mutate(source)}
            onDelete={(source) => deleteSource.mutate(source)}
          />
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={stats.stable === 0 || busy}
          onClick={() => setReviewing(true)}
          className="rounded-[10px] bg-primary-700 px-5 pt-[16px] pb-[14px] text-[15px] font-bold text-[#F7F2E8] transition-colors hover:bg-primary-800 disabled:opacity-50"
        >
          Build my list
        </button>
        {stats.stable === 0 ? (
          <span className="text-xs text-stone-500">
            Add some speech first — a word needs saying three times before it counts.
          </span>
        ) : (
          <span className="text-xs text-stone-500">
            {stats.stable} words ready to translate.
          </span>
        )}
      </div>
    </div>
  )
}

function RecordTab({
  prompt,
  phase,
  elapsed,
  busy,
  onShuffle,
  onBegin,
  onFinish,
  onCancel,
}: {
  prompt: CorpusPrompt | null
  phase: Phase
  elapsed: number
  busy: boolean
  onShuffle: () => void
  onBegin: () => void
  onFinish: () => void
  onCancel: () => void
}) {
  return (
    <div>
      <PromptCard prompt={prompt} onShuffle={onShuffle} disabled={phase === 'recording' || busy} />
      <p className="mt-3 text-xs text-stone-500">
        These prompts are written for you on your own. Recording other people without telling them
        is illegal in some places — and transcription can&apos;t tell two voices apart anyway.
      </p>
      <div className="mt-3 flex items-center gap-3">
        {phase === 'recording' ? (
          <>
            <button
              type="button"
              onClick={onFinish}
              className="rounded-[10px] bg-output px-5 pt-[14px] pb-[12px] text-[15px] font-bold text-[#F7F2E8] transition-colors hover:bg-output-deep"
            >
              Stop · {formatElapsed(elapsed)}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="text-xs font-medium text-stone-500 hover:text-ink"
            >
              Discard
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onBegin}
            disabled={busy}
            className="rounded-[10px] bg-primary-700 px-5 pt-[14px] pb-[12px] text-[15px] font-bold text-[#F7F2E8] transition-colors hover:bg-primary-800 disabled:opacity-50"
          >
            {busy ? 'Working…' : 'Start recording'}
          </button>
        )}
      </div>
    </div>
  )
}

function UploadTab({
  busy,
  onUpload,
}: {
  busy: boolean
  onUpload: (file: File, speakers: 'solo' | 'mixed') => void
}) {
  const [speakers, setSpeakers] = useState<'solo' | 'mixed'>('solo')
  return (
    <div>
      <p className="text-sm text-stone-600">
        Any voice memo or recording of you talking. Up to 25MB — roughly 25 minutes of a typical
        mp3.
      </p>
      <SpeakerToggle value={speakers} onChange={setSpeakers} />
      <input
        type="file"
        accept={ACCEPTED_AUDIO}
        disabled={busy}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onUpload(file, speakers)
          e.target.value = ''
        }}
        className="mt-3 block w-full text-sm text-stone-600 file:mr-3 file:rounded-lg file:border-0 file:bg-stone-200 file:px-4 file:py-2 file:text-sm file:font-bold file:text-ink hover:file:bg-stone-300 disabled:opacity-50"
      />
    </div>
  )
}

function TranscriptTab({
  busy,
  onAdd,
}: {
  busy: boolean
  onAdd: (text: string, label: string, domain: string, speakers: 'solo' | 'mixed') => void
}) {
  const [text, setText] = useState('')
  const [label, setLabel] = useState('')
  const [speakers, setSpeakers] = useState<'solo' | 'mixed'>('solo')

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!text.trim()) return
        onAdd(text.trim(), label.trim(), '', speakers)
        setText('')
        setLabel('')
      }}
    >
      <p className="text-sm text-stone-600">
        Already have a transcript, or something you wrote the way you talk? Paste it here.
      </p>
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="What is it? e.g. Voice notes about work"
        className="mt-3 w-full rounded-lg border border-stone-300 bg-card px-3 py-2 text-sm outline-none focus:border-primary-500"
      />
      <textarea
        rows={8}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste the text…"
        className="mt-2 w-full resize-y rounded-lg border border-stone-300 bg-card px-3 py-2 text-sm outline-none focus:border-primary-500"
      />
      <SpeakerToggle value={speakers} onChange={setSpeakers} />
      <button
        type="submit"
        disabled={!text.trim() || busy}
        className="mt-3 rounded-[10px] bg-primary-700 px-5 pt-[14px] pb-[12px] text-[15px] font-bold text-[#F7F2E8] transition-colors hover:bg-primary-800 disabled:opacity-50"
      >
        Add text
      </button>
    </form>
  )
}

function SpeakerToggle({
  value,
  onChange,
}: {
  value: 'solo' | 'mixed'
  onChange: (v: 'solo' | 'mixed') => void
}) {
  return (
    <div className="mt-3">
      <div className="flex gap-1">
        {(
          [
            ['solo', 'Just me'],
            ['mixed', 'A conversation'],
          ] as ['solo' | 'mixed', string][]
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={
              value === v
                ? 'rounded-lg bg-stone-200 px-3 py-1.5 text-[13px] font-bold text-ink'
                : 'rounded-lg px-3 py-1.5 text-[13px] font-medium text-stone-500 hover:text-ink'
            }
          >
            {label}
          </button>
        ))}
      </div>
      {value === 'mixed' && (
        <p className="mt-1.5 text-xs text-stone-500">
          Transcription can&apos;t tell the voices apart, so this counts half. You can trim the
          other person&apos;s lines afterwards to make it count fully.
        </p>
      )}
    </div>
  )
}

function formatElapsed(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  return `${mins}:${String(seconds % 60).padStart(2, '0')}`
}
