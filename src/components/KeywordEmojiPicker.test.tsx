import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import KeywordEmojiPicker, { KEYWORD_EMOJI_GROUPS } from './KeywordEmojiPicker'

function renderPicker(props: { patternName?: string; value?: string } = {}) {
  const onSelect = vi.fn()
  render(<KeywordEmojiPicker patternName={props.patternName ?? 'ea'} value={props.value} onSelect={onSelect} />)
  return { onSelect }
}

function openPicker() {
  fireEvent.click(screen.getByRole('button', { name: 'Keyword image for pattern ea' }))
  return screen.getByRole('dialog', { name: 'Choose keyword image' })
}

describe('KeywordEmojiPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('offers 30 curated K-3 keyword emojis', () => {
    const total = KEYWORD_EMOJI_GROUPS.reduce((n, g) => n + g.choices.length, 0)
    expect(total).toBe(30)
  })

  it('renders a dashed Add placeholder when no emoji is set', () => {
    renderPicker()
    const trigger = screen.getByRole('button', { name: 'Keyword image for pattern ea' })
    expect(trigger).toHaveTextContent('Add')
    expect(screen.queryByRole('dialog', { name: 'Choose keyword image' })).not.toBeInTheDocument()
  })

  it('shows the current emoji large when one is set', () => {
    renderPicker({ value: '🐝' })
    const trigger = screen.getByRole('button', { name: 'Keyword image for pattern ea' })
    expect(trigger).toHaveTextContent('🐝')
    expect(trigger.querySelector('.text-4xl')).toBeInTheDocument()
  })

  it('uses a generic label when the pattern has no spelling yet', () => {
    renderPicker({ patternName: '' })
    expect(screen.getByRole('button', { name: 'Keyword image for this pattern' })).toBeInTheDocument()
  })

  it('opens a popover with the curated grid and a custom input', () => {
    renderPicker()
    const popover = openPicker()
    expect(popover).toBeInTheDocument()
    // One button per curated choice, each announced by its keyword name.
    const choiceButtons = popover.querySelectorAll('button[aria-label]')
    expect(choiceButtons.length).toBe(30)
    expect(screen.getByRole('button', { name: 'Bee' })).toBeInTheDocument()
    expect(screen.getByLabelText('Custom keyword emoji')).toBeInTheDocument()
    // Nothing to remove when no emoji is set.
    expect(screen.queryByRole('button', { name: 'Remove keyword image' })).not.toBeInTheDocument()
  })

  it('selects a curated emoji and closes the popover', () => {
    const { onSelect } = renderPicker()
    openPicker()
    fireEvent.click(screen.getByRole('button', { name: 'Bee' }))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith('🐝')
    expect(screen.queryByRole('dialog', { name: 'Choose keyword image' })).not.toBeInTheDocument()
  })

  it('applies a custom emoji typed into the input', () => {
    const { onSelect } = renderPicker()
    openPicker()
    fireEvent.change(screen.getByLabelText('Custom keyword emoji'), { target: { value: '🦄' } })
    fireEvent.click(screen.getByRole('button', { name: 'Use emoji' }))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith('🦄')
    expect(screen.queryByRole('dialog', { name: 'Choose keyword image' })).not.toBeInTheDocument()
  })

  it('applies a custom emoji when Enter is pressed in the input', () => {
    const { onSelect } = renderPicker()
    openPicker()
    const input = screen.getByLabelText('Custom keyword emoji')
    fireEvent.change(input, { target: { value: '🦄' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledWith('🦄')
  })

  it('ignores other keys pressed in the custom input', () => {
    const { onSelect } = renderPicker()
    openPicker()
    const input = screen.getByLabelText('Custom keyword emoji')
    fireEvent.keyDown(input, { key: 'a' })
    expect(onSelect).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Choose keyword image' })).toBeInTheDocument()
  })

  it('does nothing when the custom input is empty', () => {
    const { onSelect } = renderPicker()
    openPicker()
    fireEvent.click(screen.getByRole('button', { name: 'Use emoji' }))
    expect(onSelect).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Choose keyword image' })).toBeInTheDocument()
  })

  it('removes the emoji when Remove is chosen', () => {
    const { onSelect } = renderPicker({ value: '🐝' })
    openPicker()
    fireEvent.click(screen.getByRole('button', { name: 'Remove keyword image' }))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(undefined)
    expect(screen.queryByRole('dialog', { name: 'Choose keyword image' })).not.toBeInTheDocument()
  })

  it('toggles the popover closed when the trigger is clicked again', () => {
    renderPicker()
    openPicker()
    fireEvent.click(screen.getByRole('button', { name: 'Keyword image for pattern ea' }))
    expect(screen.queryByRole('dialog', { name: 'Choose keyword image' })).not.toBeInTheDocument()
  })

  it('closes the popover with Escape', () => {
    renderPicker()
    openPicker()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Choose keyword image' })).not.toBeInTheDocument()
  })

  it('keeps the popover open for other keys', () => {
    renderPicker()
    openPicker()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(screen.getByRole('dialog', { name: 'Choose keyword image' })).toBeInTheDocument()
  })

  it('closes the popover when clicking outside', () => {
    renderPicker()
    openPicker()
    fireEvent.pointerDown(screen.getByTestId('keyword-emoji-scrim'))
    expect(screen.queryByRole('dialog', { name: 'Choose keyword image' })).not.toBeInTheDocument()
  })
})
