import { useState } from 'react'
import { useReviewLogs } from '../../services/queries/flashcards'
import { useSleepLogs } from '../../services/queries/logs'
import { correlateSleepRecall } from '../../domain/sleep/analysis'

/**
 * Correlates logged sleep with actual flashcard recall over the last ~30 days.
 * This is the payoff that makes sleep tracking worth it — honest feedback, not
 * a vanity metric. It never influences scheduling.
 *
 * `hideUntilReady` (Today screen) renders nothing until there's enough data;
 * the Logs → Rest tab leaves it off to show the "keep logging" nudge instead.
 */
export function RestRecallInsight({ hideUntilReady = false }: { hideUntilReady?: boolean }) {
  // Stable window: computed once per mount so the query key doesn't churn.
  const [range] = useState(() => {
    const to = Date.now()
    return { from: to - 30 * 24 * 60 * 60 * 1000, to }
  })
  const { data: sleepLogs } = useSleepLogs(60)
  const { data: reviewLogs } = useReviewLogs(range.from, range.to)

  if (!sleepLogs || !reviewLogs) return null

  const insight = correlateSleepRecall(sleepLogs, reviewLogs)
  const pct = (n: number) => `${Math.round(n * 100)}%`

  if (!insight.hasEnoughData) {
    if (hideUntilReady) return null
    return (
      <div className="rounded-xl border border-rest-border bg-rest-bg px-4 py-3.5 text-rest-text">
        <p className="text-[10.5px] font-extrabold tracking-[.18em] uppercase">Rest → recall</p>
        <p className="mt-1 text-[13px] leading-relaxed">
          Keep logging your sleep and reviewing cards — once there&apos;s enough of both, this
          shows whether your rested days actually recall better.
        </p>
      </div>
    )
  }

  const restedBetter = insight.rested.accuracy >= insight.rough.accuracy
  const gap = Math.round(Math.abs(insight.rested.accuracy - insight.rough.accuracy) * 100)

  return (
    <div className="rounded-xl border border-rest-border bg-rest-bg px-4 py-3.5 text-rest-text">
      <p className="text-[10.5px] font-extrabold tracking-[.18em] uppercase">Rest → recall</p>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <div>
          <p className="text-2xl font-extrabold tabular-nums">{pct(insight.rested.accuracy)}</p>
          <p className="text-[11px] font-semibold">recalled after a good night</p>
        </div>
        <div>
          <p className="text-2xl font-extrabold tabular-nums">{pct(insight.rough.accuracy)}</p>
          <p className="text-[11px] font-semibold">after a rough night</p>
        </div>
      </div>
      <p className="mt-2 text-[12.5px] leading-relaxed">
        {restedBetter && gap >= 3
          ? `Early pattern: you recall about ${gap} points more when you're rested. Sleep is fuel for the roadtrip.`
          : "So far your recall holds up regardless of sleep — keep logging to see if that lasts."}
      </p>
    </div>
  )
}
