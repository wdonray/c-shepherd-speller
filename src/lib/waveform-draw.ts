/**
 * Canvas waveform rendering for the voice recorder modal.
 *
 * drawLiveWaveform renders real-time amplitude bars from an AnalyserNode.
 * drawReviewWaveform renders a static waveform from a recorded Blob.
 * Both are defensive about missing canvas/context; the modal guarantees
 * they exist when called, but the guards keep a rare browser quirk from
 * crashing the recording flow.
 */

/** Draw one frame of live amplitude bars. Returns a cleanup function. */
export function drawLiveWaveform(canvas: HTMLCanvasElement | null, analyser: AnalyserNode | null): () => void {
  if (!canvas || !analyser) return () => {}
  const ctx = canvas.getContext('2d')
  if (!ctx) return () => {}
  const data = new Uint8Array(analyser.frequencyBinCount)
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  let animationId = 0
  const draw = (): void => {
    animationId = requestAnimationFrame(draw)
    analyser.getByteFrequencyData(data)
    const { width, height } = canvas
    ctx.clearRect(0, 0, width, height)
    const barCount = 48
    const barWidth = width / barCount
    for (let i = 0; i < barCount; i++) {
      // Sample across the frequency bins for a lively, voice-like shape.
      const value = data[Math.floor((i / barCount) * data.length * 0.7)]
      const barHeight = reducedMotion ? height * 0.2 : Math.max(3, (value / 255) * height)
      const x = i * barWidth
      const y = (height - barHeight) / 2
      ctx.fillStyle = '#0e7490'
      const gap = 2
      ctx.fillRect(x + gap / 2, y, barWidth - gap, barHeight)
    }
  }
  draw()
  return () => cancelAnimationFrame(animationId)
}

/** Draw a static waveform from a recorded audio Blob. */
export function drawReviewWaveform(
  canvas: HTMLCanvasElement | null,
  blob: Blob,
  onError: (error: unknown) => void
): void {
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const AudioContextClass =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextClass) return
  const audioContext = new AudioContextClass()
  blob
    .arrayBuffer()
    .then((buffer) => audioContext.decodeAudioData(buffer))
    .then((audioBuffer) => {
      const channelData = audioBuffer.getChannelData(0)
      const { width, height } = canvas
      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = '#0e7490'
      const barCount = 96
      const step = Math.floor(channelData.length / barCount)
      for (let i = 0; i < barCount; i++) {
        let max = 0
        for (let j = 0; j < step; j += 10) {
          const sample = Math.abs(channelData[i * step + j])
          if (sample > max) max = sample
        }
        const barHeight = Math.max(3, max * height)
        const x = (i / barCount) * width
        const y = (height - barHeight) / 2
        ctx.fillRect(x, y, Math.max(1, width / barCount - 2), barHeight)
      }
      return audioContext.close().catch(() => {})
    })
    .catch((error: unknown) => {
      onError(error)
      audioContext.close().catch(() => {})
    })
}
