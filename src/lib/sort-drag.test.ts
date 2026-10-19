import { describe, it, expect } from 'vitest'
import { TOUCH_DRAG_LIFT, touchDragLiftModifier } from './sort-drag'
import type { ClientRect } from '@dnd-kit/core'

describe('touchDragLiftModifier', () => {
  const baseArgs = {
    active: null,
    activeNodeRect: null,
    draggingNodeRect: null,
    containerNodeRect: null,
    over: null,
    overlayNodeRect: null,
    scrollableAncestors: [],
    scrollableAncestorRects: [],
    windowRect: null,
  }
  const transform = { x: 10, y: 100, scaleX: 1, scaleY: 1 }

  it('lifts the overlay above the fingertip for touch drags', () => {
    const result = touchDragLiftModifier({
      ...baseArgs,
      activatorEvent: { pointerType: 'touch' } as unknown as Event,
      transform,
    })
    expect(result.y).toBe(100 - TOUCH_DRAG_LIFT)
    expect(result.x).toBe(10)
  })

  it('leaves mouse drags under the cursor', () => {
    const result = touchDragLiftModifier({
      ...baseArgs,
      activatorEvent: { pointerType: 'mouse' } as unknown as Event,
      transform,
    })
    expect(result).toBe(transform)
  })

  it('leaves the transform alone without an activator event', () => {
    const result = touchDragLiftModifier({ ...baseArgs, activatorEvent: null, transform })
    expect(result).toBe(transform)
  })

  it('keeps the grabbed point under the pointer for touch drags', () => {
    // Grabbed 20px from the left and 10px from the top of a 200x56 tile.
    const rect = { left: 100, top: 200, width: 200, height: 56 } as unknown as ClientRect
    const result = touchDragLiftModifier({
      ...baseArgs,
      activeNodeRect: rect,
      activatorEvent: { pointerType: 'touch', clientX: 120, clientY: 210 } as unknown as Event,
      transform: { x: 50, y: 30, scaleX: 1, scaleY: 1 },
    })
    // Compensation for the 1.15 overlay scale about the tile center:
    // dx = (1 - 1.15) * (20 - 100) = 12, dy = (1 - 1.15) * (10 - 28) = 2.7,
    // then the 64px touch lift.
    expect(result.x).toBeCloseTo(62)
    expect(result.y).toBeCloseTo(30 + 2.7 - TOUCH_DRAG_LIFT)
    expect(result.scaleX).toBe(1)
    expect(result.scaleY).toBe(1)
  })

  it('compensates the overlay scale for mouse drags without lifting', () => {
    // Grabbed near the right edge: the scale would push the tile left.
    const rect = { left: 100, top: 200, width: 200, height: 56 } as unknown as ClientRect
    const result = touchDragLiftModifier({
      ...baseArgs,
      activeNodeRect: rect,
      activatorEvent: { pointerType: 'mouse', clientX: 280, clientY: 220 } as unknown as Event,
      transform: { x: 50, y: 30, scaleX: 1, scaleY: 1 },
    })
    // dx = (1 - 1.15) * (180 - 100) = -12, dy = (1 - 1.15) * (20 - 28) = 1.2.
    expect(result.x).toBeCloseTo(38)
    expect(result.y).toBeCloseTo(31.2)
  })

  it('reads touch coordinates from a TouchEvent', () => {
    const rect = { left: 100, top: 200, width: 200, height: 56 } as unknown as ClientRect
    const result = touchDragLiftModifier({
      ...baseArgs,
      activeNodeRect: rect,
      activatorEvent: {
        pointerType: 'touch',
        touches: [{ clientX: 150, clientY: 205 }],
      } as unknown as Event,
      transform: { x: 50, y: 30, scaleX: 1, scaleY: 1 },
    })
    // Grabbed at (50, 5): dx = (1 - 1.15) * (50 - 100) = 7.5,
    // dy = (1 - 1.15) * (5 - 28) = 3.45, then the touch lift.
    expect(result.x).toBeCloseTo(57.5)
    expect(result.y).toBeCloseTo(30 + 3.45 - TOUCH_DRAG_LIFT)
  })

  it('falls back to changedTouches when touches is empty', () => {
    const rect = { left: 100, top: 200, width: 200, height: 56 } as unknown as ClientRect
    const result = touchDragLiftModifier({
      ...baseArgs,
      activeNodeRect: rect,
      activatorEvent: {
        pointerType: 'touch',
        changedTouches: [{ clientX: 150, clientY: 205 }],
      } as unknown as Event,
      transform: { x: 50, y: 30, scaleX: 1, scaleY: 1 },
    })
    expect(result.x).toBeCloseTo(57.5)
    expect(result.y).toBeCloseTo(30 + 3.45 - TOUCH_DRAG_LIFT)
  })
})
