import { CORPUS_SEED_TOKENS } from '../../domain/entities'
import type { CorpusStats } from '../../domain/corpus/frequency'
import { domainLabel } from './domains'
import { milestoneMessage } from './messages'

interface Props {
  stats: CorpusStats
  saturationPct: number | null
  domains: string[]
  covered: Record<string, boolean>
}

/**
 * A fixed quota ("record five conversations") is a guess. This reads the learner's
 * actual data instead: which topics are still missing, how much of everyday speech
 * the list already covers, and whether another session would add anything.
 */
export function CoveragePanel({ stats, saturationPct, domains, covered }: Props) {
  const seedPct = Math.min(100, Math.round((stats.tokens / CORPUS_SEED_TOKENS) * 100))
  const coveredCount = domains.filter((d) => covered[d]).length

  return (
    <div className="rounded-xl border border-stone-200 bg-card p-4">
      <p className="text-[10.5px] font-extrabold tracking-[.2em] text-stone-500 uppercase">
        Ground covered
      </p>

      {domains.length > 0 && (
        <div className="mt-3">
          <p className="text-sm text-stone-600">
            <span className="font-bold text-ink">
              {coveredCount} of {domains.length}
            </span>{' '}
            topics covered
          </p>
          <p className="mt-0.5 text-xs text-stone-500">
            Breadth matters more than hours — the words that make this list yours only turn up
            when the topic does.
          </p>
          <ul className="mt-2.5 flex flex-wrap gap-1.5">
            {domains.map((slug) => (
              <li
                key={slug}
                className={
                  covered[slug]
                    ? 'rounded-full bg-primary-700 px-2.5 py-1 text-xs font-medium text-[#F7F2E8]'
                    : 'rounded-full border border-dashed border-stone-300 px-2.5 py-1 text-xs text-stone-400'
                }
              >
                {covered[slug] ? '● ' : '○ '}
                {domainLabel(slug)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-stone-200 pt-3.5">
        <Stat label="Your words" value={stats.tokens.toLocaleString()} />
        <Stat label="List entries" value={String(stats.stable)} />
        <Stat label="Speech covered" value={`${stats.estimatedCoveragePct}%`} />
      </dl>

      <div className="mt-3">
        <div className="h-1.5 overflow-hidden rounded-full bg-stone-200">
          <div className="h-full rounded-full bg-input" style={{ width: `${seedPct}%` }} />
        </div>
        <p className="mt-2 text-xs text-stone-500">
          {milestoneMessage(stats.tokens, saturationPct)}
        </p>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10.5px] font-extrabold tracking-[.14em] text-stone-500 uppercase">
        {label}
      </dt>
      <dd className="font-display text-[21px] font-bold text-ink">{value}</dd>
    </div>
  )
}

