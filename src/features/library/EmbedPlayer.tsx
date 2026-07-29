import type { ParsedEmbed } from './embed'

// Plain-iframe players. No external IFrame API scripts are needed: when the runner swaps the input
// panel out at the fork, this component unmounts, the iframe is removed from the DOM, and playback
// stops on its own — which is exactly the "move on to output" nudge we want.

export function EmbedPlayer({ embed, title }: { embed: ParsedEmbed; title: string }) {
  if (embed.provider === 'youtube') {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-xl border border-night-border bg-black">
        <iframe
          src={embed.embedUrl}
          title={title}
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    )
  }

  if (embed.provider === 'spotify') {
    return (
      <iframe
        src={embed.embedUrl}
        title={title}
        className="w-full rounded-xl border border-night-border"
        height={352}
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
      />
    )
  }

  return null
}
