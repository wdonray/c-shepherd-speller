'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import BackBreadcrumb from '@/components/BackBreadcrumb'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { getList, updateList } from '@/lib/lists-api'
import { prebuiltWeekToWordList, type PrebuiltWeek } from '@/lib/prebuilt-lists'
import PrebuiltBadge from '@/components/PrebuiltBadge'
import { fetchExampleSentences } from '@/lib/example-sentences'
import type { SpellingPattern, WordList } from '@/models/WordList'
import { reportError } from '@/lib/report-error'
import {
  TYPES_NEEDING_SENTENCES,
  WORKSHEET_TYPES,
  blankWholeWordInSentence,
  blankWordForPattern,
  blankWordInSentence,
  extractWorksheetWords,
  groupWordsByPattern,
  mulberry32,
  type WorksheetType,
  type WorksheetWord,
} from '@/lib/worksheets'
import { generateWordSearch, type WordSearchResult } from '@/lib/word-search'
import { generateCrossword, type CrosswordResult } from '@/lib/crossword'
import {
  AnswerKeyHeading,
  CrosswordSheet,
  CutSortSheet,
  FillBlankSheet,
  ParentNoteSheet,
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
 * then renders the worksheets followed by their answer keys as one print
 * job and opens the print dialog. Every puzzle is computed once from a
 * single seeded RNG, so each answer key matches its worksheet.
 */
export default function WorksheetsPrintPage({
  listId,
  prebuiltWeek,
  selectedTypes,
}: {
  listId?: string
  /** Print worksheets for a prebuilt curriculum week (issue #463): the list
   * loads from the bundled data, no API fetch, and nothing is persisted. */
  prebuiltWeek?: PrebuiltWeek
  selectedTypes: WorksheetType[]
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
}: {
  list: WordList
  selectedTypes: WorksheetType[]
  onListUpdated: (list: WordList) => void
  worksheetsHref: string
  isPrebuilt: boolean
}) {
  const [removedWords, setRemovedWords] = useState<Set<string>>(new Set())
  const [typedSentences, setTypedSentences] = useState<Record<string, string>>({})
  const [busyWord, setBusyWord] = useState<string | null>(null)
  const [gapError, setGapError] = useState<string | null>(null)
  const [seed] = useState(() => Date.now())
  /** First-sentence suggestions each gap word loaded, keyed by word. */
  const [suggestionsByWord, setSuggestionsByWord] = useState<Record<string, string[]>>({})

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

  const job: PrintJob | null = useMemo(() => {
    if (showGaps) return null
    const rand = mulberry32(seed)
    const sentenceWords = words.filter((w): w is WorksheetWord & { sentence: string } => w.sentence !== undefined)
    return {
      wordSearch: selectedTypes.includes('word-search')
        ? generateWordSearch(
            words.map((w) => w.word),
            rand
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

  const readyToPrint = !showGaps && words.length > 0 && job !== null
  useEffect(() => {
    if (readyToPrint) window.print()
  }, [readyToPrint])

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
        <div className="mt-4">
          <Button
            variant="secondary"
            disabled={busyWord !== null || !allSuggestionsLoaded}
            onClick={acceptAllSuggestions}
          >
            Accept all suggestions
          </Button>
        </div>
        <div className="mt-6 space-y-4">
          {gapWords.map((word) => (
            <GapWordRow
              key={word.word}
              word={word}
              busy={busyWord !== null}
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
  const orderedTypes = WORKSHEET_TYPES.filter((type) => selectedTypes.includes(type))
  const keyedTypes = orderedTypes.filter((type) => type !== 'parent-note')

  const renderSheet = (type: WorksheetType, answerKey: boolean) => {
    switch (type) {
      case 'spelling-list':
        return <SpellingListSheet groups={groups} />
      case 'cut-sort':
        return <CutSortSheet groups={groups} answerKey={answerKey} />
      case 'fill-blank':
        return <FillBlankSheet items={printJob.fillBlank as FillBlankItem[]} answerKey={answerKey} />
      case 'word-search':
        return <WordSearchSheet result={printJob.wordSearch as WordSearchResult} answerKey={answerKey} />
      case 'crossword':
        return <CrosswordSheet result={printJob.crossword as CrosswordResult} answerKey={answerKey} />
      case 'reading':
        return <ReadingSheet items={printJob.reading as { word: string; sentence: string }[]} answerKey={answerKey} />
      case 'parent-note':
        return <ParentNoteSheet list={list} groups={groups} />
    }
  }

  return (
    <div className="print-page worksheet-print mx-auto w-full max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-4 print:hidden">
        <Link href={worksheetsHref} className="text-sm font-bold text-sky-ink hover:underline">
          &larr; Back to worksheets
        </Link>
        <Button onClick={() => window.print()}>Print</Button>
      </div>
      <h1 className="text-3xl font-bold text-black">
        {list.name}: worksheets{list.week ? ` (week ${list.week})` : ''}
      </h1>
      {orderedTypes.map((type) => (
        <Fragment key={`sheet-${type}`}>{renderSheet(type, false)}</Fragment>
      ))}
      {keyedTypes.length > 0 && (
        <>
          <AnswerKeyHeading />
          {keyedTypes.map((type) => (
            <Fragment key={`key-${type}`}>{renderSheet(type, true)}</Fragment>
          ))}
        </>
      )}
    </div>
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
