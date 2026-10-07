import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

interface MockOscillator {
  type: string
  frequency: { value: number }
  connect: ReturnType<typeof vi.fn>
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
}

interface MockGain {
  gain: {
    value: number
    setValueAtTime: ReturnType<typeof vi.fn>
    linearRampToValueAtTime: ReturnType<typeof vi.fn>
  }
  connect: ReturnType<typeof vi.fn>
}

interface MockContext {
  currentTime: number
  resume: ReturnType<typeof vi.fn>
  destination: object
  createOscillator: ReturnType<typeof vi.fn>
  createGain: ReturnType<typeof vi.fn>
}

function createMockContext(): { ctx: MockContext; oscillators: MockOscillator[]; gains: MockGain[] } {
  const oscillators: MockOscillator[] = []
  const gains: MockGain[] = []
  const ctx: MockContext = {
    currentTime: 100,
    resume: vi.fn().mockResolvedValue(undefined),
    destination: {},
    createOscillator: vi.fn(() => {
      const osc: MockOscillator = {
        type: '',
        frequency: { value: 0 },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      }
      oscillators.push(osc)
      return osc
    }),
    createGain: vi.fn(() => {
      const gain: MockGain = {
        gain: {
          value: 0,
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
      }
      gains.push(gain)
      return gain
    }),
  }
  return { ctx, oscillators, gains }
}

describe('sound-effects', () => {
  let mock: ReturnType<typeof createMockContext>

  beforeEach(async () => {
    mock = createMockContext()
    // Fresh module per test so the cached AudioContext does not leak.
    vi.resetModules()
    // Arrow functions cannot be constructed; use a class-style mock.
    const MockAudioContext = vi.fn(function (this: unknown) {
      return mock.ctx
    })
    vi.stubGlobal('AudioContext', MockAudioContext)
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  async function loadModule() {
    return await import('./sound-effects')
  }

  it('plays two ascending tones for a correct answer', async () => {
    const { playCorrectSound } = await loadModule()
    playCorrectSound()
    expect(mock.ctx.createOscillator).toHaveBeenCalledTimes(2)
    const [first, second] = mock.oscillators
    expect(first.frequency.value).toBe(659.25)
    expect(second.frequency.value).toBe(880)
    expect(first.type).toBe('sine')
    // Total duration under 500 ms.
    const lastStop: number = second.stop.mock.calls[0][0]
    expect(lastStop - mock.ctx.currentTime).toBeLessThan(0.5)
  })

  it('plays two gentle descending tones for an incorrect answer', async () => {
    const { playIncorrectSound } = await loadModule()
    playIncorrectSound()
    expect(mock.ctx.createOscillator).toHaveBeenCalledTimes(2)
    const [first, second] = mock.oscillators
    expect(first.frequency.value).toBe(220)
    expect(second.frequency.value).toBe(196)
    const lastStop: number = second.stop.mock.calls[0][0]
    expect(lastStop - mock.ctx.currentTime).toBeLessThan(0.5)
  })

  it('caps the master gain at 0.2', async () => {
    const { playCorrectSound } = await loadModule()
    playCorrectSound()
    // First gain node created is the master.
    expect(mock.gains[0].gain.value).toBe(0.2)
  })

  it('resumes the audio context on play', async () => {
    const { playCorrectSound } = await loadModule()
    playCorrectSound()
    expect(mock.ctx.resume).toHaveBeenCalled()
  })

  it('defaults to enabled and persists the mute choice', async () => {
    const { isSoundEnabled, setSoundEnabled } = await loadModule()
    expect(isSoundEnabled()).toBe(true)
    setSoundEnabled(false)
    expect(isSoundEnabled()).toBe(false)
    expect(window.localStorage.getItem('patternspell-sound-enabled')).toBe('false')
    setSoundEnabled(true)
    expect(isSoundEnabled()).toBe(true)
  })

  it('does nothing when muted', async () => {
    const { playCorrectSound, playIncorrectSound, setSoundEnabled } = await loadModule()
    setSoundEnabled(false)
    playCorrectSound()
    playIncorrectSound()
    expect(mock.ctx.createOscillator).not.toHaveBeenCalled()
  })

  it('reuses the cached audio context across plays', async () => {
    const { playCorrectSound, playIncorrectSound } = await loadModule()
    playCorrectSound()
    playIncorrectSound()
    // AudioContext constructor called once; second play reuses the cached instance.
    const MockAudioContext = window.AudioContext as unknown as ReturnType<typeof vi.fn>
    expect(MockAudioContext).toHaveBeenCalledTimes(1)
    expect(mock.ctx.createOscillator).toHaveBeenCalledTimes(4)
  })

  it('does nothing when AudioContext is unavailable', async () => {
    vi.stubGlobal('AudioContext', undefined)
    const { playCorrectSound, playIncorrectSound } = await loadModule()
    expect(() => {
      playCorrectSound()
      playIncorrectSound()
    }).not.toThrow()
  })

  it('returns true when localStorage throws on read', async () => {
    vi.spyOn(window.localStorage.__proto__, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    const { isSoundEnabled } = await loadModule()
    expect(isSoundEnabled()).toBe(true)
    vi.restoreAllMocks()
  })

  it('ignores localStorage errors on write', async () => {
    vi.spyOn(window.localStorage.__proto__, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    const { setSoundEnabled } = await loadModule()
    expect(() => setSoundEnabled(false)).not.toThrow()
    vi.restoreAllMocks()
  })
})
