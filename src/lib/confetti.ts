import confetti from 'canvas-confetti'
import { prefersReducedMotion } from './sort-motion'

/** Brand colors for the win confetti: leaf, sun, sky, coral. */
const WIN_CONFETTI_COLORS = ['#367b17', '#ffc42e', '#2fa8de', '#b43c1c']

/**
 * Fires a restrained confetti burst over the win overlay when a sort is
 * completed with everything correct. 28 pieces in brand colors, falling from
 * the top of the overlay card area for about 1.8 seconds. Complements the
 * win cascade and fanfare; never fires under prefers-reduced-motion.
 */
export function fireWinConfetti(): void {
  if (prefersReducedMotion()) return
  confetti({
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
