import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useActiveLanguage } from '../../services/queries/profile'
import {
  useLibraryItems,
  useSaveLibraryItem,
  useDeleteLibraryItem,
  useSetStarredLibraryItem,
} from '../../services/queries/library'
import {
  LIBRARY_ITEM_TYPES,
  LIBRARY_TYPE_LABEL,
  type LibraryItem,
  type LibraryItemType,
} from '../../domain/entities'
import { isEmbeddable } from './embed'

const inputClass =
  'rounded-lg border border-stone-300 bg-card px-3 py-2 text-sm outline-none focus:border-primary-500'

function matchesQuery(item: LibraryItem, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return [item.title, LIBRARY_TYPE_LABEL[item.type], item.url ?? ''].join(' ').toLowerCase().includes(q)
}

export function LibraryScreen() {
  const { userId } = useAuth()
  const language = useActiveLanguage()
  const { data: items, isLoading } = useLibraryItems()
  const saveItem = useSaveLibraryItem()
  const deleteItem = useDeleteLibraryItem()
  const setStarred = useSetStarredLibraryItem()

  const [type, setType] = useState<LibraryItemType>('show')
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [query, setQuery] = useState('')

  function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!title.trim() || !userId || !language) return
    const now = Date.now()
    const trimmedUrl = url.trim()
    saveItem.mutate({
      id: crypto.randomUUID(),
      userId,
      createdAt: now,
      updatedAt: now,
      language,
      type,
      title: title.trim(),
      url: trimmedUrl || null,
      starred: false,
    })
    setTitle('')
    setUrl('')
  }

  const filtered = items?.filter((i) => matchesQuery(i, query))

  return (
    <div>
      <h2 className="font-display mb-2 text-[27px] font-bold">Library</h2>
      <p className="max-w-prose text-sm text-stone-500">
        Save the books, shows, movies, podcasts, music, and articles you want to immerse in. Star one
        as your current focus — it&apos;ll show up during the immersion leg of your sessions.
      </p>

      <form
        onSubmit={handleAdd}
        className="mt-6 flex flex-col gap-2 rounded-xl border border-stone-200 bg-card p-4"
      >
        <p className="text-xs font-semibold tracking-wide text-stone-400 uppercase">Add to library</p>
        <div className="flex gap-2">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as LibraryItemType)}
            className={inputClass}
          >
            {LIBRARY_ITEM_TYPES.map((o) => (
              <option key={o.type} value={o.type}>
                {o.label}
              </option>
            ))}
          </select>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title — e.g. Squid Game"
            className={`flex-1 ${inputClass}`}
          />
        </div>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Link (optional) — YouTube or Spotify links play in-app"
          className={inputClass}
        />
        <button
          type="submit"
          disabled={saveItem.isPending || !title.trim()}
          className="self-start rounded-lg bg-primary-700 px-4 py-2.5 text-sm font-semibold text-[#F7F2E8] transition-colors hover:bg-primary-800 disabled:opacity-50"
        >
          Add
        </button>
        {saveItem.isError && (
          <p className="text-sm text-output-deep">{(saveItem.error as Error).message}</p>
        )}
      </form>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search your library…"
        className={`mt-6 mb-4 w-full ${inputClass}`}
      />

      <div className="flex flex-col gap-2">
        {isLoading && <p className="text-sm text-stone-400">Loading…</p>}
        {filtered?.length === 0 && (
          <p className="rounded-xl border border-dashed border-stone-300 bg-card p-6 text-center text-sm text-stone-400">
            {query.trim()
              ? 'Nothing in your library matches that search.'
              : 'Your library is empty — add your first piece of immersion content above.'}
          </p>
        )}
        {filtered?.map((item) => {
          const playable = isEmbeddable(item.url)
          return (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-xl border border-stone-200 bg-card px-4 py-3"
            >
              <button
                onClick={() => setStarred.mutate(item.id)}
                disabled={item.starred || setStarred.isPending}
                title={item.starred ? 'Current focus' : 'Set as focus'}
                aria-label={item.starred ? 'Current focus' : 'Set as focus'}
                className={`shrink-0 text-lg leading-none ${
                  item.starred ? 'text-output' : 'text-stone-300 hover:text-output'
                }`}
              >
                {item.starred ? '★' : '☆'}
              </button>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">
                  {item.title}
                  <span className="ml-2 rounded-full bg-stone-100 px-2 py-0.5 text-xs font-normal text-stone-500">
                    {LIBRARY_TYPE_LABEL[item.type]}
                  </span>
                  {playable && (
                    <span className="ml-1.5 text-xs font-semibold text-primary-700">
                      · plays in-app
                    </span>
                  )}
                </p>
                {item.url && <p className="truncate text-xs text-stone-400">{item.url}</p>}
              </div>

              <button
                onClick={() => {
                  if (confirm(`Remove "${item.title}" from your library?`)) deleteItem.mutate(item.id)
                }}
                className="shrink-0 text-xs text-stone-400 hover:text-output-deep"
              >
                Delete
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
