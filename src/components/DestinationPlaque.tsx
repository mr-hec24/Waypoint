/**
 * The signature "park plaque" framing for the user's intention. Keeps its
 * light paper face even on dark screens (it glows against the dusk).
 */
export function DestinationPlaque({
  statement,
  label = 'Destination',
  compact = false,
}: {
  statement: string
  label?: string
  compact?: boolean
}) {
  return (
    <div className="rounded-[10px] border-2 border-primary-700 bg-card p-[5px]">
      <div className="rounded-md border border-primary-700/45 px-4 py-4 text-center">
        <p className="text-[10.5px] font-extrabold tracking-[.24em] text-primary-700 uppercase">
          ◆ {label} ◆
        </p>
        <p
          className={`font-display mt-2 italic leading-[1.6] text-ink ${
            compact ? 'text-[14px]' : 'text-[15.5px]'
          }`}
        >
          {statement}
        </p>
      </div>
    </div>
  )
}
