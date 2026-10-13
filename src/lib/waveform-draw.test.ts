import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { drawLiveWaveform, drawReviewWaveform } from './waveform-draw'

function makeCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 384
  canvas.height = 96
  return canvas
}

function stub2d() {
  const ctx = { fillRect: vi.fn(), clearRect: vi.fn(), fillStyle: '' }
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ctx) as unknown as typeof HTMLCanvasElement.prototype.getContext
  return ctx
}

class FakeAnalyser {
  frequencyBinCount = 8
  getByteFrequencyData(array: Uint8Array): void {
    array.fill(120)
  }
}

describe('waveform-draw', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(() => 7)
    )
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn().mockReturnValue({ matches: false }),
      configurable: true,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('drawLiveWaveform', () => {
    it('draws bars and returns a cleanup that cancels the frame', () => {
      const ctx = stub2d()
      const canvas = makeCanvas()
      const cleanup = drawLiveWaveform(canvas, new FakeAnalyser() as unknown as AnalyserNode)
      expect(ctx.fillRect).toHaveBeenCalled()
      cleanup()
      expect(cancelAnimationFrame).toHaveBeenCalledWith(7)
    })

    it('returns a no-op when canvas or analyser is missing', () => {
      expect(() => drawLiveWaveform(null, new FakeAnalyser() as unknown as AnalyserNode)()).not.toThrow()
      expect(() => drawLiveWaveform(makeCanvas(), null)()).not.toThrow()
    })

    it('returns a no-op when the 2d context is missing', () => {
      HTMLCanvasElement.prototype.getContext = vi.fn(
        () => null
      ) as unknown as typeof HTMLCanvasElement.prototype.getContext
      const cleanup = drawLiveWaveform(makeCanvas(), new FakeAnalyser() as unknown as AnalyserNode)
      expect(() => cleanup()).not.toThrow()
    })

    it('handles sparse frequency data', () => {
      const ctx = stub2d()
      const sparseAnalyser = { frequencyBinCount: 1, getByteFrequencyData: (a: Uint8Array) => a.fill(50) }
      drawLiveWaveform(makeCanvas(), sparseAnalyser as unknown as AnalyserNode)
      expect(ctx.fillRect).toHaveBeenCalled()
    })

    it('uses a flat level when reduced motion is preferred', () => {
      Object.defineProperty(window, 'matchMedia', {
        value: vi.fn().mockReturnValue({ matches: true }),
        configurable: true,
      })
      const ctx = stub2d()
      drawLiveWaveform(makeCanvas(), new FakeAnalyser() as unknown as AnalyserNode)
      expect(ctx.fillRect).toHaveBeenCalled()
    })
  })

  describe('drawReviewWaveform', () => {
    class FakeAudioContext {
      decodeAudioData() {
        return Promise.resolve({ getChannelData: () => new Float32Array(960).fill(0.4) })
      }
      close() {
        return Promise.resolve()
      }
    }

    beforeEach(() => {
      vi.stubGlobal('AudioContext', FakeAudioContext)
    })

    it('draws the recorded waveform', async () => {
      const ctx = stub2d()
      const onError = vi.fn()
      drawReviewWaveform(makeCanvas(), new Blob(['audio']), onError)
      await vi.waitFor(() => expect(ctx.fillRect).toHaveBeenCalled())
      expect(onError).not.toHaveBeenCalled()
    })

    it('does nothing when canvas is missing', () => {
      const onError = vi.fn()
      expect(() => drawReviewWaveform(null, new Blob(['audio']), onError)).not.toThrow()
      expect(onError).not.toHaveBeenCalled()
    })

    it('does nothing when the 2d context is missing', () => {
      HTMLCanvasElement.prototype.getContext = vi.fn(
        () => null
      ) as unknown as typeof HTMLCanvasElement.prototype.getContext
      const onError = vi.fn()
      drawReviewWaveform(makeCanvas(), new Blob(['audio']), onError)
      expect(onError).not.toHaveBeenCalled()
    })

    it('does nothing when AudioContext is unavailable', () => {
      vi.unstubAllGlobals()
      const ctx = stub2d()
      const onError = vi.fn()
      // No AudioContext or webkitAudioContext on window.
      drawReviewWaveform(makeCanvas(), new Blob(['audio']), onError)
      expect(ctx.fillRect).not.toHaveBeenCalled()
      expect(onError).not.toHaveBeenCalled()
    })

    it('draws silence as a flat line', async () => {
      const ctx = stub2d()
      const onError = vi.fn()
      class SilentAudioContext {
        decodeAudioData() {
          return Promise.resolve({ getChannelData: () => new Float32Array(960).fill(0) })
        }
        close() {
          return Promise.resolve()
        }
      }
      vi.stubGlobal('AudioContext', SilentAudioContext)
      drawReviewWaveform(makeCanvas(), new Blob(['audio']), onError)
      await vi.waitFor(() => expect(ctx.fillRect).toHaveBeenCalled())
      expect(onError).not.toHaveBeenCalled()
    })

    it('reports decode errors via onError', async () => {
      stub2d()
      class FailingAudioContext extends FakeAudioContext {
        override decodeAudioData() {
          return Promise.reject(new Error('bad audio'))
        }
      }
      vi.stubGlobal('AudioContext', FailingAudioContext)
      const onError = vi.fn()
      drawReviewWaveform(makeCanvas(), new Blob(['audio']), onError)
      await vi.waitFor(() => expect(onError).toHaveBeenCalled())
    })

    it('tolerates AudioContext close failure after drawing', async () => {
      const ctx = stub2d()
      const onError = vi.fn()
      let closeCalls = 0
      class RejectCloseAudioContext extends FakeAudioContext {
        override close() {
          closeCalls++
          return Promise.reject(new Error('close failed'))
        }
      }
      vi.stubGlobal('AudioContext', RejectCloseAudioContext)
      drawReviewWaveform(makeCanvas(), new Blob(['audio']), onError)
      await vi.waitFor(() => expect(ctx.fillRect).toHaveBeenCalled())
      await vi.waitFor(() => expect(closeCalls).toBe(1))
      // Let the rejected close() settle through the swallowing catch.
      await new Promise((resolve) => setTimeout(resolve, 10))
      expect(onError).not.toHaveBeenCalled()
    })

    it('tolerates AudioContext close failure after a decode error', async () => {
      stub2d()
      const onError = vi.fn()
      let closeCalls = 0
      class FailingCloseAudioContext extends FakeAudioContext {
        override decodeAudioData() {
          return Promise.reject(new Error('bad audio'))
        }
        override close() {
          closeCalls++
          return Promise.reject(new Error('close failed'))
        }
      }
      vi.stubGlobal('AudioContext', FailingCloseAudioContext)
      drawReviewWaveform(makeCanvas(), new Blob(['audio']), onError)
      await vi.waitFor(() => expect(onError).toHaveBeenCalledWith(expect.any(Error)))
      await vi.waitFor(() => expect(closeCalls).toBe(1))
      // Let the rejected close() settle through the swallowing catch.
      await new Promise((resolve) => setTimeout(resolve, 10))
    })
  })
})
