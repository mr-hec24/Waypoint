import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { useProfile } from '../../services/queries/profile'
import { createSession } from '../../domain/session/machine'
import { sessionRepo } from '../../services/supabase/sessionRepo'
import { useSessionStore } from '../runner/sessionStore'
import type { ActivityKind, PlannedBlock } from '../../domain/entities'

const INPUT_OPTIONS: { kind: ActivityKind; label: string; hint: string }[] = [
  { kind: 'flashcards', label: 'Flashcards', hint: 'Review your due cards' },
  { kind: 'immersion', label: 'Immersion', hint: 'Watch, listen, or read' },
  { kind: 'course', label: 'Course', hint: 'Continue your external course' },
]

const OUTPUT_OPTIONS: { kind: ActivityKind; label: string; hint: string }[] = [
  { kind: 'story_speaking', label: 'Story speaking', hint: 'Record a story, then review it' },
  { kind: 'writing', label: 'Writing', hint: 'Prompted writing in the built-in editor' },
  { kind: 'conversation', label: 'Conversation', hint: 'Tutor or exchange partner' },
]

interface DraftBlock {
  id: string
  input: ActivityKind
  output: ActivityKind
}

function defaultBlock(): DraftBlock {
  return { id: crypto.randomUUID(), input: 'flashcards', output: 'story_speaking' }
}

export function PlannerScreen() {
  const navigate = useNavigate()
  const { userId } = useAuth()
  const { data: profile } = useProfile()
  const loadSession = useSessionStore((s) => s.load)
  const [blocks, setBlocks] = useState<DraftBlock[]>([defaultBlock()])
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const blockMinutes = profile?.settings.blockMinutes ?? 90
  // The method's split: one third input, two thirds output — output is where the gains are.
  const inputMinutes = Math.round(blockMinutes / 3)
  const outputMinutes = blockMinutes - inputMinutes

  function updateBlock(id: string, patch: Partial<DraftBlock>) {
    setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)))
  }

  async function handleStart() {
    if (!userId || !profile?.activeLanguage) return
    setStarting(true)
    setError(null)
    try {
      const plannedBlocks: PlannedBlock[] = blocks.map((b) => ({
        id: b.id,
        // Input first, output next — the runner relies on this order.
        activities: [
          { kind: b.input, plannedMinutes: inputMinutes },
          { kind: b.output, plannedMinutes: outputMinutes },
        ],
        plannedMinutes: blockMinutes,
      }))
      const session = createSession({
        id: crypto.randomUUID(),
        userId,
        language: profile.activeLanguage,
        blocks: plannedBlocks,
        breakMinutes: profile.settings.breakMinutes,
        now: Date.now(),
      })
      await sessionRepo.put(session)
      loadSession(session)
      navigate(`/session/${session.id}`)
    } catch (e) {
      setError((e as Error).message)
      setStarting(false)
    }
  }

  function OptionPicker({
    options,
    value,
    pillar,
    onChange,
  }: {
    options: typeof INPUT_OPTIONS
    value: ActivityKind
    pillar: 'input' | 'output'
    onChange: (kind: ActivityKind) => void
  }) {
    const accent =
      pillar === 'input'
        ? { top: 'border-t-input', active: 'border-input bg-[#F0F4F7] text-[#24485C]' }
        : { top: 'border-t-output', active: 'border-output bg-[#F8EFE9] text-[#7C3A1B]' }
    return (
      <div className="grid grid-cols-3 gap-2">
        {options.map((o) => (
          <button
            key={o.kind}
            type="button"
            onClick={() => onChange(o.kind)}
            className={`rounded-lg border border-t-[3px] px-2 py-2.5 text-center transition-colors ${accent.top} ${
              value === o.kind
                ? accent.active
                : 'border-stone-200 bg-card text-stone-600 hover:border-stone-300'
            }`}
          >
            <span className="block text-sm font-bold">{o.label}</span>
            <span className="mt-0.5 block text-[11px] leading-tight text-stone-500">{o.hint}</span>
          </button>
        ))}
      </div>
    )
  }

  return (
    <div>
      <h2 className="font-display mb-2 text-[27px] font-bold">Plan a session</h2>
      <p className="max-w-prose text-sm text-stone-500">
        Each {blockMinutes}-minute block is <strong>{inputMinutes} min of input</strong> followed by{' '}
        <strong>{outputMinutes} min of output</strong> — output is where the real gains are.
        Breaks of {profile?.settings.breakMinutes ?? 20} minutes are enforced between blocks.
      </p>

      <div className="mt-6 flex flex-col gap-4">
        {blocks.map((block, bi) => (
          <div key={block.id} className="rounded-xl border border-stone-200 bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">Block {bi + 1}</h3>
              {blocks.length > 1 && (
                <button
                  onClick={() => setBlocks((bs) => bs.filter((b) => b.id !== block.id))}
                  className="text-xs text-stone-400 hover:text-output-deep"
                >
                  Remove block
                </button>
              )}
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <p className="mb-1.5 text-[10.5px] font-extrabold tracking-[.18em] text-input uppercase">
                  1 · Input — {inputMinutes} min
                </p>
                <OptionPicker
                  options={INPUT_OPTIONS}
                  value={block.input}
                  pillar="input"
                  onChange={(kind) => updateBlock(block.id, { input: kind })}
                />
              </div>
              <div>
                <p className="mb-1.5 text-[10.5px] font-extrabold tracking-[.18em] text-output uppercase">
                  2 · Output — {outputMinutes} min
                </p>
                <OptionPicker
                  options={OUTPUT_OPTIONS}
                  value={block.output}
                  pillar="output"
                  onChange={(kind) => updateBlock(block.id, { output: kind })}
                />
              </div>
            </div>
          </div>
        ))}

        <button
          onClick={() => setBlocks((bs) => [...bs, defaultBlock()])}
          className="rounded-xl border border-dashed border-stone-300 px-4 py-3 text-sm font-medium text-stone-500 hover:border-primary-500 hover:text-primary-700"
        >
          + Add another block
        </button>

        {error && <p className="text-sm text-output-deep">{error}</p>}

        <button
          onClick={handleStart}
          disabled={starting}
          className="rounded-[10px] bg-primary-700 px-5 pt-[16px] pb-[14px] text-[15px] font-bold text-[#F7F2E8] transition-colors hover:bg-primary-800 disabled:opacity-50"
        >
          {starting ? 'Creating…' : 'Start session'}
        </button>
      </div>
    </div>
  )
}
