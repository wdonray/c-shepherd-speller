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
  // Capture narrowed values: narrowing does not survive into the nested
  // helpers below.
  const targetCanvas: HTMLCanvasElement = canvas
  const targetCtx: CanvasRenderingContext2D = ctx
  const AudioContextClass =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextClass) return
  const audioContext = new AudioContextClass()
  blob
    .arrayBuffer()
    .then((buffer) => audioContext.decodeAudioData(buffer))
    .then((audioBuffer) => {
      drawBars(channelDataToPeaks(audioBuffer.getChannelData(0), 96))
      return audioContext.close().catch(() => {})
    })
    .catch((error: unknown) => {
      onError(error)
      // decodeAudioData rejects on some platforms (e.g. iOS Safari cannot
      // decode the MediaRecorder-produced blob) even though the recording
      // itself plays fine. Draw a neutral flat line so the review canvas
      // never looks broken instead of leaving it blank.
      drawBars(new Float32Array(96).fill(0))
      audioContext.close().catch(() => {})
    })

  /** Peak amplitude per bar, normalized 0..1. */
  function channelDataToPeaks(channelData: Float32Array, barCount: number): Float32Array {
    const peaks = new Float32Array(barCount)
    const step = Math.max(1, Math.floor(channelData.length / barCount))
    for (let i = 0; i < barCount; i++) {
      let max = 0
      for (let j = 0; j < step; j += 10) {
        const sample = Math.abs(channelData[i * step + j])
        if (sample > max) max = sample
      }
      peaks[i] = max
    }
    return peaks
  }

  /** Render normalized peaks as centered bars on the canvas. */
  function drawBars(peaks: Float32Array): void {
    const { width, height } = targetCanvas
    const barCount = peaks.length
    targetCtx.clearRect(0, 0, width, height)
    targetCtx.fillStyle = '#0e7490'
    for (let i = 0; i < barCount; i++) {
      const barHeight = Math.max(3, peaks[i] * height)
      const x = (i / barCount) * width
      const y = (height - barHeight) / 2
      targetCtx.fillRect(x, y, Math.max(1, width / barCount - 2), barHeight)
    }
  }
}
