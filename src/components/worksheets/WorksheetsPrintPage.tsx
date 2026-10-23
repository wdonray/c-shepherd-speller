'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import BackBreadcrumb from '@/components/BackBreadcrumb'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { getList, updateList } from '@/lib/lists-api'
import { prebuiltWeekToWordList, type PrebuiltWeek } from '@/lib/prebuilt-lists'
import PrebuiltBadge from '@/components/PrebuiltBadge'
import { fetchExampleSentences } from '@/lib/example-sentences'
import { useLocalStorage } from '@/lib/use-local-storage'
import {
  DEFAULT_PRINT_PRESET,
  PRINT_PRESETS,
  PRINT_PRESET_STORAGE_KEY,
  parsePrintPreset,
  type PrintPreset,
} from '@/lib/print-options'
import type { SpellingPattern, WordList } from '@/models/WordList'
import { reportError } from '@/lib/report-error'
import {
  TYPES_NEEDING_SENTENCES,
  WORKSHEET_TYPES,
  blankWholeWordInSentence,
  blankWordForPattern,
  blankWordInSentence,
  chunkCutSortPages,
  chunkSentencePages,
  extractWorksheetWords,
  FILL_BLANK_SENTENCES_PER_PAGE,
  groupWordsByPattern,
  mulberry32,
  READING_SENTENCES_PER_PAGE,
  stablePuzzleSeed,
  type WorksheetType,
  type WorksheetWord,
} from '@/lib/worksheets'
import { generateWordSearch, gradeBandForGradeLevel, type WordSearchResult } from '@/lib/word-search'
import { generateCrossword, type CrosswordResult } from '@/lib/crossword'
import {
  AnswerKeyHeading,
  CrosswordSheet,
  CutSortSheet,
  FillBlankSheet,
  ParentNoteSheet,
  PrintPresetContext,
  ReadingSheet,
  SpellingListSheet,
  WordSearchSheet,
  type FillBlankItem,
} from './WorksheetSheets'

type LoadState = 'loading' | 'ready' | 'not-found' | 'error'

interface PrintJob {
  wordSearch: WordSearchResult | null
  crossword: CrosswordResult | null
  fillBlank: FillBlankItem[] | null
  reading: { word: string; sentence: string }[] | null
}

/**
 * Print route for the selected worksheets (issue #402). Loads the list,
 * resolves any missing per-word sentences first (the sentence gap flow),
 * then shows a print preview with pre-print options (issue #512): a print
 * style preset and an answer-key toggle. The teacher reviews the preview and
 * opens the print dialog with the Print button. Every puzzle is computed once
 * from a single seeded RNG, so each answer key matches its worksheet.
 */
export default function WorksheetsPrintPage({
  listId,
  prebuiltWeek,
  selectedTypes,
  testDate,
}: {
  listId?: string
  /** Print worksheets for a prebuilt curriculum week (issue #463): the list
   * loads from the bundled data, no API fetch, and nothing is persisted. */
  prebuiltWeek?: PrebuiltWeek
  selectedTypes: WorksheetType[]
  /** Teacher-typed spelling test date (`YYYY-MM-DD`) for the family note
   * (issue #518); omitted when the teacher leaves the picker field empty. */
  testDate?: string
}) {
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [list, setList] = useState<WordList | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  const worksheetsHref = prebuiltWeek ? `/lists/prebuilt/${prebuiltWeek.id}/worksheets` : `/lists/${listId}/worksheets`

  useEffect(() => {
    if (prebuiltWeek) {
      setList(prebuiltWeekToWordList(prebuiltWeek))
      setLoadState('ready')
      return
    }
    let cancelled = false
    async function load() {
      try {
        const data = await getList(listId!)
        if (!cancelled) {
          setList(data)
          setLoadState('ready')
        }
      } catch (err) {
        reportError(err, { location: 'WorksheetsPrintPage.load' })
        if (!cancelled) {
          setLoadState(err instanceof Error && /not found/i.test(err.message) ? 'not-found' : 'error')
        }
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [listId, prebuiltWeek, retryCount])

  if (loadState === 'loading') {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16 text-center" role="status" aria-label="Loading worksheets">
        <div
          className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-line border-t-ink"
          aria-hidden="true"
        />
        <p className="mt-4 text-muted-foreground">Loading your list&hellip;</p>
      </div>
    )
  }

  if (loadState === 'not-found') {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16 text-center">
        <h1 className="text-3xl font-bold">List not found</h1>
        <p className="mt-2 text-[15px] text-muted-foreground">This word list does not exist or was deleted.</p>
        <Button asChild className="mt-6">
          <Link href="/lists">Back to my lists</Link>
        </Button>
      </div>
    )
  }

  if (loadState === 'error' || !list) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16 text-center">
        <h1 className="text-3xl font-bold">Could not load this list</h1>
        <p className="mt-2 text-[15px] text-muted-foreground">Check your connection and try again.</p>
        <Button onClick={() => setRetryCount((c) => c + 1)} className="mt-6">
          Try again
        </Button>
      </div>
    )
  }

  return (
    <WorksheetsJob
      list={list}
      selectedTypes={selectedTypes}
      onListUpdated={setList}
      worksheetsHref={worksheetsHref}
      testDate={testDate}
      isPrebuilt={prebuiltWeek !== undefined}
    />
  )
}

/**
 * The print job itself. Split from the loader so `list` is non-null here.
 * First the sentence gap flow (when selected types need sentences), then
 * the worksheets and their answer keys.
 */
function WorksheetsJob({
  list,
  selectedTypes,
  onListUpdated,
  worksheetsHref,
  isPrebuilt,
  testDate,
}: {
  list: WordList
  selectedTypes: WorksheetType[]
  onListUpdated: (list: WordList) => void
  worksheetsHref: string
  isPrebuilt: boolean
  testDate?: string
}) {
  const [removedWords, setRemovedWords] = useState<Set<string>>(new Set())
  const [typedSentences, setTypedSentences] = useState<Record<string, string>>({})
  const [busyWord, setBusyWord] = useState<string | null>(null)
  const [approving, setApproving] = useState(false)
  const [gapError, setGapError] = useState<string | null>(null)
  const [seed, setSeed] = useState(() => stablePuzzleSeed(list.id))
  /**
   * Pre-print options (issue #512). The print style preset persists per
   * teacher in localStorage so she sets it once; the stored value is
   * validated on read. The answer-key toggle is per print job, not persisted.
   */
  const [storedPreset, setStoredPreset] = useLocalStorage<string>(PRINT_PRESET_STORAGE_KEY, DEFAULT_PRINT_PRESET)
  const preset: PrintPreset = parsePrintPreset(storedPreset)
  const [includeAnswerKey, setIncludeAnswerKey] = useState(true)
  /** First-sentence suggestions each gap word loaded, keyed by word. */
  const [suggestionsByWord, setSuggestionsByWord] = useState<Record<string, string[]>>({})

  // Only crossword and word search are seeded puzzles; the other sheets are
  // deterministic, so the regenerate button only applies to these two.
  const hasPuzzles = selectedTypes.includes('word-search') || selectedTypes.includes('crossword')

  /** Re-seed the generator for a fresh puzzle layout (issue #532). */
  const regeneratePuzzles = () => setSeed(Math.floor(Math.random() * 0xffffffff) + 1)

  /** Rows report their suggestions on load; stable so the per-row fetch effect never re-runs. */
  const handleSuggestionsLoaded = useCallback((word: string, sentences: string[]) => {
    setSuggestionsByWord((prev) => ({ ...prev, [word]: sentences }))
  }, [])

  const words = useMemo(
    () => extractWorksheetWords(list).filter((w) => !removedWords.has(w.word)),
    [list, removedWords]
  )
  const needsSentences = selectedTypes.some((t) => TYPES_NEEDING_SENTENCES.includes(t))
  const gapWords = needsSentences ? words.filter((w) => w.sentence === undefined) : []
  const showGaps = gapWords.length > 0

  /** Save a sentence for a gap word, both remotely and locally. Prebuilt
   * weeks are read-only (issue #463): the sentence applies to this print
   * job only and is never persisted. */
  const saveSentence = async (word: string, sentence: string) => {
    setBusyWord(word)
    setGapError(null)
    try {
      const nextPatterns: SpellingPattern[] = list.patterns.map((p) =>
        p.words.includes(word) ? { ...p, sentences: { ...(p.sentences ?? {}), [word]: sentence } } : p
      )
      if (!isPrebuilt) {
        await updateList(list.id, { patterns: nextPatterns })
      }
      onListUpdated({ ...list, patterns: nextPatterns })
      setTypedSentences((prev) => {
        const next = { ...prev }
        delete next[word]
        return next
      })
    } catch (err) {
      reportError(err, { location: 'WorksheetsJob.saveSentence' })
      setGapError('Could not save that sentence. Check your connection and try again.')
    } finally {
      setBusyWord(null)
    }
  }

  const removeWord = (word: string) => {
    setRemovedWords((prev) => new Set(prev).add(word))
  }

  /**
   * Fill every gap word's first suggestion into its typed box. Words with no
   * suggestions are skipped; boxes the teacher already typed in are left
   * alone. Fills only, nothing is saved: each sentence can still be reviewed
   * and changed with the per-word "Use this sentence" button.
   */
  const acceptAllSuggestions = () => {
    setTypedSentences((prev) => {
      const next = { ...prev }
      for (const word of gapWords) {
        // The button stays disabled until every gap word has loaded its
        // suggestions, so this lookup always hits an own property.
        const first = suggestionsByWord[word.word][0]
        // hasOwn: a word like "constructor" would otherwise read the
        // inherited Object constructor off the prototype and crash on trim().
        const typed = Object.hasOwn(next, word.word) ? next[word.word] : ''
        if (first !== undefined && typed.trim() === '') {
          next[word.word] = first
        }
      }
      return next
    })
  }
  const allSuggestionsLoaded = gapWords.every((w) => Object.hasOwn(suggestionsByWord, w.word))

  /**
   * Issue #511: the accept button flips to "Approve all" once every gap
   * word has a sentence waiting in its typed box. A saved word leaves
   * gapWords, so only drafts matter here; a whitespace-only box counts as
   * empty, exactly like the per-word "Use this sentence" enable rule.
   */
  const allGapsFilled =
    gapWords.length > 0 &&
    gapWords.every((w) => {
      const draft = Object.hasOwn(typedSentences, w.word) ? typedSentences[w.word] : ''
      return draft.trim() !== ''
    })

  /**
   * Issue #511: persist every typed draft in one write, then advance. The
   * gaps clear, so the print job renders and the page moves to the print
   * step. One updateList call (never per word): the per-word save and this
   * are mutually disabled while either is in flight, so two
   * read-modify-write updates can never race on the same patterns.
   *
   * Invariant: Approve all is only clickable when allGapsFilled held at the
   * render that produced the button, so every gap word has a non-empty
   * trimmed draft in typedSentences. The loop below is branchless on
   * purpose: per-word guards here would be dead branches under the 100%
   * branch-coverage bar.
   */
  const approveAllSentences = async () => {
    setApproving(true)
    setGapError(null)
    try {
      // Prototype-free dictionaries: a saved word named like an Object
      // prototype property ("constructor") must not read the inherited
      // member off the prototype, or its saved sentence would be replaced
      // by a function (issue #511 CodeRabbit review).
      const drafts: Record<string, string> = Object.create(null)
      for (const word of gapWords) {
        drafts[word.word] = typedSentences[word.word].trim()
      }
      const nextPatterns: SpellingPattern[] = list.patterns.map((p) => {
        const updates: Record<string, string> = Object.create(null)
        for (const w of p.words) {
          if (Object.hasOwn(drafts, w)) updates[w] = drafts[w]
        }
        return Object.keys(updates).length > 0 ? { ...p, sentences: { ...(p.sentences ?? {}), ...updates } } : p
      })
      if (!isPrebuilt) {
        await updateList(list.id, { patterns: nextPatterns })
      }
      onListUpdated({ ...list, patterns: nextPatterns })
      setTypedSentences({})
    } catch (err) {
      reportError(err, { location: 'WorksheetsJob.approveAllSentences' })
      setGapError('Could not save those sentences. Check your connection and try again.')
    } finally {
      setApproving(false)
    }
  }

  const job: PrintJob | null = useMemo(() => {
    if (showGaps) return null
    const rand = mulberry32(seed)
    const sentenceWords = words.filter((w): w is WorksheetWord & { sentence: string } => w.sentence !== undefined)
    return {
      wordSearch: selectedTypes.includes('word-search')
        ? generateWordSearch(
            words.map((w) => w.word),
            rand,
            {
              // Difficulty follows the list's grade band (issue #519).
              difficulty: gradeBandForGradeLevel(list.gradeLevel),
              // Fillers prefer the list's pattern letters over random A-Z.
              patternSpellings: words.map((w) => w.pattern).join(' '),
            }
          )
        : null,
      crossword: selectedTypes.includes('crossword')
        ? generateCrossword(
            sentenceWords.map((w) => ({ word: w.word, clue: blankWholeWordInSentence(w.sentence, w.word) })),
            rand
          )
        : null,
      fillBlank: selectedTypes.includes('fill-blank')
        ? sentenceWords.map((w) => ({
            word: w.word,
            sentence: w.sentence,
            blankedWord: blankWordForPattern(w.word, w.pattern),
            blankedSentence: blankWordInSentence(w.sentence, w.word, w.pattern),
          }))
        : null,
      reading: selectedTypes.includes('reading')
        ? sentenceWords.map((w) => ({ word: w.word, sentence: w.sentence }))
        : null,
    }
  }, [words, selectedTypes, seed, showGaps])

  if (words.length === 0) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16 text-center">
        <h1 className="text-3xl font-bold">No words to print</h1>
        <p className="mt-2 text-[15px] text-muted-foreground">
          Every word was removed, or the list has no unlocked patterns with words.
        </p>
        <Button asChild variant="secondary" className="mt-6">
          <Link href={worksheetsHref}>Back to worksheets</Link>
        </Button>
      </div>
    )
  }

  if (showGaps) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <BackBreadcrumb href={worksheetsHref} label="Printable worksheets" />
        <h1 className="mt-2 flex items-center gap-2 text-3xl font-bold">
          Sentences needed
          {isPrebuilt && <PrebuiltBadge />}
        </h1>
        <p className="mt-2 text-[15px] text-muted-foreground">
          The worksheets you picked need one sentence per word. For each word below, use a suggested sentence, write
          your own{isPrebuilt ? ' (it applies to these worksheets only)' : ' (it saves to your list)'}, or remove the
          word from the worksheets.
        </p>
        {gapError && (
          <p role="alert" className="mt-4 rounded-2xl border-2 border-red-500 bg-red-50 p-4 text-[15px] text-red-900">
            {gapError}
          </p>
        )}
        {/* Issue #511: two-state button. It accepts suggestions until every
            gap word has a sentence waiting, then turns into the primary
            green "Approve all" that saves everything and advances to print.
            One button, same spot, min-w reserving the wider accept label so
            the state change never shifts the layout. */}
        <div className="mt-4">
          {allGapsFilled ? (
            <Button className="min-w-60" disabled={busyWord !== null || approving} onClick={approveAllSentences}>
              Approve all
            </Button>
          ) : (
            <Button
              variant="secondary"
              className="min-w-60"
              disabled={busyWord !== null || approving || !allSuggestionsLoaded}
              onClick={acceptAllSuggestions}
            >
              Accept all suggestions
            </Button>
          )}
        </div>
        <div className="mt-6 space-y-4">
          {gapWords.map((word) => (
            <GapWordRow
              key={word.word}
              word={word}
              busy={busyWord !== null || approving}
              // hasOwn: a word like "constructor" would otherwise read the
              // inherited Object constructor off the prototype.
              typedValue={Object.hasOwn(typedSentences, word.word) ? typedSentences[word.word] : ''}
              onTypedChange={(value) => setTypedSentences((prev) => ({ ...prev, [word.word]: value }))}
              onSaveSentence={(sentence) => saveSentence(word.word, sentence)}
              onRemove={() => removeWord(word.word)}
              onSuggestionsLoaded={handleSuggestionsLoaded}
            />
          ))}
        </div>
      </div>
    )
  }

  // showGaps returned above, so job is non-null here; and renderSheet only
  // runs for selected types, whose data the job always computes.
  const printJob = job as PrintJob
  const groups = groupWordsByPattern(words)
  const gradeBand = gradeBandForGradeLevel(list.gradeLevel)
  const orderedTypes = WORKSHEET_TYPES.filter((type) => selectedTypes.includes(type))
  const keyedTypes = orderedTypes.filter((type) => type !== 'parent-note')

  /**
   * Issue #531: every printed page is its own white-paper sheet in the
   * preview, in all site themes. The page wrapper is the paper card on
   * screen (white background, shadow, gap between pages) and collapses to
   * nothing in print CSS, so the printed job is unchanged. One sheet per
   * page: WorksheetSection's break-inside: avoid plus break-before on every
   * page after the first means the preview's page boundaries match the real
   * print pagination exactly, with no merged pages.
   */
  function WorksheetPage({ children }: { children: ReactNode }) {
    return <div className="worksheet-page">{children}</div>
  }

  const renderSheets = (type: WorksheetType, answerKey: boolean): ReactNode[] => {
    switch (type) {
      case 'spelling-list':
        return [<SpellingListSheet key={`spelling-${answerKey ? 'key' : 'sheet'}`} groups={groups} />]
      case 'cut-sort':
        // Issue #520: paste boxes sized to the cut-out cards only fit one
        // page, so the words chunk into pages of at most six; each page is
        // its own unbroken WorksheetSection. Card and box sizes follow the
        // list's grade band (issue #519's banding).
        return chunkCutSortPages(groups).map((pageGroups, i) => (
          <CutSortSheet
            key={`cut-${answerKey ? 'key' : 'sheet'}-${i}`}
            groups={pageGroups}
            answerKey={answerKey}
            gradeBand={gradeBand}
          />
        ))
      case 'fill-blank': {
        // Issue #522: sentences chunk into pages of at most
        // FILL_BLANK_SENTENCES_PER_PAGE; each page is its own unbroken
        // WorksheetSection and the printed numbering continues across pages.
        const fillBlank = printJob.fillBlank as FillBlankItem[]
        let fillOffset = 0
        return chunkSentencePages(fillBlank, FILL_BLANK_SENTENCES_PER_PAGE).map((page, i) => {
          const startIndex = fillOffset
          fillOffset += page.length
          return (
            <FillBlankSheet
              key={`fill-${answerKey ? 'key' : 'sheet'}-${i}`}
              items={page}
              answerKey={answerKey}
              startIndex={startIndex}
            />
          )
        })
      }
      case 'word-search':
        return [
          <WordSearchSheet
            key={`word-search-${answerKey ? 'key' : 'sheet'}`}
            result={printJob.wordSearch as WordSearchResult}
            answerKey={answerKey}
          />,
        ]
      case 'crossword':
        return [
          <CrosswordSheet
            key={`crossword-${answerKey ? 'key' : 'sheet'}`}
            result={printJob.crossword as CrosswordResult}
            answerKey={answerKey}
          />,
        ]
      case 'reading': {
        // Issue #522: like fill-in-the-blank above, reading sentences chunk
        // into pages of at most READING_SENTENCES_PER_PAGE with continued
        // numbering. ReadingSheet renders the word bank from its page's
        // words only, so each page is self-contained.
        const reading = printJob.reading as { word: string; sentence: string }[]
        let readOffset = 0
        return chunkSentencePages(reading, READING_SENTENCES_PER_PAGE).map((page, i) => {
          const startIndex = readOffset
          readOffset += page.length
          return (
            <ReadingSheet
              key={`reading-${answerKey ? 'key' : 'sheet'}-${i}`}
              items={page}
              answerKey={answerKey}
              startIndex={startIndex}
            />
          )
        })
      }
      case 'parent-note':
        // The parent note has no answer key (it is not in keyedTypes), so
        // answerKey is always false here: a static key keeps the 100%
        // branch-coverage bar.
        return [<ParentNoteSheet key="parent-note-sheet" list={list} groups={groups} testDate={testDate} />]
    }
  }

  // One printed page per sheet (issue #531). The job title heads the first
  // student page, exactly where it prints; the answer key starts on a fresh
  // page headed by AnswerKeyHeading, exactly where it prints.
  const studentSheets = orderedTypes.flatMap((type) => renderSheets(type, false))
  const keySheets = includeAnswerKey ? keyedTypes.flatMap((type) => renderSheets(type, true)) : []

  return (
    <div className="print-page worksheet-print mx-auto w-full max-w-4xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 print:hidden">
        <Link href={worksheetsHref} className="text-sm font-bold text-sky-ink hover:underline">
          &larr; Back to worksheets
        </Link>
        {hasPuzzles && (
          <Button
            variant="secondary"
            onClick={regeneratePuzzles}
            title="Make a fresh layout for the crossword and word search"
          >
            New version
          </Button>
        )}
      </div>
      {hasPuzzles && (
        <p className="mb-6 text-[15px] text-muted-foreground print:hidden">
          These puzzles stay the same every time you open this page. Make a new version for a fresh layout.
        </p>
      )}
      <PrintOptionsPanel
        preset={preset}
        onPresetChange={setStoredPreset}
        includeAnswerKey={includeAnswerKey}
        onIncludeAnswerKeyChange={setIncludeAnswerKey}
      />
      <PrintPresetContext.Provider value={preset}>
        <div className="print-sheets" data-preset={preset}>
          <WorksheetPage>
            <h1 className="text-3xl font-bold text-black">
              {list.name}: worksheets{list.week ? ` (week ${list.week})` : ''}
            </h1>
            {studentSheets[0]}
          </WorksheetPage>
          {studentSheets.slice(1).map((sheet, i) => (
            <WorksheetPage key={`student-page-${i + 1}`}>{sheet}</WorksheetPage>
          ))}
          ))}
          {keySheets.length > 0 && (
            <>
              <WorksheetPage key="key-page-0">
                <AnswerKeyHeading />
                {keySheets[0]}
              </WorksheetPage>
              {keySheets.slice(1).map((sheet, i) => (
                <WorksheetPage key={`key-page-${i + 1}`}>{sheet}</WorksheetPage>
              ))}
            </>
          )}
        </div>
      </PrintPresetContext.Provider>
    </div>
  )
}

/**
 * Pre-print options panel (issue #512). Screen only, never printed: the
 * teacher picks a print style preset and whether the job includes the answer
 * key, sees the preview update live below, then opens the print dialog.
 * The preset persists per teacher; the answer-key toggle is per print job.
 */
function PrintOptionsPanel({
  preset,
  onPresetChange,
  includeAnswerKey,
  onIncludeAnswerKeyChange,
}: {
  preset: PrintPreset
  onPresetChange: (preset: PrintPreset) => void
  includeAnswerKey: boolean
  onIncludeAnswerKeyChange: (include: boolean) => void
}) {
  return (
    <section aria-label="Print options" className="mb-8 rounded-2xl border-2 border-line bg-card p-6 print:hidden">
      <h2 className="text-xl font-bold">Print options</h2>
      <p className="mt-1 text-[15px] text-muted-foreground">
        Set how the worksheets print. Your print style is saved for next time.
      </p>
      <fieldset className="mt-4">
        <legend className="text-sm font-bold">Print style</legend>
        <div className="mt-2 space-y-2">
          {PRINT_PRESETS.map((option) => (
            <label key={option.id} className="flex cursor-pointer items-start gap-3">
              <input
                type="radio"
                name="print-preset"
                value={option.id}
                checked={preset === option.id}
                onChange={() => onPresetChange(option.id)}
                className="mt-1 h-5 w-5 shrink-0 accent-black"
              />
              <span>
                <span className="block text-[15px] font-bold">{option.label}</span>
                <span className="block text-sm text-muted-foreground">{option.description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="mt-4 flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={includeAnswerKey}
          onChange={(event) => onIncludeAnswerKeyChange(event.target.checked)}
          className="mt-1 h-5 w-5 shrink-0 accent-black"
        />
        <span>
          <span className="block text-[15px] font-bold">Include answer key</span>
          <span className="block text-sm text-muted-foreground">
            Print the teacher answer key after the worksheets.
          </span>
        </span>
      </label>
      <Button onClick={() => window.print()} className="mt-6">
        Print worksheets
      </Button>
    </section>
  )
}

/** One row of the sentence gap flow: suggestions, a custom sentence box, or removal. */
function GapWordRow({
  word,
  busy,
  typedValue,
  onTypedChange,
  onSaveSentence,
  onRemove,
  onSuggestionsLoaded,
}: {
  word: WorksheetWord
  busy: boolean
  typedValue: string
  onTypedChange: (value: string) => void
  onSaveSentence: (sentence: string) => void
  onRemove: () => void
  onSuggestionsLoaded: (word: string, sentences: string[]) => void
}) {
  // Suggestions load per word, so one slow word never blocks the others.
  const [suggestions, setSuggestions] = useState<string[] | null>(null)
  useEffect(() => {
    let cancelled = false
    fetchExampleSentences(word.word).then(({ sentences }) => {
      if (!cancelled) {
        setSuggestions(sentences)
        onSuggestionsLoaded(word.word, sentences)
      }
    })
    return () => {
      cancelled = true
    }
  }, [word.word, onSuggestionsLoaded])

  return (
    <div className="rounded-2xl border-2 border-line bg-card p-4">
      <h2 className="text-lg font-bold">
        {word.word}{' '}
        <span className="font-normal text-muted-foreground">
          ({word.pattern}, {word.sound})
        </span>
      </h2>
      {suggestions === null ? (
        <div className="py-4 text-center" role="status" aria-label={`Finding sentences for ${word.word}`}>
          <div
            className="mx-auto h-6 w-6 animate-spin rounded-full border-4 border-line border-t-ink"
            aria-hidden="true"
          />
        </div>
      ) : suggestions.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {suggestions.map((sentence) => (
            <li key={sentence} className="flex items-start justify-between gap-3">
              <span className="text-[15px]">{sentence}</span>
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => onSaveSentence(sentence)}>
                Use this
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-[15px] text-muted-foreground">
          No suggestions found for this word. Write one below, or remove the word from the worksheets.
        </p>
      )}
      <label className="mt-3 block text-sm font-bold" htmlFor={`typed-${word.word}`}>
        Or write your own sentence
      </label>
      <Textarea
        id={`typed-${word.word}`}
        value={typedValue}
        onChange={(e) => onTypedChange(e.target.value)}
        placeholder={`A sentence using "${word.word}"`}
        maxLength={300}
        className="mt-1"
        disabled={busy}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" disabled={busy || typedValue.trim() === ''} onClick={() => onSaveSentence(typedValue.trim())}>
          Use this sentence
        </Button>
        <Button size="sm" variant="secondary" disabled={busy} onClick={onRemove}>
          Remove {word.word} from worksheet
        </Button>
      </div>
    </div>
  )
}
