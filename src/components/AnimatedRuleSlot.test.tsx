import { describe, it, expect } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import AnimatedRuleSlot, { RULE_SLOT_TRANSITION_MS } from './AnimatedRuleSlot'

describe('AnimatedRuleSlot', () => {
  it('renders children expanded when show is true on mount', () => {
    render(
      <AnimatedRuleSlot show={true}>
        <p>rule content</p>
      </AnimatedRuleSlot>
    )
    expect(screen.getByText('rule content')).toBeInTheDocument()
    expect(screen.getByTestId('animated-rule-slot')).toHaveClass('opacity-100')
  })

  it('renders nothing when show is false on mount', () => {
    render(
      <AnimatedRuleSlot show={false}>
        <p>rule content</p>
      </AnimatedRuleSlot>
    )
    expect(screen.queryByText('rule content')).not.toBeInTheDocument()
    expect(screen.queryByTestId('animated-rule-slot')).not.toBeInTheDocument()
  })

  it('collapses then removes the slot after hiding', async () => {
    const { rerender } = render(
      <AnimatedRuleSlot show={true}>
        <p>rule content</p>
      </AnimatedRuleSlot>
    )
    rerender(
      <AnimatedRuleSlot show={false}>
        <p>rule content</p>
      </AnimatedRuleSlot>
    )
    // Still mounted mid-transition, in the collapsed state.
    expect(screen.getByTestId('animated-rule-slot')).toHaveClass('opacity-0')
    expect(screen.getByText('rule content')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('rule content')).not.toBeInTheDocument())
  })

  it('expands the slot when shown again', async () => {
    const { rerender } = render(
      <AnimatedRuleSlot show={false}>
        <p>rule content</p>
      </AnimatedRuleSlot>
    )
    rerender(
      <AnimatedRuleSlot show={true}>
        <p>rule content</p>
      </AnimatedRuleSlot>
    )
    // Mounted synchronously; the delayed expand tick lands shortly after.
    expect(screen.getByText('rule content')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('animated-rule-slot')).toHaveClass('opacity-100'))
  })

  it('cancels a pending unmount when reshown mid-transition', async () => {
    const { rerender } = render(
      <AnimatedRuleSlot show={true}>
        <p>rule content</p>
      </AnimatedRuleSlot>
    )
    rerender(
      <AnimatedRuleSlot show={false}>
        <p>rule content</p>
      </AnimatedRuleSlot>
    )
    rerender(
      <AnimatedRuleSlot show={true}>
        <p>rule content</p>
      </AnimatedRuleSlot>
    )
    // Advance past the unmount timeout: the slot must still be here.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, RULE_SLOT_TRANSITION_MS + 100))
    })
    expect(screen.getByText('rule content')).toBeInTheDocument()
    expect(screen.getByTestId('animated-rule-slot')).toHaveClass('opacity-100')
  })
})
