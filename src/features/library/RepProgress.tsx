import { LIBRARY_REP_TARGET } from '../../domain/entities'

// A row of dots showing passes toward the suggested target, plus a count label. Past the target it
// keeps counting ("9 passes") rather than implying a hard cap. Two palettes: light (paper screens)
// and night (the runner's night-drive theme).

const PALETTE = {
  light: { filled: 'bg-output', empty: 'bg-stone-200', text: 'text-stone-500' },
  night: { filled: 'bg-sun', empty: 'bg-night-border', text: 'text-night-sage' },
} as const

export function RepProgress({
  reps,
  variant = 'light',
}: {
  reps: number
  variant?: 'light' | 'night'
}) {
  const c = PALETTE[variant]
  const filled = Math.min(reps, LIBRARY_REP_TARGET)
  const label = reps >= LIBRARY_REP_TARGET ? `${reps} passes` : `${reps} / ${LIBRARY_REP_TARGET} passes`

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1" aria-hidden>
        {Array.from({ length: LIBRARY_REP_TARGET }, (_, i) => (
          <span key={i} className={`h-[7px] w-[7px] rounded-full ${i < filled ? c.filled : c.empty}`} />
        ))}
      </div>
      <span className={`text-xs font-semibold tabular-nums ${c.text}`}>{label}</span>
    </div>
  )
}
