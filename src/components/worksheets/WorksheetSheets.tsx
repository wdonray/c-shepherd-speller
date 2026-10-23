import type { ReactNode } from 'react'
import { createContext, useContext } from 'react'
import type { WordList } from '@/models/WordList'
import { formatTestDate, plainPatternSpelling, type PatternWordGroup } from '@/lib/worksheets'
import type { WordSearchDifficulty, WordSearchResult } from '@/lib/word-search'
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
      <NameDateHeader />
      <div className={`mt-4 ${BODY_TEXT[preset]}`}>{children}</div>
    </section>
  )
}

/**
 * Name/Date write-in lines (issue #516). Renders at the top of every
 * worksheet sheet, under the section title, so there is always a place to
 * write a name on each printed sheet. Always rendered: the space is
 * reserved on every sheet, so it never shifts the printed layout.
 * The rule sits at the label's text baseline (issue #533), where
 * handwriting naturally rests, not vertically centered against the label.
 * Classroom language, black and white (borders always print).
 */
export function NameDateHeader() {
  return (
    <div className="mt-3 flex flex-wrap gap-x-8 gap-y-2" aria-label="Name and date lines">
      <span className="flex min-w-48 flex-1 items-baseline gap-2">
        <span className="text-sm font-bold text-black">Name:</span>
        <span className="min-w-32 flex-1 border-b-2 border-black" aria-hidden="true" />
      </span>
      <span className="flex min-w-40 flex-1 items-baseline gap-2">
        <span className="text-sm font-bold text-black">Date:</span>
        <span className="min-w-24 flex-1 border-b-2 border-black" aria-hidden="true" />
      </span>
    </div>
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
 * Cut-out card and paste-box sizes by grade band (issue #520). The cards and
 * the boxes share one size per band, so a card cut from the bank physically
 * fits the box it gets pasted into. Beginners get the research floor:
 * ~1 inch tall (min-h-24) for K-1 hands; older bands can go smaller.
 */
const CUT_CARD: Record<WordSearchDifficulty, string> = {
  // Beginner cards keep the research floor of ~1 inch tall (min-h-24); the
  // minimum width stays under the narrowest paste-box interior (~139px at
  // 390px) so a cut card always fits its box, even on the phone preview.
  beginner: 'min-h-24 min-w-32 text-2xl',
  intermediate: 'min-h-20 min-w-32 text-xl',
  upper: 'min-h-16 min-w-28 text-lg',
}

/**
 * Paste boxes are fixed-height (same value as the band's card min-height),
 * so the box geometry never shifts with the word inside it; long words wrap
 * instead of pushing the layout around.
 */
const PASTE_BOX: Record<WordSearchDifficulty, string> = {
  beginner: 'h-24 text-2xl',
  intermediate: 'h-20 text-xl',
  upper: 'h-16 text-lg',
}

/**
 * 2. Cut-and-paste sorting. One page of at most CUT_SORT_WORDS_PER_PAGE words:
 * the caller chunks longer lists so each page fits on one printed sheet.
 * Student: labeled sort columns with paste boxes at the top, then the dashed
 * word cards to cut out at the bottom. Key: the same columns with each box
 * filled in. All functional marks are black (photocopy-safe).
 */
export function CutSortSheet({
  groups,
  answerKey,
  gradeBand,
}: {
  groups: PatternWordGroup[]
  answerKey: boolean
  gradeBand: WordSearchDifficulty
}) {
  const preset = usePrintPreset()
  // The student cut-out bank is shuffled so same-pattern words do not sit
  // next to each other. The answer-key columns stay grouped by pattern.
  const words = shuffleWords(groups.flatMap((group) => group.words))
  const columns = (
    <div className="grid grid-cols-2 gap-6 md:grid-cols-3" aria-label="Sort the words">
      {groups.map((group) => (
        <div key={group.patternId} className="rounded-lg border-2 border-black p-3">
          <h3 className={`${SUBHEADING[preset]} font-bold text-black`}>
            {group.pattern} <span className="font-normal text-neutral-600">({group.sound})</span>
          </h3>
          <ol className="mt-2 space-y-2">
            {group.words.map((word, i) => (
              <li
                key={word}
                className={`flex items-center justify-center border-2 border-black px-1 ${PASTE_BOX[gradeBand]}`}
                aria-label={answerKey ? undefined : `Paste box ${i + 1} under ${group.pattern}`}
              >
                {answerKey ? (
                  <span className="text-center font-bold break-words text-black">{word}</span>
                ) : (
                  <span aria-hidden="true">&nbsp;</span>
                )}
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  )
  return (
    <WorksheetSection title="Cut and sort">
      {!answerKey && (
        <>
          <p className="text-black">Cut out the word cards. Sort each word under its spelling pattern, then glue.</p>
          <h3 className={`mt-8 ${SUBHEADING[preset]} font-bold text-black`}>Sort the words</h3>
          <div className="mt-4">{columns}</div>
          <h3 className={`mt-8 ${SUBHEADING[preset]} font-bold text-black`}>Cut out the word cards</h3>
          <div className="mt-4 flex flex-wrap gap-3" aria-label="Word cards to cut out">
            {words.map((word) => (
              <div
                key={word}
                className={`flex ${CUT_CARD[gradeBand]} items-center justify-center rounded-lg border-2 border-dashed border-black px-6 py-4 font-bold text-black`}
              >
                {word}
              </div>
            ))}
          </div>
        </>
      )}
      {answerKey && <div className="mt-4">{columns}</div>}
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

/**
 * One uniform blank for every worksheet sheet: a fixed-width writing line
 * with a photocopy-safe black underline, independent of the answer's
 * length, so the blank's size never cues the word (issue #517).
 */
function WorksheetBlank({ word }: { word: string }) {
  return <span className="worksheet-blank" aria-label={`Blank for ${word}`} />
}

function BlankedSentence({ item }: { item: FillBlankItem }) {
  const parts = splitOnFirst(item.blankedSentence, item.blankedWord)
  if (!parts) return <>{item.blankedSentence}</>
  const [before, , after] = parts
  return (
    <>
      {before}
      <WorksheetBlank word={item.word} />
      {after}
    </>
  )
}

/**
 * Word-search letter sizes by grade band (issue #519): the youngest readers
 * always get large print (18pt, 44px cells), older bands meet the >=14pt
 * floor on the standard preset. The teacher's large-print preset always wins
 * except for beginners, who already get it.
 */
const WS_CELL: Record<WordSearchDifficulty, string> = {
  beginner: 'h-11 w-11',
  intermediate: 'h-10 w-10',
  upper: 'h-8 w-8',
}

const WS_LETTER: Record<WordSearchDifficulty, string> = {
  beginner: 'text-2xl',
  intermediate: 'text-[16pt]',
  upper: 'text-[14pt]',
}

/**
 * 4. Word search. Student: the letter grid and a word bank. Key: the grid
 * with each found word circled with bolder letters. Difficulty follows the
 * list's grade band (issue #519): beginners get straight-only placements on
 * a fixed 10x10 grid with large-print letters; older bands get diagonals
 * and up to 14x14.
 */
export function WordSearchSheet({ result, answerKey }: { result: WordSearchResult; answerKey: boolean }) {
  const preset = usePrintPreset()
  const placedCells = new Set<string>()
  if (answerKey) {
    for (const placement of result.placements) {
      for (const cell of placement.cells) placedCells.add(`${cell.row},${cell.col}`)
    }
  }
  const teacherLargePrint = preset === 'large-print' && result.difficulty !== 'beginner'
  const cellClass = teacherLargePrint ? GRID_CELL[preset] : WS_CELL[result.difficulty]
  const letterClass = teacherLargePrint ? GRID_LETTER[preset] : WS_LETTER[result.difficulty]
  const instructions =
    result.difficulty === 'beginner'
      ? 'Find each spelling word in the grid. Words run across or down.'
      : 'Find each spelling word in the grid. Words can run across, down, or diagonally.'
  const wordBank = [...result.placements].sort((a, b) => a.word.localeCompare(b.word))
  return (
    <WorksheetSection title="Word search">
      <p className="text-black">{instructions}</p>
      <table className="mt-4 border-collapse" aria-label="Word search grid">
        <tbody>
          {result.grid.map((row, r) => (
            <tr key={r}>
              {row.map((letter, c) => (
                <td
                  key={c}
                  className={`${cellClass} border border-neutral-400 text-center font-mono ${letterClass} text-black ${
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
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1" aria-label="Word bank">
        {wordBank.map((placement) => (
          <span key={placement.word} className="text-black">
            {placement.word}
          </span>
        ))}
      </div>
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
  return (
    <>
      {before}
      <WorksheetBlank word={item.word} />
      {after}
    </>
  )
}

const PARENT_PRACTICE_IDEAS = [
  'Read the word list together and listen for the target sound in each word.',
  'Hunt for the spelling patterns in books, signs, and menus.',
  'Ask your child to explain each pattern in their own words.',
  'A few minutes of practice each day beats one long session.',
]

/** 7. A note for families: the week's patterns in plain language, plus practice ideas and the test date. No answer key. */
export function ParentNoteSheet({
  list,
  groups,
  testDate,
}: {
  list: WordList
  groups: PatternWordGroup[]
  testDate?: string
}) {
  const preset = usePrintPreset()
  const testDateLabel = testDate ? formatTestDate(testDate) : null
  return (
    <WorksheetSection title="A note for families">
      <p className="text-black">Dear families,</p>
      <p className="mt-3 text-black">
        This week in spelling{list.week ? ` (week ${list.week})` : ''}, your child is working on the words in &ldquo;
        {list.name}&rdquo;. Here are the spelling patterns we are practicing in class:
      </p>
      {testDateLabel && (
        <p className="mt-3 text-black">
          The spelling test for these words is on <strong>{testDateLabel}</strong>.
        </p>
      )}
      <ul className="mt-4 space-y-2">
        {groups.map((group) => (
          <li key={group.patternId} className="text-black">
            The <strong>{group.sound}</strong> sound, spelled <strong>{plainPatternSpelling(group.pattern)}</strong>:{' '}
            {group.words.slice(0, 3).join(', ')}
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
