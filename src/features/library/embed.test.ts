import { describe, expect, it } from 'vitest'
import { parseEmbed, isEmbeddable } from './embed'

describe('parseEmbed — YouTube', () => {
  it('parses a standard watch URL', () => {
    expect(parseEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toEqual({
      provider: 'youtube',
      embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    })
  })

  it('parses a youtu.be short link', () => {
    expect(parseEmbed('https://youtu.be/dQw4w9WgXcQ')).toEqual({
      provider: 'youtube',
      embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    })
  })

  it('parses a watch URL with extra params', () => {
    expect(parseEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s&list=abc')).toEqual({
      provider: 'youtube',
      embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    })
  })

  it('parses an /embed/ and /shorts/ URL', () => {
    expect(parseEmbed('https://www.youtube.com/embed/dQw4w9WgXcQ').provider).toBe('youtube')
    expect(parseEmbed('https://www.youtube.com/shorts/dQw4w9WgXcQ').embedUrl).toBe(
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
    )
  })

  it('parses a playlist-only URL to a videoseries embed', () => {
    expect(parseEmbed('https://www.youtube.com/playlist?list=PL123')).toEqual({
      provider: 'youtube',
      embedUrl: 'https://www.youtube.com/embed/videoseries?list=PL123',
    })
  })

  it('rejects a malformed video id', () => {
    expect(parseEmbed('https://www.youtube.com/watch?v=short').provider).toBe('none')
  })
})

describe('parseEmbed — Spotify', () => {
  it('parses track, playlist, episode, and show URLs', () => {
    expect(parseEmbed('https://open.spotify.com/track/6rqhFgbbKwnb9MLmUQDhG6').embedUrl).toBe(
      'https://open.spotify.com/embed/track/6rqhFgbbKwnb9MLmUQDhG6',
    )
    expect(parseEmbed('https://open.spotify.com/playlist/37i9dQ').embedUrl).toBe(
      'https://open.spotify.com/embed/playlist/37i9dQ',
    )
    expect(parseEmbed('https://open.spotify.com/episode/512ojhO').provider).toBe('spotify')
    expect(parseEmbed('https://open.spotify.com/show/4rOoJ6E').provider).toBe('spotify')
  })

  it('parses an intl-prefixed path and strips query params', () => {
    expect(parseEmbed('https://open.spotify.com/intl-es/track/abc123?si=xyz').embedUrl).toBe(
      'https://open.spotify.com/embed/track/abc123',
    )
  })
})

describe('parseEmbed — non-embeddable and invalid', () => {
  it('returns none for Netflix, Pandora, and arbitrary sites', () => {
    expect(parseEmbed('https://www.netflix.com/title/81040344').provider).toBe('none')
    expect(parseEmbed('https://www.pandora.com/artist/xyz').provider).toBe('none')
    expect(parseEmbed('https://example.com').provider).toBe('none')
  })

  it('returns none for empty, null, and non-http URLs', () => {
    expect(parseEmbed(null).provider).toBe('none')
    expect(parseEmbed('').provider).toBe('none')
    expect(parseEmbed('not a url').provider).toBe('none')
    expect(parseEmbed('javascript:alert(1)').provider).toBe('none')
  })
})

describe('isEmbeddable', () => {
  it('reflects parseEmbed', () => {
    expect(isEmbeddable('https://youtu.be/dQw4w9WgXcQ')).toBe(true)
    expect(isEmbeddable('https://www.netflix.com/title/1')).toBe(false)
    expect(isEmbeddable(null)).toBe(false)
  })
})
