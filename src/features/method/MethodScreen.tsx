import { MethodPrimer } from './MethodPrimer'

export function MethodScreen() {
  return (
    <div>
      <h2 className="font-display mb-2 text-[27px] font-bold">How the method works</h2>
      <p className="mb-5 max-w-prose text-sm text-stone-500">
        The reasoning behind the way this app is built. Worth rereading once you have a few
        sessions behind you — most of it lands differently the second time.
      </p>
      <MethodPrimer />
    </div>
  )
}
