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
  NameDateHeader,
  ParentNoteSheet,
  PrintPresetContext,
  ReadingSheet,
  SpellingListSheet,
  WordSearchSheet,
  WorksheetSection,
  highlightWord,
  shuffleWords,
  usePrintPreset,
} from './WorksheetSheets'

const groups: PatternWordGroup[] = [
  { pattern: 'a_e', sound: 'long a', patternId: 'p1', words: ['cake', 'bake', 'late', 'date'] },
  { pattern: 'ai', sound: 'long a', patternId: 'p2', words: ['rain', 'train'] },
]

const wordSearch: WordSearchResult = {
  size: 3,
  difficulty: 'upper',
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

describe('NameDateHeader (issue #516)', () => {
  const readingItems = [
    { word: 'rain', sentence: 'The rain fell all afternoon.' },
    { word: 'cake', sentence: 'We baked a cake for the party.' },
  ]

  it('renders Name and Date labels with write-in lines', () => {
    render(<NameDateHeader />)
    const header = screen.getByLabelText('Name and date lines')
    expect(within(header).getByText('Name:')).toBeInTheDocument()
    expect(within(header).getByText('Date:')).toBeInTheDocument()
    // Two presentational write-in lines (aria-hidden, like the parent
    // note's signature line); the wrapper's aria-label covers AT.
    const lines = header.querySelectorAll('span[aria-hidden="true"]')
    expect(lines).toHaveLength(2)
    lines.forEach((line) => expect(line).toHaveClass('border-b-2', 'border-black'))
  })

  it('aligns each write-in line to the label baseline (issue #533)', () => {
    render(<NameDateHeader />)
    const header = screen.getByLabelText('Name and date lines')
    const lines = header.querySelectorAll('span[aria-hidden="true"]')
    expect(lines).toHaveLength(2)
    // The rule must sit at the text baseline where handwriting rests, not
    // vertically centered against the label (which floats it at mid-text
    // height). items-baseline puts the empty line span's bottom border on
    // the label's baseline.
    lines.forEach((line) => {
      expect(line.parentElement).toHaveClass('items-baseline')
      expect(line.parentElement).not.toHaveClass('items-center')
    })
  })

  it('sits under the section title and above the content', () => {
    const { container } = render(
      <WorksheetSection title="Demo">
        <p>body</p>
      </WorksheetSection>
    )
    const section = container.querySelector('section.worksheet-sheet')
    const [h2, header, content] = Array.from(section?.children ?? [])
    expect(h2?.tagName).toBe('H2')
    expect(header?.getAttribute('aria-label')).toBe('Name and date lines')
    expect(content?.textContent).toBe('body')
  })

  it('renders on every sheet type', () => {
    const sheets = [
      <SpellingListSheet key="list" groups={groups} />,
      <CutSortSheet key="cut" groups={groups} answerKey={false} gradeBand="beginner" />,
      <FillBlankSheet key="fill" items={fillBlankItems} answerKey={false} />,
      <WordSearchSheet key="search" result={wordSearch} answerKey={false} />,
      <CrosswordSheet key="cross" result={crossword} answerKey={false} />,
      <ReadingSheet key="reading" items={readingItems} answerKey={false} />,
      <ParentNoteSheet key="note" list={list} groups={groups} />,
    ]
    for (const sheet of sheets) {
      const { unmount } = render(sheet)
      expect(screen.getByLabelText('Name and date lines')).toBeInTheDocument()
      unmount()
    }
  })

  it('renders on answer key sheets too', () => {
    render(<CutSortSheet groups={groups} answerKey={true} gradeBand="beginner" />)
    expect(screen.getByLabelText('Name and date lines')).toBeInTheDocument()
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

describe('CutSortSheet (issue #520)', () => {
  it('student version shows sort columns first, then the cut-out bank below', () => {
    const { container } = render(<CutSortSheet groups={groups} answerKey={false} gradeBand="beginner" />)
    expect(screen.getByRole('heading', { name: 'Cut and sort' })).toBeInTheDocument()
    expect(screen.getByLabelText('Word cards to cut out')).toBeInTheDocument()
    expect(screen.getByText('cake')).toBeInTheDocument()
    // The bank sits below the columns: a line says "write here" to a kid
    // holding scissors and glue, so the norm is columns on top, bank bottom.
    const columnsEl = container.querySelector('[aria-label="Sort the words"]')
    const bankEl = container.querySelector('[aria-label="Word cards to cut out"]')
    expect(columnsEl).not.toBeNull()
    expect(bankEl).not.toBeNull()
    expect(columnsEl!.compareDocumentPosition(bankEl!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // Paste boxes are labelled for assistive tech. The first box is the
    // worked example (issue #523); the rest keep positional numbering.
    expect(screen.getByLabelText('Example: cake is sorted under a_e')).toBeInTheDocument()
    expect(screen.getByLabelText('Paste box 2 under a_e')).toBeInTheDocument()
  })

  it('pre-places the first word of the first column as a marked example (issue #523)', () => {
    render(<CutSortSheet groups={groups} answerKey={false} gradeBand="beginner" />)
    // The example word appears exactly once: in its box, not in the bank.
    expect(screen.getAllByText('cake')).toHaveLength(1)
    const exampleBox = screen.getByLabelText('Example: cake is sorted under a_e')
    expect(exampleBox.tagName).toBe('LI')
    expect(within(exampleBox as HTMLElement).getByText('Example')).toBeInTheDocument()
    // Black and white only: the marker is plain text, never a gray border
    // or tint (photocopy-safe per the existing paste-box test below).
    const exampleMark = exampleBox.querySelector(
      '[class*="border-neutral"], [class*="bg-neutral"], [class*="text-neutral"]'
    )
    expect(exampleMark).toBeNull()
  })

  it('removes the example word from the cut-out bank', () => {
    render(<CutSortSheet groups={groups} answerKey={false} gradeBand="beginner" />)
    const bank = screen.getByLabelText('Word cards to cut out')
    expect(within(bank).queryByText('cake')).not.toBeInTheDocument()
    // Every other word still has a card to cut out.
    for (const word of ['bake', 'late', 'date', 'rain', 'train']) {
      expect(within(bank).getByText(word)).toBeInTheDocument()
    }
  })

  it('renders one fixed-size paste box per word, with black borders only', () => {
    const { container } = render(<CutSortSheet groups={groups} answerKey={false} gradeBand="beginner" />)
    const boxes = container.querySelectorAll('ol li')
    expect(boxes).toHaveLength(6)
    for (const box of boxes) {
      expect(box).toHaveClass('border-2', 'border-black')
      expect(box).not.toHaveClass('border-neutral-400')
    }
    // No gray write-in lines anywhere on the sheet: gray marks fail
    // photocopy tests (report.md section 1).
    const gray = container.querySelectorAll('[class*="border-neutral"]')
    expect(gray).toHaveLength(0)
  })

  it('answer key fills each paste box and hides the cards', () => {
    const { container } = render(<CutSortSheet groups={groups} answerKey gradeBand="beginner" />)
    expect(screen.queryByLabelText('Word cards to cut out')).not.toBeInTheDocument()
    expect(screen.getAllByText('cake')).toHaveLength(1)
    expect(screen.queryByLabelText(/Paste box/)).not.toBeInTheDocument()
    // The key mirrors the student layout: one filled box per word.
    const boxes = container.querySelectorAll('ol li')
    expect(boxes).toHaveLength(6)
    for (const box of boxes) {
      expect(box).toHaveClass('border-2', 'border-black')
    }
  })

  it('answer key keeps words grouped by pattern in column order', () => {
    const { container } = render(<CutSortSheet groups={groups} answerKey gradeBand="beginner" />)
    // a_e words first (cake, bake, late, date), then ai words (rain, train).
    const items = Array.from(container.querySelectorAll('ol li')).map((li) => li.textContent)
    expect(items).toEqual(['cake', 'bake', 'late', 'date', 'rain', 'train'])
  })

  describe('grade-band sizes', () => {
    it.each([
      ['beginner', 'min-h-24', 'min-w-32', 'text-2xl', 'h-24'],
      ['intermediate', 'min-h-20', 'min-w-32', 'text-xl', 'h-20'],
      ['upper', 'min-h-16', 'min-w-28', 'text-lg', 'h-16'],
    ] as const)(
      '%s cards and boxes share the band size, so a cut card fits its box',
      (gradeBand, cardH, cardW, text, boxH) => {
        const { container } = render(<CutSortSheet groups={groups} answerKey={false} gradeBand={gradeBand} />)
        const bank = screen.getByLabelText('Word cards to cut out')
        const cards = within(bank).getAllByText(/.+/)
        expect(cards.length).toBeGreaterThan(0)
        for (const card of cards) {
          expect(card).toHaveClass(cardH, cardW, text)
        }
        // Beginners get the ~1-inch floor for K-1 hands; older bands smaller.
        const boxes = container.querySelectorAll('ol li')
        for (const box of boxes) {
          expect(box).toHaveClass(boxH, text)
        }
      }
    )
  })

  describe('shuffled word bank (issue #452)', () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('renders the word cards in shuffled order, not grouped by pattern', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5)
      render(<CutSortSheet groups={groups} answerKey={false} gradeBand="beginner" />)
      const bank = screen.getByLabelText('Word cards to cut out')
      const cards = within(bank).getAllByText(/.+/)
      // Fisher-Yates with Math.random always 0.5 over
      // [bake, late, date, rain, train] (the example word is not in the bank).
      expect(cards.map((card) => card.textContent)).toEqual(['bake', 'rain', 'late', 'train', 'date'])
    })
  })

  it('answer key has no example marker (issue #523)', () => {
    render(<CutSortSheet groups={groups} answerKey gradeBand="beginner" />)
    expect(screen.queryByText('Example')).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Example:/)).not.toBeInTheDocument()
    // The key still shows every word, including the one that was the example.
    expect(screen.getAllByText('cake')).toHaveLength(1)
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
    // The blank is a fixed-width writing line; it shows no letters, so its
    // size never cues the answer (issue #517).
    const blank = screen.getByLabelText('Blank for cake')
    expect(blank).toHaveClass('worksheet-blank')
    expect(blank).toHaveTextContent('')
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

  it('answer key circles the placed words with bolder letters and names unplaced words', () => {
    const { container } = render(<WordSearchSheet result={{ ...wordSearch, unplaced: ['DOG'] }} answerKey />)
    expect(screen.getByText(/These words did not fit in the grid/)).toHaveTextContent('DOG')
    // CAT sits in row 0, cols 0-2; each letter cell gets a circle and the boldest font.
    const cells = container.querySelectorAll('table tbody tr:first-child td')
    for (const cell of cells) {
      expect(cell).toHaveClass('rounded-full', 'border-2', 'border-black', 'font-black')
    }
    // A filler cell (row 1, col 0) stays plain.
    const filler = container.querySelectorAll('table tbody tr:nth-child(2) td')[0]
    expect(filler).not.toHaveClass('rounded-full', 'border-black', 'font-black')
  })

  it('beginners get straight-only instructions and an alphabetical word bank', () => {
    const result: WordSearchResult = {
      ...wordSearch,
      difficulty: 'beginner',
      placements: [
        { word: 'TRAIN', cells: [{ row: 0, col: 0 }] },
        { word: 'CAKE', cells: [{ row: 1, col: 0 }] },
      ],
    }
    render(<WordSearchSheet result={result} answerKey={false} />)
    expect(screen.getByText('Find each spelling word in the grid. Words run across or down.')).toBeInTheDocument()
    const bank = screen.getByLabelText('Word bank', { selector: 'div' })
    expect(bank.textContent).toBe('CAKETRAIN')
  })

  it('older bands get diagonal instructions', () => {
    render(<WordSearchSheet result={wordSearch} answerKey={false} />)
    expect(
      screen.getByText('Find each spelling word in the grid. Words can run across, down, or diagonally.')
    ).toBeInTheDocument()
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
  const items = [
    { word: 'rain', sentence: 'The rain fell all afternoon.' },
    { word: 'cake', sentence: 'We baked a cake for the party.' },
  ]

  it('blanks out the words and shows an alphabetical word bank on the student sheet', () => {
    render(<ReadingSheet items={items} answerKey={false} />)
    expect(screen.getByRole('heading', { name: 'Reading practice' })).toBeInTheDocument()
    expect(
      screen.getByText('Read each sentence. Fill in each blank with a word from the word bank.')
    ).toBeInTheDocument()
    // Each spelling word becomes a blank; no bold completed word anywhere.
    // Blanks are fixed-width writing lines with no letters, so their size
    // never cues the answer (issue #517).
    const rainBlank = screen.getByLabelText('Blank for rain')
    const cakeBlank = screen.getByLabelText('Blank for cake')
    for (const blank of [rainBlank, cakeBlank]) {
      expect(blank).toHaveClass('worksheet-blank')
      expect(blank).toHaveTextContent('')
    }
    expect(document.querySelectorAll('strong')).toHaveLength(0)
    // The bank is alphabetical even though the items are not.
    expect(screen.getByRole('heading', { name: 'Word bank' })).toBeInTheDocument()
    expect(screen.getByText('cake, rain')).toBeInTheDocument()
  })

  it('renders a sentence unchanged when the word is not in it', () => {
    render(<ReadingSheet items={[{ word: 'sun', sentence: 'The moon is bright.' }]} answerKey={false} />)
    expect(screen.getByText('The moon is bright.')).toBeInTheDocument()
  })

  it('shows the completed sentences with the words bolded on the answer key', () => {
    render(<ReadingSheet items={items} answerKey={true} />)
    expect(screen.getByText('Completed sentences.')).toBeInTheDocument()
    expect(screen.getByText('rain').tagName).toBe('STRONG')
    expect(screen.getByText('cake').tagName).toBe('STRONG')
    expect(screen.getByText('cake, rain')).toBeInTheDocument()
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

  it('describes patterns in plain language, sound first', () => {
    render(<ParentNoteSheet list={list} groups={groups} />)
    const line = screen.getByText(
      (_, element) => element?.textContent === 'The long a sound, spelled a-e: cake, bake, late, and more'
    )
    expect(line.tagName).toBe('LI')
    expect(screen.queryByText('a_e')).not.toBeInTheDocument()
  })

  it('shows the test date when the teacher typed one', () => {
    render(<ParentNoteSheet list={list} groups={groups} testDate="2026-10-30" />)
    expect(screen.getByText(/The spelling test for these words is on/)).toBeInTheDocument()
    expect(screen.getByText('Friday, October 30')).toBeInTheDocument()
  })

  it('omits the test date when none was entered', () => {
    render(<ParentNoteSheet list={list} groups={groups} />)
    expect(screen.queryByText(/spelling test for these words/)).not.toBeInTheDocument()
  })

  it('omits the test date when it is not a real date', () => {
    render(<ParentNoteSheet list={list} groups={groups} testDate="2026-02-30" />)
    expect(screen.queryByText(/spelling test for these words/)).not.toBeInTheDocument()
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

describe('print presets (issue #512)', () => {
  function PresetProbe() {
    return <span data-testid="preset">{usePrintPreset()}</span>
  }

  it('defaults to standard without a provider', () => {
    render(<PresetProbe />)
    expect(screen.getByTestId('preset')).toHaveTextContent('standard')
  })

  it('reads the preset from the provider', () => {
    render(
      <PrintPresetContext.Provider value="large-print">
        <PresetProbe />
      </PrintPresetContext.Provider>
    )
    expect(screen.getByTestId('preset')).toHaveTextContent('large-print')
  })

  it('large print grows the word search grid cells and letters', () => {
    const { container } = render(
      <PrintPresetContext.Provider value="large-print">
        <WordSearchSheet result={wordSearch} answerKey={false} />
      </PrintPresetContext.Provider>
    )
    const cell = container.querySelector('table tbody tr:first-child td')
    expect(cell).toHaveClass('h-11', 'w-11', 'text-2xl')
    expect(cell).not.toHaveClass('h-8', 'w-8', 'text-lg')
  })

  it('large print grows the crossword grid, clue numbers, and sub-headings', () => {
    const { container } = render(
      <PrintPresetContext.Provider value="large-print">
        <CrosswordSheet result={crossword} answerKey={false} />
      </PrintPresetContext.Provider>
    )
    const blocked = container.querySelector('td.crossword-blocked')
    expect(blocked).toHaveClass('h-11', 'w-11')
    const letterCell = container.querySelector('table tbody tr:first-child td:not(.crossword-blocked)')
    expect(letterCell).toHaveClass('h-11', 'w-11', 'text-2xl')
    const clueNumber = letterCell?.querySelector('span')
    expect(clueNumber).toHaveClass('text-xs')
    expect(screen.getByRole('heading', { name: 'Across' })).toHaveClass('text-[17pt]')
  })

  it('large print grows section body text and sub-headings', () => {
    const { container } = render(
      <PrintPresetContext.Provider value="large-print">
        <SpellingListSheet groups={groups} />
      </PrintPresetContext.Provider>
    )
    expect(container.querySelector('section.worksheet-sheet > div:last-of-type')).toHaveClass('text-[14pt]')
    expect(screen.getByRole('heading', { name: /a_e/ })).toHaveClass('text-[17pt]')
  })

  it('dyslexia-friendly keeps standard sizes (its spacing comes from the container CSS)', () => {
    const { container } = render(
      <PrintPresetContext.Provider value="dyslexia-friendly">
        <WordSearchSheet result={wordSearch} answerKey={false} />
      </PrintPresetContext.Provider>
    )
    const cell = container.querySelector('table tbody tr:first-child td')
    expect(cell).toHaveClass('h-8', 'w-8', 'text-[14pt]')
    expect(screen.getByRole('heading', { name: 'Word bank' })).toHaveClass('text-lg')
  })

  it('standard meets the 14pt floor for the upper band (issue #519)', () => {
    const { container } = render(
      <PrintPresetContext.Provider value="standard">
        <WordSearchSheet result={wordSearch} answerKey={false} />
      </PrintPresetContext.Provider>
    )
    const cell = container.querySelector('table tbody tr:first-child td')
    expect(cell).toHaveClass('h-8', 'w-8', 'text-[14pt]')
  })

  it('beginners always get large print, whatever the preset', () => {
    const beginner = { ...wordSearch, difficulty: 'beginner' as const }
    for (const preset of ['standard', 'large-print', 'dyslexia-friendly'] as const) {
      const { container, unmount } = render(
        <PrintPresetContext.Provider value={preset}>
          <WordSearchSheet result={beginner} answerKey={false} />
        </PrintPresetContext.Provider>
      )
      const cell = container.querySelector('table tbody tr:first-child td')
      expect(cell).toHaveClass('h-11', 'w-11', 'text-2xl')
      unmount()
    }
  })

  it('intermediate band lands between beginner and upper sizes', () => {
    const { container } = render(
      <WordSearchSheet result={{ ...wordSearch, difficulty: 'intermediate' }} answerKey={false} />
    )
    const cell = container.querySelector('table tbody tr:first-child td')
    expect(cell).toHaveClass('h-10', 'w-10', 'text-[16pt]')
  })
})
