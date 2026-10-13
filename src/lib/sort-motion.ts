/**
 * Shared motion configuration for the Sort activity game feel.
 *
 * One spring everywhere: underdamped with slight overshoot, ~200-260ms
 * perceived duration. All animation on transform/opacity only (60fps on
 * classroom hardware). Every spring degrades to a 150ms crossfade under
 * prefers-reduced-motion.
 */
import type { Transition } from 'motion/react'
import type { TargetAndTransition } from 'motion/react'

/** The one shared spring: stiffness 170, damping 14. */
export const SORT_SPRING: Transition = {
  type: 'spring',
  stiffness: 170,
  damping: 14,
}

/** Pickup lift: scale to 1.15 with elevation shadow, <= 50ms. */
export const LIFT_TRANSITION: Transition = {
  duration: 0.05,
  ease: 'easeOut',
}

/** Reduced-motion fallback: simple 150ms crossfade. */
export const CROSSFADE_TRANSITION: Transition = {
  duration: 0.15,
  ease: 'easeOut',
}

/** Pickup elevation shadow for the dragged tile. */
export const PICKUP_SHADOW = '0 12px 32px rgba(59,51,43,0.28)'

/**
 * Returns true when the user prefers reduced motion. Checked at call time
 * so tests can stub matchMedia.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * The transition to use for settle/pop animations: the shared spring,
 * or the crossfade when reduced motion is preferred.
 */
export function settleTransition(): Transition {
  return prefersReducedMotion() ? CROSSFADE_TRANSITION : SORT_SPRING
}

/**
 * Feedback animation for a placed word tile: a 240ms scale pulse on a
 * correct drop, a 400ms shake on an incorrect drop. Multi-keyframe pulses
 * need tween transitions because motion springs only support two keyframes
 * (they throw otherwise). Skipped entirely under reduced motion and while
 * the word has no correctness state yet.
 */
export function feedbackAnimate(correct: boolean | null): TargetAndTransition {
  if (prefersReducedMotion() || correct === null) return {}
  return correct
    ? { scale: [1, 1.18, 1], transition: { duration: 0.24, ease: 'easeOut' } }
    : { rotate: [-4, 4, -2, 0], transition: { duration: 0.4, ease: 'easeInOut' } }
}
