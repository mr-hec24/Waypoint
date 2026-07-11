import { useEffect, useRef, useState } from 'react'

function fmt(sec: number): string {
  if (!Number.isFinite(sec)) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Pill-shaped audio player: round forest play button + slim progress track. */
export function AudioPlayer({ src, durationSec }: { src: string; durationSec?: number }) {
  const audio = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(durationSec ?? 0)

  useEffect(() => {
    const el = audio.current
    if (!el) return
    const onTime = () => setTime(el.currentTime)
    const onMeta = () => {
      if (Number.isFinite(el.duration) && el.duration > 0) setDuration(el.duration)
    }
    const onEnd = () => setPlaying(false)
    el.addEventListener('timeupdate', onTime)
    el.addEventListener('loadedmetadata', onMeta)
    el.addEventListener('durationchange', onMeta)
    el.addEventListener('ended', onEnd)
    return () => {
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('loadedmetadata', onMeta)
      el.removeEventListener('durationchange', onMeta)
      el.removeEventListener('ended', onEnd)
    }
  }, [src])

  function toggle() {
    const el = audio.current
    if (!el) return
    if (playing) {
      el.pause()
      setPlaying(false)
    } else {
      void el.play()
      setPlaying(true)
    }
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const el = audio.current
    if (!el || duration === 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    el.currentTime = ((e.clientX - rect.left) / rect.width) * duration
  }

  const progress = duration > 0 ? Math.min(1, time / duration) : 0

  return (
    <div className="flex items-center gap-3 rounded-full border border-stone-200 bg-card p-2 pr-4">
      <audio ref={audio} src={src} preload="metadata" />
      <button
        onClick={toggle}
        aria-label={playing ? 'Pause' : 'Play'}
        className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-primary-700 text-[#F7F2E8] hover:bg-primary-800"
      >
        {playing ? (
          <span className="flex gap-[3px]">
            <span className="h-3 w-[3px] rounded-sm bg-current" />
            <span className="h-3 w-[3px] rounded-sm bg-current" />
          </span>
        ) : (
          <span className="ml-0.5 inline-block border-y-[6px] border-l-[10px] border-y-transparent border-l-current" />
        )}
      </button>
      <div className="h-1 flex-1 cursor-pointer rounded-full bg-stone-200" onClick={seek}>
        <div
          className="h-full rounded-full bg-primary-700"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      <span className="shrink-0 text-xs text-stone-600 tabular-nums">
        {fmt(time)} / {fmt(duration)}
      </span>
    </div>
  )
}
