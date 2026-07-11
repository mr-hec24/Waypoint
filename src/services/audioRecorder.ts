// Thin MediaRecorder wrapper. webm/opus where supported, mp4 for Safari.

export interface RecordingResult {
  blob: Blob
  mimeType: string
  durationSec: number
}

export interface RecorderHandle {
  stop(): Promise<RecordingResult>
  cancel(): void
}

function pickMimeType(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? ''
}

export function extensionFor(mimeType: string): string {
  return mimeType.includes('mp4') ? 'm4a' : 'webm'
}

export async function startRecording(): Promise<RecorderHandle> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const mimeType = pickMimeType()
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
  const chunks: Blob[] = []
  const startedAt = Date.now()

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }
  recorder.start(1000) // periodic chunks so nothing is lost on long takes

  function releaseMic() {
    stream.getTracks().forEach((t) => t.stop())
  }

  return {
    stop: () =>
      new Promise<RecordingResult>((resolve) => {
        recorder.onstop = () => {
          releaseMic()
          const type = recorder.mimeType || mimeType || 'audio/webm'
          resolve({
            blob: new Blob(chunks, { type }),
            mimeType: type,
            durationSec: (Date.now() - startedAt) / 1000,
          })
        }
        recorder.stop()
      }),
    cancel: () => {
      recorder.onstop = null
      if (recorder.state !== 'inactive') recorder.stop()
      releaseMic()
    },
  }
}
