import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PatternEditor from './PatternEditor'
import type { SpellingPattern } from '@/models/WordList'

const pattern: SpellingPattern = {
  id: 'p1',
  sound: 'long a',
  pattern: 'a_e',
  frequency: 'common',
  words: ['cake'],
}

function renderEditor(overrides: Partial<SpellingPattern> = {}) {
  const onChange = vi.fn()
  const onRemove = vi.fn()
  render(<PatternEditor pattern={{ ...pattern, ...overrides }} onChange={onChange} onRemove={onRemove} />)
  return { onChange, onRemove }
}

describe('PatternEditor', () => {
  it('renders sound and pattern inputs', () => {
    renderEditor()
    expect(screen.getByLabelText('Sound')).toHaveValue('long a')
    expect(screen.getByLabelText('Pattern')).toHaveValue('a_e')
  })

  it('updates the sound on change', () => {
    const { onChange } = renderEditor()
    fireEvent.change(screen.getByLabelText('Sound'), { target: { value: 'short a' } })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ sound: 'short a' }))
  })

  it('updates the frequency when a button is clicked', () => {
    const { onChange } = renderEditor()
    fireEvent.click(screen.getByRole('button', { name: 'Rare' }))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ frequency: 'rare' }))
  })

  it('toggles the odd duck checkbox', () => {
    const { onChange } = renderEditor()
    fireEvent.click(screen.getByLabelText(/odd duck/i))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ isOddDuck: true }))
  })

  it('adds a word on Enter', () => {
    const { onChange } = renderEditor()
    const input = screen.getByLabelText('New word')
    fireEvent.change(input, { target: { value: 'bake' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ words: ['cake', 'bake'] }))
  })

  it('adds a word via the Add button', () => {
    const { onChange } = renderEditor()
    fireEvent.change(screen.getByLabelText('New word'), { target: { value: 'lake' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ words: ['cake', 'lake'] }))
  })

  it('does not add duplicate or blank words', () => {
    const { onChange } = renderEditor()
    const input = screen.getByLabelText('New word')
    fireEvent.change(input, { target: { value: 'cake' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('removes a word when its X is clicked', () => {
    const { onChange } = renderEditor()
    fireEvent.click(screen.getByRole('button', { name: 'Remove cake' }))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ words: [] }))
  })

  it('calls onRemove when the trash button is clicked', () => {
    const { onRemove } = renderEditor()
    fireEvent.click(screen.getByRole('button', { name: 'Remove pattern' }))
    expect(onRemove).toHaveBeenCalled()
  })
})
