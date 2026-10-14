'use client'

import { useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PowerBar, type PowerBarLevel } from '@/components/ui/power-bar'
import { XIcon, InfoIcon, Trash2Icon, LockIcon, LockOpenIcon, MicIcon } from 'lucide-react'
import FrequencyHelpDialog from './FrequencyHelpDialog'
import SentencePicker from './SentencePicker'
import KeywordImagePicker from './KeywordImagePicker'
import VoiceRecorderModal from './VoiceRecorderModal'
import { OddDuck } from './OddDuck'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog'
import { WORD_SUGGESTIONS } from '@/data/word-suggestions'
import { wordMatchesPattern } from '@/lib/word-pattern-match'
import { useMediaQuery } from '@/lib/use-media-query'
import {
  MICROPHONE_REQUEST_TIMEOUT_MS,
  isAudioCaptureSupported,
  requestMicrophoneAccess,
  type MicrophoneRequest,
} from '@/lib/voice-recordings'
import type { SpellingPattern, PatternFrequency, ListColor } from '@/models/WordList'
import { LIST_ACCENT_CLASSES, DEFAULT_LIST_COLOR } from '@/models/WordList'

interface PatternEditorProps {
  pattern: SpellingPattern
  onChange: (pattern: SpellingPattern) => void
  /** Called when the delete button is pressed; the parent confirms before removing. */
  onRemove: () => void
  /** List accent color: the card's top bar follows it. Defaults to the default list color. */
  color?: ListColor
  /**
   * True when this pattern has edits not yet confirmed saved. Shows an
   * "Unsaved" badge on the pattern card itself, so the teacher can see which
   * pattern is still unsaved after moving on to another part of the page.
   */
  isUnsaved?: boolean
}

const FREQUENCIES: { value: PatternFrequency; label: string; meaning: string; level: PowerBarLevel }[] = [
  {
    value: 'common',
    label: 'Common',
    meaning: 'Shows up in most words with this sound. Teach this spelling first.',
    level: 3,
  },
  {
    value: 'less-common',
    label: 'Less common',
    meaning: 'Shows up sometimes. Teach it after the common spelling.',
    level: 2,
  },
  {
    value: 'rare',
    label: 'Rare',
    meaning: 'Shows up in just a few words. Teach it last, or skip it for now.',
    level: 1,
  },
]

const FREQUENCY_LABELS: Record<PatternFrequency, string> = {
  common: 'Common',
  'less-common': 'Less common',
  rare: 'Rare',
}

/** Below this width the words table becomes stacked cards. */
const MOBILE_QUERY = '(max-width: 767px)'

/** Editor card for a single spelling pattern (one column of the pattern chart). */
export default function PatternEditor({
  pattern,
  onChange,
  onRemove,
  color = DEFAULT_LIST_COLOR,
  isUnsaved = false,
}: PatternEditorProps) {
  const [newWord, setNewWord] = useState('')
  const [wordPendingDelete, setWordPendingDelete] = useState<string | null>(null)
  const [mismatchedWord, setMismatchedWord] = useState<string | null>(null)
  const [isFrequencyHelpOpen, setIsFrequencyHelpOpen] = useState(false)
  const [recordingWord, setRecordingWord] = useState<string | null>(null)
  /**
   * In-flight microphone permission request for the word being recorded.
   * Started here, in the mic button's click handler: browsers only show the
   * permission prompt for requests made directly from a user gesture, so
   * the modal cannot ask for it from its own open effect. The modal awaits
   * this request and records from the granted stream.
   */
  const micRequestRef = useRef<MicrophoneRequest | null>(null)

  const handleMicClick = (word: string) => {
    if (isAudioCaptureSupported()) {
      const request = requestMicrophoneAccess(MICROPHONE_REQUEST_TIMEOUT_MS)
      // The modal observes the outcome; keep an unobserved rejection from
      // surfacing as an unhandled rejection.
      request.promise.catch(() => {})
      micRequestRef.current = request
    } else {
      micRequestRef.current = null
    }
    setRecordingWord(word)
  }
  const isLocked = pattern.isLocked ?? false

  const accent = LIST_ACCENT_CLASSES[color]
  const isMobile = useMediaQuery(MOBILE_QUERY)

  const update = (updates: Partial<SpellingPattern>) => {
    onChange({ ...pattern, ...updates })
  }

  const commitWord = (word: string) => {
    update({ words: [...pattern.words, word] })
    setNewWord('')
    setMismatchedWord(null)
  }

  const addWord = () => {
    const word = newWord.trim().toLowerCase()
    if (!word || pattern.words.includes(word)) return
    if (!wordMatchesPattern(word, pattern.pattern)) {
      // Warn at save time, never block: the match is a heuristic that
      // cannot catch subtle cases like "have" under "a_e".
      setMismatchedWord(word)
      return
    }
    commitWord(word)
  }

  const removeWord = (word: string) => {
    const sentences = { ...(pattern.sentences ?? {}) }
    delete sentences[word]
    const oddDucks = (pattern.oddDucks ?? []).filter((w) => w !== word)
    update({
      words: pattern.words.filter((w) => w !== word),
      sentences: Object.keys(sentences).length > 0 ? sentences : undefined,
      oddDucks: oddDucks.length > 0 ? oddDucks : undefined,
    })
    setWordPendingDelete(null)
  }

  const handleRemoveClick = (word: string) => {
    // Confirm when the word has a sentence attached, so teachers do not
    // lose a custom sentence by accident.
    if (pattern.sentences?.[word]) {
      setWordPendingDelete(word)
    } else {
      removeWord(word)
    }
  }

  const setWordSentence = (word: string, sentence: string | undefined) => {
    const sentences = { ...(pattern.sentences ?? {}) }
    if (sentence) {
      sentences[word] = sentence
    } else {
      delete sentences[word]
    }
    update({ sentences: Object.keys(sentences).length > 0 ? sentences : undefined })
  }

  const toggleWordOddDuck = (word: string) => {
    const oddDucks = new Set(pattern.oddDucks ?? [])
    if (oddDucks.has(word)) {
      oddDucks.delete(word)
    } else {
      oddDucks.add(word)
    }
    const next = [...oddDucks]
    update({ oddDucks: next.length > 0 ? next : undefined })
  }

  const addSuggestedWord = (word: string) => {
    // The suggestion list already filters out words in the pattern, so this
    // always adds. Uses the same dedupe-safe update shape as addWord.
    update({ words: [...pattern.words, word] })
  }

  // The word actions render identically in the desktop table and the mobile stacked cards.
  const renderWordActions = (word: string) => (
    <div className="flex items-center justify-end gap-3">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => handleMicClick(word)}
            aria-label={`Record your voice for ${word}`}
            className="flex size-11 cursor-pointer items-center justify-center rounded-full p-2 text-muted-foreground outline-none transition hover:bg-sky-soft hover:text-sky-ink focus-visible:bg-sky-soft focus-visible:ring-[3px] focus-visible:ring-ring/60"
          >
            <MicIcon className="size-5" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Record your voice</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => toggleWordOddDuck(word)}
            aria-pressed={pattern.oddDucks?.includes(word) ?? false}
            aria-label={pattern.oddDucks?.includes(word) ? `Unmark ${word} as odd duck` : `Mark ${word} as odd duck`}
            className={cn(
              'flex size-11 cursor-pointer items-center justify-center rounded-full p-2 outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring/60',
              pattern.oddDucks?.includes(word)
                ? 'bg-plum-soft text-plum hover:brightness-95 focus-visible:brightness-95'
                : 'text-muted-foreground hover:bg-plum-soft hover:text-plum focus-visible:bg-plum-soft focus-visible:text-plum'
            )}
          >
            <OddDuck className="size-5" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Mark as odd duck</TooltipContent>
      </Tooltip>
      <SentencePicker
        word={word}
        patternId={pattern.id}
        currentSentence={pattern.sentences?.[word]}
        onSelect={(s) => setWordSentence(word, s)}
        variant="pencil"
      />
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => handleRemoveClick(word)}
            aria-label={`Remove ${word}`}
            className="flex size-11 cursor-pointer items-center justify-center rounded-full p-2 text-coral-ink outline-none transition hover:bg-coral-soft focus-visible:bg-coral-soft focus-visible:ring-[3px] focus-visible:ring-ring/60"
          >
            <XIcon className="size-5" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Remove word</TooltipContent>
      </Tooltip>
    </div>
  )

  // Suggest words only on exact sound+pattern match (case-insensitive, trimmed).
  // Words already in the list are filtered out.
  const suggestions = (
    WORD_SUGGESTIONS[pattern.sound.trim().toLowerCase()]?.[pattern.pattern.trim().toLowerCase()] ?? []
  )
    .filter((word) => !pattern.words.includes(word))
    .slice(0, 3)

  return (
    <TooltipProvider delayDuration={300}>
      <section
        aria-label={pattern.pattern ? `Pattern ${pattern.pattern}` : 'Untitled pattern'}
        className="relative overflow-hidden rounded-[20px] border-2 border-line bg-card p-6"
      >
        <div className={cn('absolute inset-x-0 top-0 h-2', accent.bar)} aria-hidden="true" />

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor={`pattern-spelling-${pattern.id}`}>Spelling pattern</Label>
                  {isUnsaved && (
                    <span
                      role="status"
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-500/50 bg-amber-500/10 px-2.5 py-0.5 text-[12px] font-bold text-amber-700"
                    >
                      <span aria-hidden="true" className="size-1.5 rounded-full bg-amber-500" />
                      Unsaved
                    </span>
                  )}
                </div>
                <Input
                  id={`pattern-spelling-${pattern.id}`}
                  value={pattern.pattern}
                  onChange={(e) => update({ pattern: e.target.value })}
                  placeholder="e.g. a_e"
                  maxLength={20}
                  aria-label="Pattern spelling"
                  className={cn(
                    'h-auto border-2 border-line bg-card px-2 text-[22px] font-bold',
                    'placeholder:text-muted-foreground',
                    'focus-visible:border-sky-deep focus-visible:ring-[3px]',
                    accent.text
                  )}
                />
              </div>
              <div className="shrink-0 space-y-1.5">
                <span className="flex items-center text-sm leading-none font-medium select-none">Keyword image</span>
                <KeywordImagePicker
                  patternName={pattern.pattern}
                  image={pattern.keywordImage}
                  emoji={pattern.keywordEmoji}
                  onImageSelect={(keywordImage) => update({ keywordImage })}
                  onEmojiSelect={(keywordEmoji) => update({ keywordEmoji })}
                />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="shrink-0 text-[15px] text-muted-foreground">Sound:</span>
              <Input
                value={pattern.sound}
                onChange={(e) => update({ sound: e.target.value })}
                placeholder="e.g. long a"
                maxLength={50}
                aria-label="Target sound"
                className="h-9 border-2 border-line bg-card px-2 text-[15px] text-muted-foreground placeholder:text-muted-foreground focus-visible:border-sky-deep focus-visible:ring-[3px]"
              />
            </div>
          </div>

          <div className="flex w-full flex-col items-start gap-2 sm:w-auto sm:shrink-0 sm:items-end">
            <span className="flex items-center gap-1.5">
              <span id={`frequency-${pattern.id}`} className="text-[13px] font-medium text-muted-foreground">
                Frequency
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setIsFrequencyHelpOpen(true)}
                    aria-label="About frequency"
                    className="flex size-7 cursor-pointer items-center justify-center rounded-full text-muted-foreground outline-none transition hover:bg-line/50 hover:text-ink focus-visible:text-ink focus-visible:ring-[3px] focus-visible:ring-ring/60"
                  >
                    <InfoIcon className="size-4" aria-hidden="true" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>What does frequency mean?</TooltipContent>
              </Tooltip>
            </span>
            <div
              role="radiogroup"
              aria-labelledby={`frequency-${pattern.id}`}
              className="flex flex-wrap gap-1.5 sm:justify-end"
            >
              {FREQUENCIES.map((f) => {
                const selected = pattern.frequency === f.value
                return (
                  <button
                    key={f.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={`${f.label}. ${f.meaning}`}
                    onClick={() => update({ frequency: f.value })}
                    className={cn(
                      'cursor-pointer rounded-xl border-2 p-2 transition outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60',
                      selected
                        ? cn('border-current hover:brightness-95 focus-visible:brightness-95', accent.text, accent.soft)
                        : 'border-line opacity-50 hover:opacity-100 focus-visible:opacity-100'
                    )}
                  >
                    <PowerBar level={f.level} filledClassName={accent.fill} />
                  </button>
                )
              })}
            </div>
            <span className="text-[13px] font-semibold">{FREQUENCY_LABELS[pattern.frequency]}</span>
          </div>
        </div>

        <div className="mt-5">
          <h4 className="text-[15px] font-bold">Words ({pattern.words.length})</h4>
          {suggestions.length > 0 && (
            <div
              role="group"
              aria-labelledby={`suggestions-${pattern.id}`}
              className="mt-2 flex flex-wrap items-center gap-2"
            >
              <span id={`suggestions-${pattern.id}`} className="text-[13px] font-semibold text-muted-foreground">
                Try:
              </span>
              {suggestions.map((word) => (
                <button
                  key={word}
                  type="button"
                  onClick={() => addSuggestedWord(word)}
                  className="min-h-[44px] cursor-pointer rounded-full border-2 border-sky bg-sky-soft px-4 py-2 text-[15px] font-bold text-sky-ink outline-none transition hover:brightness-95 focus-visible:brightness-95 focus-visible:ring-[3px] focus-visible:ring-ring/60"
                >
                  {word}
                </button>
              ))}
            </div>
          )}
          {pattern.words.length > 0 &&
            (isMobile ? (
              // Stacked cards on mobile: the word is the card heading, the
              // example sentence sits below it as a labeled field.
              <ul className="mt-2 space-y-3">
                {pattern.words.map((word) => {
                  const sentence = pattern.sentences?.[word]
                  return (
                    <li key={word} className="rounded-2xl border-2 border-line bg-card p-4">
                      <div className="flex items-center justify-between gap-3">
                        <h5 className="min-w-0 flex-1 truncate text-[17px] font-bold text-ink">{word}</h5>
                        {renderWordActions(word)}
                      </div>
                      <p className="mt-2 text-[13px] font-semibold text-muted-foreground">Example sentence</p>
                      <p className="mt-1 text-[15px] text-muted-foreground">
                        {sentence ?? <span aria-hidden="true">—</span>}
                        {!sentence && <span className="sr-only">No example sentence</span>}
                      </p>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="mt-2 overflow-x-auto rounded-2xl border-2 border-line">
                <table className="w-full text-left text-[15px]">
                  <thead>
                    <tr className="border-b-2 border-line bg-muted/50">
                      <th scope="col" className="px-4 py-3 font-bold text-ink">
                        Word
                      </th>
                      <th scope="col" className="px-4 py-3 font-bold text-ink">
                        Example sentence
                      </th>
                      <th scope="col" className="w-[120px] px-4 py-3 text-right font-bold text-ink">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pattern.words.map((word) => {
                      const sentence = pattern.sentences?.[word]
                      return (
                        <tr key={word} className="border-b border-line last:border-0">
                          <td className="px-4 py-2 font-semibold text-ink">{word}</td>
                          <td className="max-w-[300px] truncate px-4 py-2 text-muted-foreground">
                            {sentence ?? <span aria-hidden="true">—</span>}
                            {!sentence && <span className="sr-only">No example sentence</span>}
                          </td>
                          <td className="px-4 py-2">{renderWordActions(word)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          <div className="mt-3 flex max-w-md gap-2">
            <Input
              value={newWord}
              onChange={(e) => setNewWord(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addWord()
                }
              }}
              placeholder="Add a word"
              maxLength={50}
              aria-label="New word"
            />
            <Button onClick={addWord} disabled={!newWord.trim()}>
              Add
            </Button>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t-2 border-line pt-4">
          <button
            type="button"
            onClick={onRemove}
            aria-label={pattern.pattern ? `Delete pattern ${pattern.pattern}` : 'Delete this pattern'}
            className="flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-2 text-[15px] font-bold text-destructive outline-none transition hover:bg-destructive/10 focus-visible:bg-destructive/10 focus-visible:ring-[3px] focus-visible:ring-ring/60"
          >
            <Trash2Icon className="size-5" aria-hidden="true" />
            Delete pattern
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-pressed={isLocked}
                  onClick={() => update({ isLocked: !isLocked })}
                  className={cn(
                    'inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border-2 px-4 py-1.5 text-[13px] font-bold transition outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60',
                    isLocked
                      ? 'border-sky-deep bg-sky-soft text-sky-ink hover:brightness-95 focus-visible:brightness-95'
                      : 'border-line bg-transparent text-muted-foreground hover:border-sky-deep hover:text-sky-ink focus-visible:border-sky-deep focus-visible:text-sky-ink'
                  )}
                >
                  {isLocked ? (
                    <LockIcon className="size-5 text-sky-deep" aria-hidden="true" />
                  ) : (
                    <LockOpenIcon className="size-5" aria-hidden="true" />
                  )}
                  {isLocked ? 'Locked' : 'Lock pattern'}
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-60">
                Locked patterns are hidden in present mode until you unlock them.
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        <Dialog open={wordPendingDelete !== null} onOpenChange={(open) => !open && setWordPendingDelete(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-ink">Remove this word?</DialogTitle>
              <DialogDescription className="text-[14px] text-muted-foreground">
                {wordPendingDelete && (
                  <>
                    &ldquo;{wordPendingDelete}&rdquo; has an example sentence attached. Removing the word will also
                    delete its sentence.
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setWordPendingDelete(null)}>
                Keep word
              </Button>
              <Button variant="destructive" onClick={() => wordPendingDelete && removeWord(wordPendingDelete)}>
                Remove word
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={mismatchedWord !== null} onOpenChange={(open) => !open && setMismatchedWord(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-ink">Check this word</DialogTitle>
              <DialogDescription className="text-[14px] text-muted-foreground">
                {mismatchedWord && (
                  <>
                    &ldquo;{mismatchedWord}&rdquo; does not look like it contains the &ldquo;{pattern.pattern}&rdquo;
                    spelling pattern. Some words are tricky, so save it anyway if it belongs here.
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setMismatchedWord(null)}>
                Keep editing
              </Button>
              <Button onClick={() => mismatchedWord && commitWord(mismatchedWord)}>Save anyway</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <FrequencyHelpDialog
          isOpen={isFrequencyHelpOpen}
          onClose={() => setIsFrequencyHelpOpen(false)}
          accentFill={accent.fill}
        />
        {recordingWord && (
          <VoiceRecorderModal
            word={recordingWord}
            open={recordingWord !== null}
            microphoneRequest={micRequestRef.current}
            onOpenChange={(open) => {
              if (!open) {
                micRequestRef.current?.cancel()
                micRequestRef.current = null
                setRecordingWord(null)
              }
            }}
          />
        )}
      </section>
    </TooltipProvider>
  )
}
