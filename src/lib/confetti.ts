import confetti from 'canvas-confetti'
import { prefersReducedMotion } from './sort-motion'

/** Brand colors for the win confetti: leaf, sun, sky, coral. */
const WIN_CONFETTI_COLORS = ['#367b17', '#ffc42e', '#2fa8de', '#b43c1c']

/**
 * Main-thread confetti cannon, created lazily on first win. The library
 * defaults to rendering inside a Web Worker, but this app's
 * Content-Security-Policy has no `worker-src` directive, so the blob:
 * worker is blocked: the canvas is left in a dead offscreen state and
 * confetti silently never renders. Forcing `useWorker: false` renders on
 * the main thread instead; 28 pieces is trivial for the main thread.
 */
let cannon: ReturnType<typeof confetti.create> | null = null

function getCannon(): NonNullable<typeof cannon> {
  if (!cannon) {
    cannon = confetti.create(undefined, { useWorker: false, resize: true })
  }
  return cannon
}

/**
 * Fires a restrained confetti burst over the win overlay when a sort is
 * completed with everything correct. 28 pieces in brand colors, falling from
 * the top of the overlay card area for about 1.8 seconds. Complements the
 * win cascade and victory sound; never fires under prefers-reduced-motion.
 */
export function fireWinConfetti(): void {
  if (prefersReducedMotion()) return
  getCannon()({
    particleCount: 28,
    spread: 70,
    startVelocity: 35,
    ticks: 110,
    gravity: 1,
    origin: { x: 0.5, y: 0.3 },
    colors: WIN_CONFETTI_COLORS,
    disableForReducedMotion: true,
  })
}
