export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`
}

/**
 * Night-drive countdown ring: dark track, gold progress, and a rust
 * "waypoint dot" traveling at the head of the arc. `fraction` is time
 * remaining, 0..1.
 */
export function TimerRing({
  fraction,
  label,
  sublabel,
}: {
  fraction: number
  label: string
  sublabel?: string
}) {
  const r = 88
  const c = 2 * Math.PI * r
  const f = Math.max(0, Math.min(1, fraction))
  // The svg is rotated -90° so the arc starts at 12 o'clock; the head of the
  // arc sits at angle f·360° in the rotated coordinate space.
  const headX = 100 + r * Math.cos(f * 2 * Math.PI)
  const headY = 100 + r * Math.sin(f * 2 * Math.PI)

  return (
    <div className="relative h-[230px] w-[230px]">
      <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
        <circle cx="100" cy="100" r={r} fill="none" strokeWidth="9" className="stroke-night-border" />
        <circle
          cx="100"
          cy="100"
          r={r}
          fill="none"
          strokeWidth="9"
          strokeLinecap="round"
          className="stroke-sun"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - f)}
        />
        <circle cx={headX} cy={headY} r="7" strokeWidth="3" className="fill-output stroke-night" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[42px] font-extrabold tabular-nums text-[#F7F2E8]">{label}</span>
        {sublabel && (
          <span className="mt-1 text-[10.5px] font-extrabold tracking-[.24em] text-night-sage uppercase">
            {sublabel}
          </span>
        )}
      </div>
    </div>
  )
}
