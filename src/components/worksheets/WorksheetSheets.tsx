import type { ReactNode } from 'react'
import { createContext, useContext } from 'react'
import type { WordList } from '@/models/WordList'
import type { PatternWordGroup } from '@/lib/worksheets'
import type { WordSearchResult } from '@/lib/word-search'
import type { CrosswordResult } from '@/lib/crossword'
import type { PrintPreset } from '@/lib/print-options'

/**
 * The active pre-print style preset for the worksheet sheets (issue #512).
 * Set by the print page's options panel; defaults to 'standard' so sheets
 * render standalone (tests, future reuse) without a provider.
 */
export const PrintPresetContext = createContext<PrintPreset>('standard')

export function usePrintPreset(): PrintPreset {
  return useContext(PrintPresetContext)
}

/**
 * Preset-driven type sizes. Large print follows the worksheet research: body
 * to the 14pt floor for younger readers, sub-headings staying 20%+ above the
 * body (BDA), puzzle letters to 18pt with cells clearing the 9mm spec.
 * Dyslexia-friendly keeps standard sizes; its spacing comes from the
 * `.print-sheets[data-preset]` container rule in globals.css, which inherits.
 */
const BODY_TEXT: Record<PrintPreset, string> = {
  standard: '',
  'large-print': 'text-[14pt]',
  'dyslexia-friendly': '',
}

const SUBHEADING: Record<PrintPreset, string> = {
  standard: 'text-lg',
  'large-print': 'text-[17pt]',
  'dyslexia-friendly': 'text-lg',
}

const GRID_CELL: Record<PrintPreset, string> = {
  standard: 'h-8 w-8',
  'large-print': 'h-11 w-11',
  'dyslexia-friendly': 'h-8 w-8',
}

const GRID_LETTER: Record<PrintPreset, string> = {
  standard: 'text-lg',
  'large-print': 'text-2xl',
  'dyslexia-friendly': 'text-lg',
}

const CLUE_NUMBER: Record<PrintPreset, string> = {
  standard: 'text-[10px]',
  'large-print': 'text-xs',
  'dyslexia-friendly': 'text-[10px]',
}

/**
 * Presentational worksheet sheets for the print job (issue #402).
 *
 * Every component renders pure print markup from precomputed data: the
 * print page computes each puzzle once (one seeded RNG per job) and passes
 * the same data to the student sheet and its answer key, so the key always
 * matches the puzzle. Black-and-white printer friendly: structure comes
 * from borders and type, not background colors.
 */

/** Split a sentence around the first case-insensitive occurrence of a word. */
function splitOnFirst(haystack: string, needle: string): [string, string, string] | null {
  if (needle.length === 0) return null
  const index = haystack.toLowerCase().indexOf(needle.toLowerCase())
  if (index === -1) return null
  return [haystack.slice(0, index), haystack.slice(index, index + needle.length), haystack.slice(index + needle.length)]
}

/** Render a sentence with its spelling word in bold. */
export function highlightWord(sentence: string, word: string): ReactNode {
  const parts = splitOnFirst(sentence, word)
  if (!parts) return sentence
  const [before, match, after] = parts
  return (
    <>
      {before}
      <strong>{match}</strong>
      {after}
    </>
  )
}

/**
 * Fisher-Yates shuffle (issue #452). Returns a new array; the input is not
 * mutated. Used for the cut-and-sort word bank so same-pattern words do not
 * sit next to each other and give away the sort.
 */
export function shuffleWords(words: string[]): string[] {
  const copy = [...words]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = copy[i]
    copy[i] = copy[j]
    copy[j] = temp
  }
  return copy
}

/** One worksheet section of the print job. Never splits across pages. */
export function WorksheetSection({ title, children }: { title: string; children: ReactNode }) {
  const preset = usePrintPreset()
  return (
    <section className="worksheet-sheet" aria-label={title}>
      <h2 className="mt-8 text-2xl font-bold text-black first:mt-0">{title}</h2>
      <div className={`mt-4 ${BODY_TEXT[preset]}`}>{children}</div>
    </section>
  )
}

/** The answer key divider: always starts on a fresh printed page. */
export function AnswerKeyHeading() {
  return (
    <div className="answer-key-break" aria-label="Answer key">
      <h2 className="mt-8 text-2xl font-bold text-black">Answer key</h2>
    </div>
  )
}

/** 1. The week's words, grouped by spelling pattern. The key is the list itself. */
export function SpellingListSheet({ groups }: { groups: PatternWordGroup[] }) {
  const preset = usePrintPreset()
  return (
    <WorksheetSection title="Spelling list">
      <div className="grid grid-cols-2 gap-6 md:grid-cols-3">
        {groups.map((group) => (
          <div key={group.patternId}>
            <h3 className={`${SUBHEADING[preset]} font-bold text-black`}>
              {group.pattern} <span className="font-normal text-neutral-600">({group.sound})</span>
            </h3>
            <ol className="mt-2 list-decimal space-y-1 pl-6 text-black">
              {group.words.map((word) => (
                <li key={word}>{word}</li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </WorksheetSection>
  )
}

/**
 * 2. Cut-and-paste sorting. Student: dashed word cards to cut out, then
 * empty columns to sort them under. Key: the columns filled in.
 */
export function CutSortSheet({ groups, answerKey }: { groups: PatternWordGroup[]; answerKey: boolean }) {
  const preset = usePrintPreset()
  // The student cut-out bank is shuffled so same-pattern words do not sit
  // next to each other. The answer-key columns stay grouped by pattern.
  const words = shuffleWords(groups.flatMap((group) => group.words))
  return (
    <WorksheetSection title="Cut and sort">
      {!answerKey && (
        <>
          <p className="text-black">Cut out the word cards. Sort each word under its spelling pattern, then glue.</p>
          <div className="mt-4 flex flex-wrap gap-3" aria-label="Word cards to cut out">
            {words.map((word) => (
              <div
                key={word}
                className="flex min-h-20 min-w-36 items-center justify-center rounded-lg border-2 border-dashed border-black px-6 py-4 text-2xl font-bold text-black"
              >
                {word}
              </div>
            ))}
          </div>
          <h3 className={`mt-8 ${SUBHEADING[preset]} font-bold text-black`}>Sort the words</h3>
        </>
      )}
      <div className={`grid grid-cols-2 gap-6 md:grid-cols-3 ${answerKey ? '' : 'mt-4'}`}>
        {groups.map((group) => (
          <div key={group.patternId} className="rounded-lg border-2 border-black p-3">
            <h3 className={`${SUBHEADING[preset]} font-bold text-black`}>
              {group.pattern} <span className="font-normal text-neutral-600">({group.sound})</span>
            </h3>
            <ol className="mt-2 space-y-2">
              {group.words.map((word, i) => (
                <li
                  key={word}
                  className="min-h-8 border-b-2 border-neutral-400 px-1 py-1 text-black"
                  aria-label={answerKey ? undefined : `Blank line ${i + 1} under ${group.pattern}`}
                >
                  {answerKey ? word : <span aria-hidden="true">&nbsp;</span>}
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </WorksheetSection>
  )
}

export interface FillBlankItem {
  word: string
  sentence: string
  blankedSentence: string
  blankedWord: string
}

/**
 * 3. Fill in the blank. Student: sentences with the spelling pattern
 * blanked out of each word. Key: the completed sentences.
 */
export function FillBlankSheet({ items, answerKey }: { items: FillBlankItem[]; answerKey: boolean }) {
  return (
    <WorksheetSection title="Fill in the blank">
      <p className="text-black">
        {answerKey ? 'Completed sentences.' : 'Fill in the missing spelling pattern in each sentence.'}
      </p>
      <ol className="mt-4 list-decimal space-y-3 pl-6">
        {items.map((item) => (
          <li key={item.word} className="text-black">
            {answerKey ? highlightWord(item.sentence, item.word) : <BlankedSentence item={item} />}
          </li>
        ))}
      </ol>
    </WorksheetSection>
  )
}

function BlankedSentence({ item }: { item: FillBlankItem }) {
  const parts = splitOnFirst(item.blankedSentence, item.blankedWord)
  if (!parts) return <>{item.blankedSentence}</>
  const [before, match, after] = parts
  return (
    <>
      {before}
      <span className="worksheet-blank" aria-label={`Blank for ${item.word}`}>
        {match}
      </span>
      {after}
    </>
  )
}

/**
 * 4. Word search. Student: the letter grid and a word bank. Key: the grid
 * with each found word circled with bolder letters.
 */
export function WordSearchSheet({ result, answerKey }: { result: WordSearchResult; answerKey: boolean }) {
  const preset = usePrintPreset()
  const placedCells = new Set<string>()
  if (answerKey) {
    for (const placement of result.placements) {
      for (const cell of placement.cells) placedCells.add(`${cell.row},${cell.col}`)
    }
  }
  return (
    <WorksheetSection title="Word search">
      <p className="text-black">Find each spelling word in the grid. Words can run across, down, or diagonally.</p>
      <table className="mt-4 border-collapse" aria-label="Word search grid">
        <tbody>
          {result.grid.map((row, r) => (
            <tr key={r}>
              {row.map((letter, c) => (
                <td
                  key={c}
                  className={`${GRID_CELL[preset]} border border-neutral-400 text-center font-mono ${GRID_LETTER[preset]} text-black ${
                    placedCells.has(`${r},${c}`) ? 'rounded-full border-2 border-black font-black' : ''
                  }`}
                >
                  {letter}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <h3 className={`mt-4 ${SUBHEADING[preset]} font-bold text-black`}>Word bank</h3>
      <p className="text-black">{result.placements.map((p) => p.word).join(', ')}</p>
      {result.unplaced.length > 0 && (
        <p className="mt-2 text-black">These words did not fit in the grid: {result.unplaced.join(', ')}.</p>
      )}
    </WorksheetSection>
  )
}

/**
 * 5. Crossword. Clues are sentences with the spelling word blanked out,
 * plus an alphabetical word bank. Student: numbered empty grid plus clue
 * lists. Key: the completed grid.
 */
export function CrosswordSheet({ result, answerKey }: { result: CrosswordResult; answerKey: boolean }) {
  const preset = usePrintPreset()
  const across = result.placements.filter((p) => p.direction === 'across')
  const down = result.placements.filter((p) => p.direction === 'down')
  const numbers = new Map<string, number>()
  const letters = new Map<string, string>()
  for (const placement of result.placements) {
    placement.cells.forEach((cell, i) => {
      const key = `${cell.row},${cell.col}`
      if (i === 0) numbers.set(key, placement.number)
      letters.set(key, placement.word[i])
    })
  }
  return (
    <WorksheetSection title="Crossword">
      <p className="text-black">Use the sentences to fill in each word.</p>
      <table className="mt-4 border-collapse" aria-label="Crossword grid">
        <tbody>
          {result.grid.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => {
                const key = `${r},${c}`
                if (cell === null) {
                  return <td key={c} className={`crossword-blocked ${GRID_CELL[preset]}`} aria-hidden="true" />
                }
                return (
                  <td
                    key={c}
                    className={`relative ${GRID_CELL[preset]} border border-black text-center ${GRID_LETTER[preset]} font-bold text-black`}
                  >
                    {numbers.get(key) != null && (
                      <span className={`absolute top-0 left-0.5 ${CLUE_NUMBER[preset]} leading-none font-normal`}>
                        {numbers.get(key)}
                      </span>
                    )}
                    {answerKey ? letters.get(key) : ''}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 grid gap-6 md:grid-cols-2">
        <div>
          <h3 className={`${SUBHEADING[preset]} font-bold text-black`}>Across</h3>
          <ol className="mt-2 space-y-1">
            {across.map((p) => (
              <li key={`across-${p.number}`} className="text-black">
                <strong>{p.number}.</strong> {p.clue}
              </li>
            ))}
          </ol>
        </div>
        <div>
          <h3 className={`${SUBHEADING[preset]} font-bold text-black`}>Down</h3>
          <ol className="mt-2 space-y-1">
            {down.map((p) => (
              <li key={`down-${p.number}`} className="text-black">
                <strong>{p.number}.</strong> {p.clue}
              </li>
            ))}
          </ol>
        </div>
      </div>
      <h3 className={`mt-4 ${SUBHEADING[preset]} font-bold text-black`}>Word bank</h3>
      <p className="text-black">
        {result.placements
          .map((p) => p.word)
          .sort((a, b) => a.localeCompare(b))
          .join(', ')}
      </p>
      {result.unplaced.length > 0 && (
        <p className="mt-2 text-black">These words did not fit in the puzzle: {result.unplaced.join(', ')}.</p>
      )}
    </WorksheetSection>
  )
}

/**
 * 6. Reading practice. Student: sentences with the spelling word blanked
 * out, plus an alphabetical word bank (issue #454). Key: the completed
 * sentences.
 */
export function ReadingSheet({
  items,
  answerKey,
}: {
  items: { word: string; sentence: string }[]
  answerKey: boolean
}) {
  const preset = usePrintPreset()
  return (
    <WorksheetSection title="Reading practice">
      <p className="text-black">
        {answerKey ? 'Completed sentences.' : 'Read each sentence. Fill in each blank with a word from the word bank.'}
      </p>
      <ol className="mt-4 list-decimal space-y-3 pl-6">
        {items.map((item) => (
          <li key={item.word} className="text-black">
            {answerKey ? highlightWord(item.sentence, item.word) : <BlankedReadingSentence item={item} />}
          </li>
        ))}
      </ol>
      <h3 className={`mt-4 ${SUBHEADING[preset]} font-bold text-black`}>Word bank</h3>
      <p className="text-black">
        {items
          .map((item) => item.word)
          .sort((a, b) => a.localeCompare(b))
          .join(', ')}
      </p>
    </WorksheetSection>
  )
}

/**
 * Render a reading sentence with its whole spelling word replaced by a
 * blank. Reuses the fill-in-the-blank blank rendering so the two sheets
 * share one blank style.
 */
function BlankedReadingSentence({ item }: { item: { word: string; sentence: string } }) {
  const parts = splitOnFirst(item.sentence, item.word)
  if (!parts) return <>{item.sentence}</>
  const [before, , after] = parts
  const blankedWord = '_'.repeat(item.word.length)
  return <BlankedSentence item={{ ...item, blankedSentence: `${before}${blankedWord}${after}`, blankedWord }} />
}

const PARENT_PRACTICE_IDEAS = [
  'Read the word list together and listen for the target sound in each word.',
  'Hunt for the spelling patterns in books, signs, and menus.',
  'Ask your child to explain each pattern in their own words.',
  'A few minutes of practice each day beats one long session.',
]

/** 7. A note for families: the week's patterns plus practice ideas. No answer key. */
export function ParentNoteSheet({ list, groups }: { list: WordList; groups: PatternWordGroup[] }) {
  const preset = usePrintPreset()
  return (
    <WorksheetSection title="A note for families">
      <p className="text-black">Dear families,</p>
      <p className="mt-3 text-black">
        This week in spelling{list.week ? ` (week ${list.week})` : ''}, your child is working on the words in &ldquo;
        {list.name}&rdquo;. Here are the spelling patterns we are practicing in class:
      </p>
      <ul className="mt-4 space-y-2">
        {groups.map((group) => (
          <li key={group.patternId} className="text-black">
            <strong>{group.pattern}</strong> ({group.sound}): {group.words.slice(0, 3).join(', ')}
            {group.words.length > 3 ? ', and more' : ''}
          </li>
        ))}
      </ul>
      <h3 className={`mt-6 ${SUBHEADING[preset]} font-bold text-black`}>Ways to practice at home</h3>
      <ul className="mt-2 list-disc space-y-1 pl-6">
        {PARENT_PRACTICE_IDEAS.map((idea) => (
          <li key={idea} className="text-black">
            {idea}
          </li>
        ))}
      </ul>
      <p className="mt-6 text-black">Thank you for supporting your child&rsquo;s spelling practice!</p>
      <div className="mt-10 flex items-center gap-3">
        <span className="w-64 border-b-2 border-black" aria-hidden="true" />
        <span className="text-sm text-neutral-600">Teacher signature</span>
      </div>
    </WorksheetSection>
  )
}
