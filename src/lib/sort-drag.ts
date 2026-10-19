import type { Modifier } from '@dnd-kit/core'

/**
 * Drag-overlay helpers shared by the sort game (SortActivity) and the lists
 * page drag-to-reorder (PatternListsManager). Kept in a dependency-free lib
 * module (issue #482): importing these from SortActivity pulled motion,
 * @dnd-kit and canvas-confetti into the /lists initial bundle for a single
 * function.
 */

/**
 * Scale applied to the floating drag tile (see DraggingWordCard). The tile
 * scales about its own center, which would move the grabbed point away from
 * the pointer (up to ~25px on full-width mobile tiles); the drag modifier
 * below compensates so the grab point stays pinned to the pointer.
 */
export const DRAG_TILE_SCALE = 1.15

/** Pointer coordinates from a pointer or touch activator event, if any. */
function activatorPoint(event: Event | null): { x: number; y: number } | null {
  if (!event) return null
  if ('clientX' in event) {
    const pointer = event as PointerEvent
    return { x: pointer.clientX, y: pointer.clientY }
  }
  const touchEvent = event as TouchEvent
  const touch = touchEvent.touches?.[0] ?? touchEvent.changedTouches?.[0]
  return touch ? { x: touch.clientX, y: touch.clientY } : null
}

/**
 * Touch drag lift: on touch pointers the floating tile renders 64px above
 * the fingertip so the finger never covers the word (Block Blast pattern).
 * Mouse drags keep the tile under the cursor.
 *
 * Also compensates for the overlay tile's lift scale: because the floating
 * tile scales up about its center, the grabbed point would otherwise drift
 * away from the pointer. Shifting the overlay by (1 - scale) times the grab
 * offset from center keeps the grabbed point exactly under the pointer.
 * Pure transform shifts, so neither affects layout.
 */
export const TOUCH_DRAG_LIFT = 64

export const touchDragLiftModifier: Modifier = ({ activatorEvent, activeNodeRect, transform }) => {
  let { x, y } = transform
  const point = activatorPoint(activatorEvent)
  if (point && activeNodeRect) {
    const grabX = point.x - activeNodeRect.left
    const grabY = point.y - activeNodeRect.top
    x += (1 - DRAG_TILE_SCALE) * (grabX - activeNodeRect.width / 2)
    y += (1 - DRAG_TILE_SCALE) * (grabY - activeNodeRect.height / 2)
  }
  const pointerType = (activatorEvent as PointerEvent | null)?.pointerType
  if (pointerType === 'touch') {
    y -= TOUCH_DRAG_LIFT
  }
  if (x === transform.x && y === transform.y) return transform
  return { ...transform, x, y }
}
