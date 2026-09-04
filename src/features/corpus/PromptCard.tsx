import type { CorpusPrompt } from './prompts'
import { domainLabel } from './domains'

interface Props {
  prompt: CorpusPrompt | null
  onShuffle: () => void
  disabled?: boolean
}

export function PromptCard({ prompt, onShuffle, disabled }: Props) {
  if (!prompt) return null
  return (
    <div className="rounded-xl border border-stone-200 bg-paper p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10.5px] font-extrabold tracking-[.2em] text-stone-500 uppercase">
          {domainLabel(prompt.domain)}
        </p>
        <button
          type="button"
          onClick={onShuffle}
          disabled={disabled}
          className="text-xs font-medium text-stone-500 hover:text-ink disabled:opacity-50"
        >
          Different prompt →
        </button>
      </div>
      <p className="font-display mt-2 text-[19px] leading-snug font-bold text-ink">{prompt.text}</p>
      <p className="mt-2 text-xs text-stone-500">
        Talk for two or three minutes. Ramble, repeat yourself, lose your thread — none of that
        hurts the count, and stopping to think of the perfect word does.
      </p>
    </div>
  )
}
