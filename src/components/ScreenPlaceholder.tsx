export function ScreenPlaceholder({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div>
      <h2 className="mb-2 text-2xl font-bold">{title}</h2>
      <p className="max-w-prose text-sm text-stone-500">{description}</p>
      <div className="mt-8 rounded-xl border border-dashed border-stone-300 bg-card p-8 text-center text-sm text-stone-400">
        Coming soon
      </div>
    </div>
  )
}
