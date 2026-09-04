import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'

const tabs = [
  { to: '/', label: 'Today' },
  { to: '/review', label: 'Review' },
  { to: '/speaking', label: 'Speaking' },
  { to: '/writing', label: 'Writing' },
  { to: '/library', label: 'Library' },
  { to: '/logs', label: 'Logs' },
  { to: '/settings', label: 'Settings' },
]

/* Seven stops don't fit across a phone. The four daily ones stay on the bar;
   the rest live behind "More" so nothing runs off the edge of the screen. */
const PRIMARY_TABS = tabs.slice(0, 4)
const MORE_TABS = tabs.slice(4)

/* Route-dot navigation: a small rust dot marks the active stop; inactive dots
   stay transparent so the layout never shifts. */
function navClass({ isActive }: { isActive: boolean }) {
  return [
    'flex flex-col items-center gap-1 rounded-lg px-3 pt-2 pb-1.5 text-[10.5px] font-extrabold tracking-[.1em] uppercase transition-colors',
    'md:flex-row md:gap-2.5 md:px-4 md:py-2.5 md:text-[11px]',
    isActive ? 'text-primary-700' : 'text-stone-500 hover:text-stone-700',
  ].join(' ')
}

function RouteDot({ isActive }: { isActive: boolean }) {
  return (
    <span
      aria-hidden
      className={`h-[5px] w-[5px] rounded-full ${isActive ? 'bg-output' : 'bg-transparent'}`}
    />
  )
}

function matchesRoute(pathname: string, to: string) {
  return to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`)
}

export function Layout() {
  const { pathname } = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)
  const moreIsActive = MORE_TABS.some((t) => matchesRoute(pathname, t.to))

  // Close the sheet whenever we land somewhere new, or on Escape.
  useEffect(() => setMoreOpen(false), [pathname])
  useEffect(() => {
    if (!moreOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [moreOpen])

  return (
    <div className="min-h-dvh md:flex">
      {/* Sidebar (desktop) */}
      <aside className="hidden w-56 shrink-0 border-r border-stone-200 bg-card p-4 md:flex md:flex-col">
        <div className="mb-8 px-2">
          <h1 className="font-display text-lg font-bold text-primary-900">Waypoint</h1>
          <p className="mt-0.5 text-[10px] font-extrabold tracking-[.22em] text-stone-500 uppercase">
            Input · Output · Maintenance
          </p>
        </div>
        <nav className="flex flex-col gap-1">
          {tabs.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.to === '/'}>
              {({ isActive }) => (
                <span className={navClass({ isActive })}>
                  <RouteDot isActive={isActive} />
                  {t.label}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Content */}
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-6 pb-24 md:px-8 md:pb-8">
        <Outlet />
      </main>

      {/* Backdrop for the "More" sheet (mobile) */}
      {moreOpen && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setMoreOpen(false)}
          className="fixed inset-0 z-30 bg-stone-900/20 md:hidden"
        />
      )}

      {/* Bottom tab bar (mobile) */}
      <div className="fixed inset-x-0 bottom-0 z-40 md:hidden">
        {moreOpen && (
          <div
            id="more-tabs"
            className="mx-2 mb-1 overflow-hidden rounded-2xl border border-stone-200 bg-card shadow-lg"
          >
            {MORE_TABS.map((t) => (
              <NavLink key={t.to} to={t.to}>
                {({ isActive }) => (
                  <span
                    className={[
                      'flex items-center gap-2.5 border-b border-stone-100 px-4 py-3.5 text-[11px] font-extrabold tracking-[.1em] uppercase transition-colors last:border-b-0',
                      isActive ? 'text-primary-700' : 'text-stone-500',
                    ].join(' ')}
                  >
                    <RouteDot isActive={isActive} />
                    {t.label}
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        )}

        <nav
          className="flex justify-around border-t border-stone-200 bg-card/95 pt-1 backdrop-blur"
          style={{ paddingBottom: 'calc(0.375rem + env(safe-area-inset-bottom))' }}
        >
          {PRIMARY_TABS.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.to === '/'}>
              {({ isActive }) => (
                <span className={navClass({ isActive })}>
                  <RouteDot isActive={isActive} />
                  {t.label}
                </span>
              )}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            aria-expanded={moreOpen}
            aria-controls="more-tabs"
            className={navClass({ isActive: moreIsActive || moreOpen })}
          >
            <RouteDot isActive={moreIsActive} />
            More
          </button>
        </nav>
      </div>
    </div>
  )
}
