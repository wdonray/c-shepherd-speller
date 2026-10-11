import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useUnsavedChangesGuard, type LeaveTarget } from './use-unsaved-changes-guard'

function renderGuard(isDirty: boolean) {
  const onRequestLeave = vi.fn()
  const utils = renderHook(({ dirty }: { dirty: boolean }) => useUnsavedChangesGuard(dirty, onRequestLeave), {
    initialProps: { dirty: isDirty },
  })
  return { ...utils, onRequestLeave }
}

function clickAnchor(href: string, init: MouseEventInit = {}) {
  const anchor = document.createElement('a')
  anchor.setAttribute('href', href)
  anchor.textContent = 'link'
  document.body.appendChild(anchor)
  const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init })
  const preventDefault = vi.spyOn(event, 'preventDefault')
  anchor.dispatchEvent(event)
  anchor.remove()
  return { event, preventDefault }
}

function dispatchPopState() {
  act(() => {
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
}

describe('useUnsavedChangesGuard', () => {
  let pushStateSpy: ReturnType<typeof vi.spyOn>
  let backSpy: ReturnType<typeof vi.spyOn>
  let goSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    pushStateSpy = vi.spyOn(window.history, 'pushState')
    backSpy = vi.spyOn(window.history, 'back')
    goSpy = vi.spyOn(window.history, 'go')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('beforeunload', () => {
    it('prompts on beforeunload when dirty', () => {
      renderGuard(true)
      const event = new Event('beforeunload', { cancelable: true })
      const preventDefault = vi.spyOn(event, 'preventDefault')
      window.dispatchEvent(event)
      expect(preventDefault).toHaveBeenCalled()
      // Note: jsdom's legacy returnValue getter reflects canceled state, so it
      // reads false here even though the handler assigns '' for real browsers.
    })

    it('does not prompt on beforeunload when clean', () => {
      renderGuard(false)
      const event = new Event('beforeunload', { cancelable: true })
      const preventDefault = vi.spyOn(event, 'preventDefault')
      window.dispatchEvent(event)
      expect(preventDefault).not.toHaveBeenCalled()
    })

    it('stops prompting once saved', () => {
      const { rerender } = renderGuard(true)
      rerender({ dirty: false })
      const event = new Event('beforeunload', { cancelable: true })
      const preventDefault = vi.spyOn(event, 'preventDefault')
      window.dispatchEvent(event)
      expect(preventDefault).not.toHaveBeenCalled()
    })
  })

  describe('link click interception', () => {
    it('intercepts a same-origin link click when dirty', () => {
      const { onRequestLeave } = renderGuard(true)
      const { preventDefault } = clickAnchor('/lists')
      expect(preventDefault).toHaveBeenCalled()
      expect(onRequestLeave).toHaveBeenCalledTimes(1)
      const target = onRequestLeave.mock.calls[0][0] as LeaveTarget
      expect(target).toEqual({ kind: 'url', url: '/lists' })
    })

    it('lets the click through when clean', () => {
      const { onRequestLeave } = renderGuard(false)
      const { preventDefault } = clickAnchor('/lists')
      expect(preventDefault).not.toHaveBeenCalled()
      expect(onRequestLeave).not.toHaveBeenCalled()
    })

    it('ignores modified clicks', () => {
      const { onRequestLeave } = renderGuard(true)
      for (const init of [{ metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { altKey: true }]) {
        const { preventDefault } = clickAnchor('/lists', init)
        expect(preventDefault).not.toHaveBeenCalled()
      }
      expect(onRequestLeave).not.toHaveBeenCalled()
    })

    it('ignores non-left clicks', () => {
      const { onRequestLeave } = renderGuard(true)
      const { preventDefault } = clickAnchor('/lists', { button: 2 })
      expect(preventDefault).not.toHaveBeenCalled()
      expect(onRequestLeave).not.toHaveBeenCalled()
    })

    it('ignores clicks that are already handled', () => {
      const { onRequestLeave } = renderGuard(true)
      const anchor = document.createElement('a')
      anchor.setAttribute('href', '/lists')
      document.body.appendChild(anchor)
      const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
      const preventDefault = vi.spyOn(event, 'preventDefault')
      event.preventDefault()
      anchor.dispatchEvent(event)
      anchor.remove()
      // The guard must not ask twice for an event something else consumed.
      expect(preventDefault).toHaveBeenCalledTimes(1)
      expect(onRequestLeave).not.toHaveBeenCalled()
    })

    it('ignores clicks outside anchors', () => {
      const { onRequestLeave } = renderGuard(true)
      const button = document.createElement('button')
      button.textContent = 'button'
      document.body.appendChild(button)
      const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
      const preventDefault = vi.spyOn(event, 'preventDefault')
      button.dispatchEvent(event)
      button.remove()
      expect(preventDefault).not.toHaveBeenCalled()
      expect(onRequestLeave).not.toHaveBeenCalled()
    })

    it('ignores _blank and download links', () => {
      const { onRequestLeave } = renderGuard(true)
      for (const attrs of [[['target', '_blank']], [['download', '']]] as [string, string][][]) {
        const anchor = document.createElement('a')
        anchor.setAttribute('href', '/lists')
        for (const [k, v] of attrs) anchor.setAttribute(k, v)
        document.body.appendChild(anchor)
        const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
        const preventDefault = vi.spyOn(event, 'preventDefault')
        anchor.dispatchEvent(event)
        anchor.remove()
        expect(preventDefault).not.toHaveBeenCalled()
      }
      expect(onRequestLeave).not.toHaveBeenCalled()
    })

    it('ignores hash-only links', () => {
      const { onRequestLeave } = renderGuard(true)
      const { preventDefault } = clickAnchor('#section')
      expect(preventDefault).not.toHaveBeenCalled()
      expect(onRequestLeave).not.toHaveBeenCalled()
    })

    it('ignores same-page links', () => {
      const { onRequestLeave } = renderGuard(true)
      const { preventDefault } = clickAnchor(window.location.pathname)
      expect(preventDefault).not.toHaveBeenCalled()
      expect(onRequestLeave).not.toHaveBeenCalled()
    })

    it('ignores cross-origin links', () => {
      const { onRequestLeave } = renderGuard(true)
      const { preventDefault } = clickAnchor('https://example.com/other')
      expect(preventDefault).not.toHaveBeenCalled()
      expect(onRequestLeave).not.toHaveBeenCalled()
    })

    it('ignores non-http links', () => {
      const { onRequestLeave } = renderGuard(true)
      const { preventDefault } = clickAnchor('mailto:teacher@school.org')
      expect(preventDefault).not.toHaveBeenCalled()
      expect(onRequestLeave).not.toHaveBeenCalled()
    })

    it('ignores unparseable hrefs', () => {
      const { onRequestLeave } = renderGuard(true)
      const { preventDefault } = clickAnchor('http://[invalid')
      expect(preventDefault).not.toHaveBeenCalled()
      expect(onRequestLeave).not.toHaveBeenCalled()
    })
  })

  describe('back-button sentinel', () => {
    it('pushes a sentinel entry while dirty', () => {
      renderGuard(true)
      expect(pushStateSpy).toHaveBeenCalled()
    })

    it('does not push a sentinel while clean', () => {
      renderGuard(false)
      expect(pushStateSpy).not.toHaveBeenCalled()
    })

    it('asks instead of leaving on back button', () => {
      const { onRequestLeave } = renderGuard(true)
      const pushes = pushStateSpy.mock.calls.length
      dispatchPopState()
      // Re-armed on top, then asked.
      expect(pushStateSpy.mock.calls.length).toBe(pushes + 1)
      expect(onRequestLeave).toHaveBeenCalledTimes(1)
      expect(onRequestLeave.mock.calls[0][0]).toEqual({ kind: 'back' })
    })

    it('removes the sentinel when the page becomes clean', () => {
      const { rerender } = renderGuard(true)
      expect(pushStateSpy).toHaveBeenCalled()
      rerender({ dirty: false })
      expect(backSpy).toHaveBeenCalled()
    })

    it('ignores popstate after the sentinel is removed', () => {
      const { onRequestLeave, rerender } = renderGuard(true)
      rerender({ dirty: false })
      onRequestLeave.mockClear()
      dispatchPopState()
      expect(onRequestLeave).not.toHaveBeenCalled()
    })
  })

  describe('depart', () => {
    it('removes the sentinel quietly, then navigates', () => {
      const { result } = renderGuard(true)
      const navigate = vi.fn()
      act(() => {
        result.current.depart(navigate)
      })
      expect(backSpy).toHaveBeenCalled()
      expect(navigate).toHaveBeenCalledTimes(1)
    })

    it('navigates without touching history when no sentinel is armed', () => {
      const { result } = renderGuard(false)
      const navigate = vi.fn()
      act(() => {
        result.current.depart(navigate)
      })
      expect(backSpy).not.toHaveBeenCalled()
      expect(navigate).toHaveBeenCalledTimes(1)
    })

    it('does not re-ask after departing', () => {
      const { result, onRequestLeave } = renderGuard(true)
      act(() => {
        result.current.depart(() => {
          window.history.go(-2)
        })
      })
      expect(goSpy).toHaveBeenCalledWith(-2)
      onRequestLeave.mockClear()
      dispatchPopState()
      expect(onRequestLeave).not.toHaveBeenCalled()
    })
  })
})
