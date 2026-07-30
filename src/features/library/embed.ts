// Turn a user-entered content URL into a safe, in-app embed URL.
//
// Security: we only ever build an iframe src from an allow-listed provider by extracting an id and
// reconstructing a known-good embed URL — a raw user URL is never passed straight into an iframe.

export type EmbedProvider = 'youtube' | 'spotify' | 'none'

export interface ParsedEmbed {
  provider: EmbedProvider
  /** Present only when provider !== 'none'. Safe to use as an iframe src. */
  embedUrl?: string
}

const SPOTIFY_TYPES = new Set(['track', 'album', 'playlist', 'episode', 'show', 'artist'])

/** YouTube video id: 11 chars of [A-Za-z0-9_-]. */
const YT_ID = /^[A-Za-z0-9_-]{11}$/

function parseUrl(raw: string): URL | null {
  try {
    return new URL(raw.trim())
  } catch {
    return null
  }
}

function host(url: URL): string {
  return url.hostname.replace(/^www\./, '').toLowerCase()
}

function parseYouTube(url: URL): ParsedEmbed | null {
  const h = host(url)
  // Playlist links (watch?list= or playlist?list=) → playlist embed.
  const list = url.searchParams.get('list')

  if (h === 'youtu.be') {
    const id = url.pathname.slice(1)
    if (YT_ID.test(id)) return { provider: 'youtube', embedUrl: `https://www.youtube.com/embed/${id}` }
  }

  if (h === 'youtube.com' || h === 'm.youtube.com' || h === 'music.youtube.com') {
    const v = url.searchParams.get('v')
    if (v && YT_ID.test(v)) {
      return { provider: 'youtube', embedUrl: `https://www.youtube.com/embed/${v}` }
    }
    const embedMatch = url.pathname.match(/^\/embed\/([A-Za-z0-9_-]{11})/)
    if (embedMatch) {
      return { provider: 'youtube', embedUrl: `https://www.youtube.com/embed/${embedMatch[1]}` }
    }
    const shortsMatch = url.pathname.match(/^\/shorts\/([A-Za-z0-9_-]{11})/)
    if (shortsMatch) {
      return { provider: 'youtube', embedUrl: `https://www.youtube.com/embed/${shortsMatch[1]}` }
    }
    if (list) {
      return {
        provider: 'youtube',
        embedUrl: `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(list)}`,
      }
    }
  }
  return null
}

function parseSpotify(url: URL): ParsedEmbed | null {
  if (host(url) !== 'open.spotify.com') return null
  // Paths look like /track/{id} or /intl-xx/track/{id}. Grab the last {type}/{id} pair.
  const segments = url.pathname.split('/').filter(Boolean)
  for (let i = 0; i < segments.length - 1; i++) {
    const type = segments[i]!.toLowerCase()
    const id = segments[i + 1]!
    if (SPOTIFY_TYPES.has(type) && /^[A-Za-z0-9]+$/.test(id)) {
      return { provider: 'spotify', embedUrl: `https://open.spotify.com/embed/${type}/${id}` }
    }
  }
  return null
}

export function parseEmbed(rawUrl: string | null | undefined): ParsedEmbed {
  if (!rawUrl) return { provider: 'none' }
  const url = parseUrl(rawUrl)
  if (!url) return { provider: 'none' }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return { provider: 'none' }
  return parseYouTube(url) ?? parseSpotify(url) ?? { provider: 'none' }
}

/** True when the URL can be played inside the app. */
export function isEmbeddable(url: string | null | undefined): boolean {
  return parseEmbed(url).provider !== 'none'
}
