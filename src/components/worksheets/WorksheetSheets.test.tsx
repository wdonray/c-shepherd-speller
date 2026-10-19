import { afterEach, describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import type { WordList } from '@/models/WordList'
import type { PatternWordGroup } from '@/lib/worksheets'
import type { WordSearchResult } from '@/lib/word-search'
import type { CrosswordResult } from '@/lib/crossword'
import {
  AnswerKeyHeading,
  CrosswordSheet,
  CutSortSheet,
  FillBlankSheet,
  ParentNoteSheet,
  ReadingSheet,
  SpellingListSheet,
  WordSearchSheet,
  WorksheetSection,
  highlightWord,
  shuffleWords,
} from './WorksheetSheets'

const groups: PatternWordGroup[] = [
  { pattern: 'a_e', sound: 'long a', patternId: 'p1', words: ['cake', 'bake', 'late', 'date'] },
  { pattern: 'ai', sound: 'long a', patternId: 'p2', words: ['rain', 'train'] },
]

const wordSearch: WordSearchResult = {
  size: 3,
  grid: [
    ['C', 'A', 'T'],
    ['X', 'Q', 'Z'],
    ['X', 'X', 'X'],
  ],
  placements: [
    {
      word: 'CAT',
      cells: [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 0, col: 2 },
      ],
    },
  ],
  unplaced: [],
}

const crossword: CrosswordResult = {
  rows: 3,
  cols: 4,
  grid: [
    ['c', 'a', 't', null],
    [null, 'r', null, null],
    [null, 't', null, null],
  ],
  placements: [
    {
      word: 'cat',
      clue: 'A furry pet.',
      number: 1,
      direction: 'across',
      cells: [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 0, col: 2 },
      ],
    },
    {
      word: 'art',
      clue: 'You make it in class.',
      number: 2,
      direction: 'down',
      cells: [
        { row: 0, col: 1 },
        { row: 1, col: 1 },
        { row: 2, col: 1 },
      ],
    },
  ],
  unplaced: ['dog'],
}

const list: WordList = {
  id: 'l1',
  userId: 'u1',
  name: 'Week 5: Long A',
  week: '5',
  patterns: [],
  createdAt: '2026-10-06T00:00:00.000Z',
  updatedAt: '2026-10-06T00:00:00.000Z',
}

describe('highlightWord', () => {
  it('bolds the first case-insensitive occurrence', () => {
    render(<p>{highlightWord('We baked a Cake today.', 'cake')}</p>)
    expect(screen.getByText('Cake').tagName).toBe('STRONG')
  })

  it('returns the sentence unchanged when the word is absent', () => {
    render(<p>{highlightWord('The rain fell.', 'cake')}</p>)
    expect(screen.getByText('The rain fell.')).toBeInTheDocument()
  })

  it('returns the sentence unchanged for an empty word', () => {
    render(<p>{highlightWord('The rain fell.', '')}</p>)
    expect(screen.getByText('The rain fell.')).toBeInTheDocument()
  })
})

describe('WorksheetSection', () => {
  it('renders its title and children', () => {
    render(
      <WorksheetSection title="Demo">
        <p>body</p>
      </WorksheetSection>
    )
    expect(screen.getByRole('heading', { name: 'Demo' })).toBeInTheDocument()
    expect(screen.getByText('body')).toBeInTheDocument()
  })
})

describe('AnswerKeyHeading', () => {
  it('renders the answer key heading', () => {
    render(<AnswerKeyHeading />)
    expect(screen.getByRole('heading', { name: 'Answer key' })).toBeInTheDocument()
  })
})

describe('SpellingListSheet', () => {
  it('groups words under their patterns', () => {
    render(<SpellingListSheet groups={groups} />)
    expect(screen.getByRole('heading', { name: 'Spelling list' })).toBeInTheDocument()
    expect(screen.getByText('cake')).toBeInTheDocument()
    expect(screen.getByText('train')).toBeInTheDocument()
  })
})

describe('CutSortSheet', () => {
  it('student version shows cut-out cards and empty sort columns', () => {
    render(<CutSortSheet groups={groups} answerKey={false} />)
    expect(screen.getByRole('heading', { name: 'Cut and sort' })).toBeInTheDocument()
    expect(screen.getByLabelText('Word cards to cut out')).toBeInTheDocument()
    expect(screen.getByText('cake')).toBeInTheDocument()
    // Blank sort lines are labelled for assistive tech.
    expect(screen.getByLabelText('Blank line 1 under a_e')).toBeInTheDocument()
  })

  it('answer key fills the sort columns and hides the cards', () => {
    render(<CutSortSheet groups={groups} answerKey />)
    expect(screen.queryByLabelText('Word cards to cut out')).not.toBeInTheDocument()
    expect(screen.getAllByText('cake')).toHaveLength(1)
    expect(screen.queryByLabelText(/Blank line/)).not.toBeInTheDocument()
  })

  it('answer key keeps words grouped by pattern in column order', () => {
    const { container } = render(<CutSortSheet groups={groups} answerKey />)
    // a_e words first (cake, bake, late, date), then ai words (rain, train).
    const items = Array.from(container.querySelectorAll('ol li')).map((li) => li.textContent)
    expect(items).toEqual(['cake', 'bake', 'late', 'date', 'rain', 'train'])
  })

  describe('word card size (issue #452)', () => {
    it('renders larger cut-out cards for small hands', () => {
      render(<CutSortSheet groups={groups} answerKey={false} />)
      const bank = screen.getByLabelText('Word cards to cut out')
      const cards = within(bank).getAllByText(/.+/)
      expect(cards.length).toBeGreaterThan(0)
      for (const card of cards) {
        expect(card).toHaveClass('min-h-20', 'min-w-36', 'text-2xl')
      }
    })
  })

  describe('shuffled word bank (issue #452)', () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('renders the word cards in shuffled order, not grouped by pattern', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5)
      render(<CutSortSheet groups={groups} answerKey={false} />)
      const bank = screen.getByLabelText('Word cards to cut out')
      const cards = within(bank).getAllByText(/.+/)
      // Fisher-Yates with Math.random always 0.5 over
      // [cake, bake, late, date, rain, train].
      expect(cards.map((card) => card.textContent)).toEqual(['cake', 'train', 'bake', 'rain', 'late', 'date'])
    })
  })
})

describe('shuffleWords', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns a deterministic order with a mocked random source', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    // Fisher-Yates with Math.random always 0.5 over [a, b, c, d].
    expect(shuffleWords(['a', 'b', 'c', 'd'])).toEqual(['a', 'd', 'b', 'c'])
  })

  it('returns a permutation containing exactly the input words', () => {
    const words = ['cake', 'bake', 'late', 'date', 'rain', 'train']
    const shuffled = shuffleWords(words)
    expect([...shuffled].sort()).toEqual([...words].sort())
    expect(shuffled).not.toBe(words)
  })

  it('does not mutate the input array', () => {
    const words = ['cake', 'bake', 'late']
    shuffleWords(words)
    expect(words).toEqual(['cake', 'bake', 'late'])
  })

  it('returns empty and single-element inputs unchanged in value', () => {
    expect(shuffleWords([])).toEqual([])
    expect(shuffleWords(['cake'])).toEqual(['cake'])
  })
})

const fillBlankItems = [
  {
    word: 'cake',
    sentence: 'We baked a cake for the party.',
    blankedWord: 'c_k_',
    blankedSentence: 'We baked a c_k_ for the party.',
  },
]

describe('FillBlankSheet', () => {
  it('student version shows the sentence with the pattern blanked', () => {
    render(<FillBlankSheet items={fillBlankItems} answerKey={false} />)
    expect(screen.getByRole('heading', { name: 'Fill in the blank' })).toBeInTheDocument()
    expect(screen.getByLabelText('Blank for cake')).toHaveTextContent('c_k_')
    expect(screen.queryByText('cake')).not.toBeInTheDocument()
  })

  it('student version renders the sentence plainly when the blank is missing', () => {
    render(
      <FillBlankSheet
        items={[
          { word: 'cake', sentence: 'We baked a cake.', blankedWord: 'zzz', blankedSentence: 'We baked a cake.' },
        ]}
        answerKey={false}
      />
    )
    expect(screen.getByText('We baked a cake.')).toBeInTheDocument()
  })

  it('answer key shows the completed sentence', () => {
    render(<FillBlankSheet items={fillBlankItems} answerKey />)
    expect(screen.getByText('Completed sentences.')).toBeInTheDocument()
    expect(screen.getByText('cake').tagName).toBe('STRONG')
  })
})

describe('WordSearchSheet', () => {
  it('student version shows the grid and the word bank', () => {
    render(<WordSearchSheet result={wordSearch} answerKey={false} />)
    expect(screen.getByRole('heading', { name: 'Word search' })).toBeInTheDocument()
    expect(screen.getByLabelText('Word search grid')).toBeInTheDocument()
    expect(screen.getByText('CAT')).toBeInTheDocument()
  })

  it('answer key underlines the placed words and names unplaced words', () => {
    render(<WordSearchSheet result={{ ...wordSearch, unplaced: ['DOG'] }} answerKey />)
    expect(screen.getByText(/These words did not fit in the grid/)).toHaveTextContent('DOG')
  })
})

describe('CrosswordSheet', () => {
  it('student version shows an empty numbered grid with across and down clues', () => {
    render(<CrosswordSheet result={crossword} answerKey={false} />)
    expect(screen.getByRole('heading', { name: 'Crossword' })).toBeInTheDocument()
    expect(screen.getByText('1.')).toBeInTheDocument()
    expect(screen.getByText('A furry pet.')).toBeInTheDocument()
    expect(screen.getByText('You make it in class.')).toBeInTheDocument()
    expect(screen.getByText(/These words did not fit in the puzzle/)).toHaveTextContent('dog')
    // Letters stay hidden on the student grid.
    expect(screen.queryByText('c', { exact: true })).not.toBeInTheDocument()
  })

  it('answer key fills in the letters', () => {
    const { container } = render(<CrosswordSheet result={{ ...crossword, unplaced: [] }} answerKey />)
    expect(container.textContent).toContain('c')
    expect(screen.queryByText(/did not fit/)).not.toBeInTheDocument()
  })

  it('lists the placed words in alphabetical order in the word bank', () => {
    render(<CrosswordSheet result={crossword} answerKey={false} />)
    expect(screen.getByRole('heading', { name: 'Word bank' })).toBeInTheDocument()
    expect(screen.getByText('art, cat')).toBeInTheDocument()
  })

  it('shows the word bank on the answer key too', () => {
    render(<CrosswordSheet result={{ ...crossword, unplaced: [] }} answerKey />)
    expect(screen.getByText('art, cat')).toBeInTheDocument()
  })

  it('renders a puzzle with no down clues', () => {
    render(
      <CrosswordSheet
        result={{
          rows: 1,
          cols: 3,
          grid: [['c', 'a', 't']],
          placements: [
            {
              word: 'cat',
              clue: 'A furry pet.',
              number: 1,
              direction: 'across',
              cells: [
                { row: 0, col: 0 },
                { row: 0, col: 1 },
                { row: 0, col: 2 },
              ],
            },
          ],
          unplaced: [],
        }}
        answerKey={false}
      />
    )
    expect(screen.getByText('A furry pet.')).toBeInTheDocument()
  })
})

describe('ReadingSheet', () => {
  it('lists one sentence per word with the word bolded', () => {
    render(
      <ReadingSheet
        items={[
          { word: 'cake', sentence: 'We baked a cake for the party.' },
          { word: 'rain', sentence: 'The rain fell all afternoon.' },
        ]}
      />
    )
    expect(screen.getByRole('heading', { name: 'Reading practice' })).toBeInTheDocument()
    expect(screen.getByText('cake').tagName).toBe('STRONG')
  })
})

describe('ParentNoteSheet', () => {
  it('explains the patterns and practice ideas, with the week when set', () => {
    render(<ParentNoteSheet list={list} groups={groups} />)
    expect(screen.getByRole('heading', { name: 'A note for families' })).toBeInTheDocument()
    expect(screen.getByText(/week 5/)).toBeInTheDocument()
    expect(screen.getByText(/Hunt for the spelling patterns/)).toBeInTheDocument()
    expect(screen.getByText('Teacher signature')).toBeInTheDocument()
  })

  it('omits the week and the "and more" suffix when they do not apply', () => {
    render(
      <ParentNoteSheet
        list={{ ...list, week: undefined }}
        groups={[{ pattern: 'ai', sound: 'long a', patternId: 'p2', words: ['rain', 'train'] }]}
      />
    )
    expect(screen.queryByText(/week 5/)).not.toBeInTheDocument()
    expect(screen.getByText(/rain, train$/)).toBeInTheDocument()
  })
})
