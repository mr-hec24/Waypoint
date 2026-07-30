import { Link } from 'react-router'
import { useStarredLibraryItem, useLogLibraryRepetition } from '../../services/queries/library'
import { LIBRARY_TYPE_LABEL } from '../../domain/entities'
import { parseEmbed } from './embed'
import { EmbedPlayer } from './EmbedPlayer'
import { RepProgress } from './RepProgress'
import { repMessage } from './reps'

// Shown during the Immersion input leg of a session. Surfaces the journey's single starred "focus"
// item — embedding the player in-app for YouTube/Spotify so the learner doesn't wander off, and
// showing a link-free reminder for everything else (Netflix, Pandora, …) that can't be embedded.

export function StarredImmersionPanel() {
  const { data: item, isLoading } = useStarredLibraryItem()
  const logRep = useLogLibraryRepetition()

  if (isLoading) return null

  if (!item) {
    return (
      <div className="w-full rounded-xl border border-dashed border-night-border bg-night-panel px-4 py-5 text-center">
        <p className="text-[13.5px] text-night-sage">
          No focus item starred yet. Star something in your{' '}
          <Link to="/library" className="font-bold text-[#D9A084] underline decoration-dotted">
            Library
          </Link>{' '}
          to see it here during immersion.
        </p>
      </div>
    )
  }

  const embed = parseEmbed(item.url)
  const typeLabel = LIBRARY_TYPE_LABEL[item.type]

  return (
    <div className="flex w-full flex-col gap-3">
      <p className="text-[11px] font-extrabold tracking-[.22em] text-night-sage uppercase">
        ★ Focus · {typeLabel}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <RepProgress reps={item.repetitions} variant="night" />
        <button
          onClick={() => logRep.mutate(item)}
          disabled={logRep.isPending}
          className="rounded-lg border border-night-border px-3 pt-[6px] pb-[4px] text-xs font-bold text-[#D9A084] hover:bg-night-panel disabled:opacity-50"
        >
          + Log a rewatch
        </button>
      </div>
      <p className="text-xs text-night-sage italic">{repMessage(item.repetitions)}</p>

      {embed.provider !== 'none' ? (
        <>
          <p className="font-display text-lg font-bold text-night-text">{item.title}</p>
          <EmbedPlayer embed={embed} title={item.title} />
          <p className="text-xs text-night-sage">
            Stay with this until the fork — playback stops automatically when input is over.
          </p>
        </>
      ) : (
        // Non-embeddable (Netflix, Pandora, …): reminder only, no outbound link — by design.
        <div className="rounded-xl border border-night-border bg-night-panel px-4 py-5">
          <p className="font-display text-lg font-bold text-night-text">{item.title}</p>
          <p className="mt-2 text-[13.5px] text-night-sage">
            Go watch/listen to this in one focused sitting — no autoplay into the next thing — then
            come straight back for output.
          </p>
        </div>
      )}
    </div>
  )
}
