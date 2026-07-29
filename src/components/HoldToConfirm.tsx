import { useEffect, useRef, useState } from 'react'

/**
 * A button that must be pressed and held for `holdMs` before firing.
 * Releasing early resets progress — this is the break-skip friction.
 */
const DEFAULT_CLASS =
  'rounded-[10px] border border-[rgba(241,234,219,.5)] px-5 pt-[13px] pb-[11px] text-sm font-bold text-night-text'

export function HoldToConfirm({
  holdMs = 5000,
  onConfirm,
  children,
  className,
}: {
  holdMs?: number
  onConfirm: () => void
  children: React.ReactNode
  /** Overrides the visual style; structural classes (progress fill) are always applied. */
  className?: string
}) {
  const [progress, setProgress] = useState(0)
  const raf = useRef<number | null>(null)
  const start = useRef<number | null>(null)
  const fired = useRef(false)

  function stop() {
    if (raf.current !== null) cancelAnimationFrame(raf.current)
    raf.current = null
    start.current = null
    setProgress(0)
  }

  function beginHold() {
    fired.current = false
    start.current = performance.now()
    const step = (t: number) => {
      if (start.current === null) return
      const p = Math.min(1, (t - start.current) / holdMs)
      setProgress(p)
      if (p >= 1) {
        if (!fired.current) {
          fired.current = true
          stop()
          onConfirm()
        }
        return
      }
      raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
  }

  useEffect(() => stop, [])

  return (
    <button
      type="button"
      onPointerDown={beginHold}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
      className={`relative touch-none overflow-hidden select-none ${className ?? DEFAULT_CLASS}`}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 bg-[rgba(241,234,219,.22)]"
        style={{ width: `${progress * 100}%` }}
      />
      <span className="relative">{children}</span>
    </button>
  )
}
