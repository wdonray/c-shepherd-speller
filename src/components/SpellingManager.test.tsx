import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SpellingManager from './SpellingManager'

const defaultProps = {
  spellingData: { words: ['cat'], sounds: ['sh'], spelling: ['tion'] },
  newWord: '',
  setNewWord: vi.fn(),
  newSound: '',
  setNewSound: vi.fn(),
  newSpelling: '',
  setNewSpelling: vi.fn(),
  addWord: vi.fn(),
  addSound: vi.fn(),
  addSpelling: vi.fn(),
  removeItem: vi.fn(),
  loadingSpellingData: false,
  loadingHandler: { words: false, sounds: false, spelling: false },
}

describe('SpellingManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows a loading message while the spelling data loads', () => {
    render(<SpellingManager {...defaultProps} loadingSpellingData />)
    expect(screen.getByText('Loading your spelling collection...')).toBeInTheDocument()
    expect(screen.queryByText('Words')).not.toBeInTheDocument()
  })

  it('renders the three spelling data cards', () => {
    render(<SpellingManager {...defaultProps} />)
    expect(screen.getByText('Words')).toBeInTheDocument()
    expect(screen.getByText('Sounds')).toBeInTheDocument()
    expect(screen.getByText('Spelling')).toBeInTheDocument()
    expect(screen.getByText('cat')).toBeInTheDocument()
    expect(screen.getByText('sh')).toBeInTheDocument()
    expect(screen.getByText('tion')).toBeInTheDocument()
  })

  it('wires addWord through the words card form', () => {
    const { container } = render(<SpellingManager {...defaultProps} newWord="bat" />)
    const forms = container.querySelectorAll('form')
    fireEvent.submit(forms[0])
    expect(defaultProps.addWord).toHaveBeenCalledTimes(1)
    expect(defaultProps.addSound).not.toHaveBeenCalled()
    expect(defaultProps.addSpelling).not.toHaveBeenCalled()
  })

  it('wires removeItem with the right type and index', () => {
    render(<SpellingManager {...defaultProps} />)
    const cards = screen.getAllByText('Remove')
    fireEvent.click(cards[0])
    expect(defaultProps.removeItem).toHaveBeenCalledWith('words', 0)
    fireEvent.click(cards[1])
    expect(defaultProps.removeItem).toHaveBeenCalledWith('sounds', 0)
    fireEvent.click(cards[2])
    expect(defaultProps.removeItem).toHaveBeenCalledWith('spelling', 0)
  })
})
