'use client'

import { useEffect, useRef, useState } from 'react'
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
import PatternRuleEditor from './PatternRuleEditor'
import { OddDuck } from './OddDuck'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog'
import { WORD_SUGGESTIONS } from '@/data/word-suggestions'
import { wordMatchesPattern } from '@/lib/word-pattern-match'
import { useMediaQuery } from '@/lib/use-media-query'
import {
  MICROPHONE_REQUEST_TIMEOUT_MS,
  hasRecording,
  isAudioCaptureSupported,
  isRecordingStorageSupported,
  requestMicrophoneAccess,
  type MicrophoneRequest,
} from '@/lib/voice-recordings'
import type { SpellingPattern, PatternFrequency, ListColor } from '@/models/WordList'
import { LIST_ACCENT_CLASSES, DEFAULT_LIST_COLOR, isDuplicatePatternPair } from '@/models/WordList'

interface PatternEditorProps {
  pattern: SpellingPattern
  onChange: (pattern: SpellingPattern) => void
  /** Called when the delete button is pressed; the parent confirms before removing. */
  onRemove: () => void
  /**
   * Every pattern in the list being edited, including this one. Used to
   * block identity edits that would duplicate another pattern's spelling
   * pattern + sound pair (issue #414). The candidate's own id is excluded
   * by the check, so the full list can be passed as-is.
   */
  siblingPatterns?: SpellingPattern[]
  /** List accent color: the card's top bar follows it. Defaults to the default list color. */
  color?: ListColor
  /** The list's classroom id, or null/undefined for "No class". */
  classId?: string | null
  /** The classroom's display name, or null when there is no class. */
  className?: string | null
  /** The classroom's rules by pattern text, or null when there is no class. */
  classRules?: Record<string, string> | null
  /**
   * Persist one rule. The parent saves to the classroom (when classId is
   * set) or to the pattern itself. Rejects on failure so the rule editor
   * keeps the draft and shows the error.
   */
  onSaveRule?: (patternId: string, patternText: string, rule: string) => Promise<void>
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

/** Below this width the words table becomes stacked cards. */
const MOBILE_QUERY = '(max-width: 767px)'

/** One style for the card's section headings ("Words (n)", "Details"). */
const SECTION_HEADING_CLASS = 'text-[13px] font-bold uppercase tracking-[0.06em] text-muted-foreground'

/** Editor card for a single spelling pattern (one column of the pattern chart). */
export default function PatternEditor({
  pattern,
  onChange,
  onRemove,
  siblingPatterns = [],
  color = DEFAULT_LIST_COLOR,
  classId,
  className = null,
  classRules = null,
  onSaveRule,
}: PatternEditorProps) {
  const [newWord, setNewWord] = useState('')
  const [wordPendingDelete, setWordPendingDelete] = useState<string | null>(null)
  const [mismatchedWord, setMismatchedWord] = useState<string | null>(null)
  /**
   * The last word rejected as a duplicate, shown under the word input so the
   * teacher knows why the word was not added again. Cleared on any edit or
   * successful save. The notice reserves its space so it never shifts layout.
   */
  const [duplicateWord, setDuplicateWord] = useState<string | null>(null)
  /**
   * Set when an identity edit (spelling pattern or sound) is rejected
   * because it would duplicate another pattern's pair in this list. Shown
   * under the identity inputs so the teacher knows why the change was not
   * applied; the rejected input reverts to its previous value, which would
   * otherwise look like a swallowed keystroke. Cleared on any accepted
   * edit. The notice reserves its space so it never shifts layout.
   */
  const [duplicatePatternPair, setDuplicatePatternPair] = useState(false)
  const [isFrequencyHelpOpen, setIsFrequencyHelpOpen] = useState(false)
  const [recordingWord, setRecordingWord] = useState<string | null>(null)
  /**
   * Words in this pattern that already have a saved voice recording. The
   * mic button renders in its recorded state for these, so the teacher can
   * see at a glance which words play a custom recording instead of the
   * built-in voice.
   */
  const [recordedWords, setRecordedWords] = useState<Set<string>>(new Set())
  /**
   * Words saved while a recording-presence lookup is in flight. The lookup
   * resolves with a full replacement set, so without this a slow read could
   * erase a recording the teacher just saved. Merged into the result below.
   */
  const savedDuringLookupRef = useRef<Set<string>>(new Set())
  /**
   * Words deleted while a recording-presence lookup is in flight. Mirrors
   * savedDuringLookupRef: without this a slow read could resurrect a
   * recording the teacher just deleted. Subtracted from the result below.
   */
  const deletedDuringLookupRef = useRef<Set<string>>(new Set())

  // Load recording presence for this pattern's words. Runs once per word
  // list, not per render: IndexedDB reads are cheap but not free.
  const wordsKey = JSON.stringify(pattern.words)
  useEffect(() => {
    // The presence lookup only needs recording *storage*. Microphone capture
    // support gates recording new audio (see handleMicClick), but a teacher
    // on a device without a mic should still see which words already have
    // recordings.
    if (!isRecordingStorageSupported()) {
      setRecordedWords(new Set())
      return
    }
    let cancelled = false
    const savedDuringFlight = (savedDuringLookupRef.current = new Set<string>())
    const deletedDuringFlight = (deletedDuringLookupRef.current = new Set<string>())
    const words: string[] = JSON.parse(wordsKey)
    void Promise.all(
      words.map((word) =>
        hasRecording(word)
          .then((has) => ({ word, has }))
          .catch(() => ({ word, has: false }))
      )
    ).then((results) => {
      if (!cancelled) {
        const found = results.filter((result) => result.has).map((result) => result.word)
        setRecordedWords(new Set([...found, ...savedDuringFlight].filter((word) => !deletedDuringFlight.has(word))))
      }
    })
    return () => {
      cancelled = true
    }
    // wordsKey is the serialized word list; the effect only refires when the words change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wordsKey])
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

  // The effective rule: the classroom's rule wins when set. Rendered as a
  // per-pattern affordance in the card's Details well; the standalone
  // Rules section is gone.
  const effectiveRule = classRules?.[pattern.pattern] ?? pattern.rule ?? ''
  const ruleShared = !!classId && classRules?.[pattern.pattern] !== undefined

  const accent = LIST_ACCENT_CLASSES[color]
  const isMobile = useMediaQuery(MOBILE_QUERY)

  const update = (updates: Partial<SpellingPattern>) => {
    if (updates.pattern !== undefined || updates.sound !== undefined) {
      // Block identity edits that would put two patterns with the same
      // spelling pattern and sound in one list (issue #414), mirroring the
      // word-level duplicate block below. The input reverts to the previous
      // value since onChange is never called; the notice explains why.
      if (isDuplicatePatternPair(siblingPatterns, { ...pattern, ...updates })) {
        setDuplicatePatternPair(true)
        return
      }
    }
    setDuplicatePatternPair(false)
    onChange({ ...pattern, ...updates })
  }

  const commitWord = (word: string) => {
    update({ words: [...pattern.words, word] })
    setNewWord('')
    setMismatchedWord(null)
    setDuplicateWord(null)
  }

  const addWord = () => {
    const word = newWord.trim().toLowerCase()
    if (!word) return
    if (pattern.words.includes(word)) {
      // Say why: a silent no-op left teachers thinking the save failed.
      setDuplicateWord(word)
      return
    }
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
            aria-label={recordedWords.has(word) ? `Re-record your voice for ${word}` : `Record your voice for ${word}`}
            className={cn(
              'flex size-11 cursor-pointer items-center justify-center rounded-full p-2 outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring/60',
              recordedWords.has(word)
                ? 'bg-sky-soft text-sky-ink hover:brightness-95 focus-visible:brightness-95'
                : 'text-muted-foreground hover:bg-sky-soft hover:text-sky-ink focus-visible:bg-sky-soft'
            )}
          >
            <MicIcon className="size-5" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          {recordedWords.has(word) ? 'Recording saved. Tap to re-record.' : 'Record your voice'}
        </TooltipContent>
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
        className="relative overflow-hidden rounded-[20px] border-2 border-line bg-card p-4 sm:p-6"
      >
        <div className={cn('absolute inset-x-0 top-0 h-2', accent.bar)} aria-hidden="true" />

        <div className="space-y-6">
          {/* A. Pattern identity */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor={`pattern-spelling-${pattern.id}`}>Spelling pattern</Label>
              </div>
              <Input
                id={`pattern-spelling-${pattern.id}`}
                value={pattern.pattern}
                onChange={(e) => update({ pattern: e.target.value })}
                placeholder="e.g. a_e"
                maxLength={20}
                aria-label="Pattern spelling"
                className={cn('h-14 text-xl font-bold', accent.text)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`pattern-sound-${pattern.id}`}>Sound</Label>
              <Input
                id={`pattern-sound-${pattern.id}`}
                value={pattern.sound}
                onChange={(e) => update({ sound: e.target.value })}
                placeholder="e.g. long a"
                maxLength={50}
                aria-label="Target sound"
                // Same sizing as the Spelling pattern input (issue #338).
                className="h-14 text-xl font-bold"
              />
            </div>
          </div>
          {/* Reserved so the notice never shifts the layout when it appears. */}
          <div className="min-h-6 pt-1">
            {duplicatePatternPair && (
              <p role="status" className="text-[13px] text-muted-foreground">
                This spelling and sound are already used by another pattern in the list, so the change was not applied.
              </p>
            )}
          </div>

          {/* B. Words */}
          <div className="space-y-4">
            <h4 className={SECTION_HEADING_CLASS}>Words ({pattern.words.length})</h4>
            {suggestions.length > 0 && (
              <div
                role="group"
                aria-labelledby={`suggestions-${pattern.id}`}
                className="flex flex-wrap items-center gap-2"
              >
                <span id={`suggestions-${pattern.id}`} className="text-[13px] font-semibold text-muted-foreground">
                  Try:
                </span>
                {suggestions.map((word) => (
                  <button
                    key={word}
                    type="button"
                    onClick={() => addSuggestedWord(word)}
                    className="min-h-[44px] cursor-pointer rounded-full border-2 border-line bg-card px-4 text-[15px] font-bold text-ink outline-none transition hover:border-sky-deep hover:text-sky-ink focus-visible:border-sky-deep focus-visible:text-sky-ink focus-visible:ring-[3px] focus-visible:ring-ring/60"
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
                <ul className="space-y-3">
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
                <div className="overflow-x-auto rounded-2xl border-2 border-line">
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
            <div className="max-w-md">
              <div className="flex gap-2">
                <Label htmlFor={`new-word-${pattern.id}`} className="sr-only">
                  New word
                </Label>
                <Input
                  id={`new-word-${pattern.id}`}
                  value={newWord}
                  onChange={(e) => {
                    setNewWord(e.target.value)
                    setDuplicateWord(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addWord()
                    }
                  }}
                  placeholder="Add a word"
                  maxLength={50}
                />
                <Button onClick={addWord} disabled={!newWord.trim()}>
                  Add
                </Button>
              </div>
              {/* Reserved so the notice never shifts the layout when it appears. */}
              <div className="min-h-6 pt-1">
                {duplicateWord && (
                  <p role="status" className="text-[13px] text-muted-foreground">
                    &ldquo;{duplicateWord}&rdquo; is already on the list, so it was not added again.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* C. Details */}
          <div className="space-y-4">
            <h4 className={SECTION_HEADING_CLASS}>Details</h4>
            <div className="rounded-2xl border-2 border-line bg-muted/40 p-4">
              <div className="divide-y divide-line">
                <div className="flex min-h-[56px] w-full flex-col justify-center gap-3 px-3 py-3">
                  <span className="flex items-center gap-1.5">
                    <Label id={`frequency-${pattern.id}`}>Frequency</Label>
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
                    className="flex w-full gap-1 rounded-xl border-2 border-line bg-card p-1"
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
                            'flex min-h-[44px] min-w-0 flex-1 cursor-pointer flex-wrap items-center justify-center gap-1.5 rounded-lg px-3 text-[13px] font-bold outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring/60',
                            selected ? 'bg-sky-soft text-sky-ink' : 'text-muted-foreground hover:text-ink'
                          )}
                        >
                          <PowerBar level={f.level} filledClassName={accent.fill} size="sm" />
                          <span>{f.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
                {onSaveRule && (
                  <div>
                    <PatternRuleEditor
                      patternId={pattern.id}
                      patternText={pattern.pattern}
                      initialRule={effectiveRule}
                      shared={ruleShared}
                      className={className}
                      onSave={(rule) => onSaveRule(pattern.id, pattern.pattern, rule)}
                    />
                  </div>
                )}
                <KeywordImagePicker
                  patternName={pattern.pattern}
                  image={pattern.keywordImage}
                  emoji={pattern.keywordEmoji}
                  onImageSelect={(keywordImage) => update({ keywordImage })}
                  onEmojiSelect={(keywordEmoji) => update({ keywordEmoji })}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t-2 border-line pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={onRemove}
            aria-label={pattern.pattern ? `Delete pattern ${pattern.pattern}` : 'Delete this pattern'}
            className="min-h-[44px] px-4 text-[15px] text-destructive hover:bg-destructive/10 hover:text-destructive focus-visible:bg-destructive/10"
          >
            <Trash2Icon className="size-5" aria-hidden="true" />
            Delete pattern
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="secondary"
                  aria-pressed={isLocked}
                  onClick={() => update({ isLocked: !isLocked })}
                  className="min-h-[44px] rounded-full px-4 text-[13px]"
                >
                  {isLocked ? (
                    <LockIcon className="size-5 text-sky-deep" aria-hidden="true" />
                  ) : (
                    <LockOpenIcon className="size-5" aria-hidden="true" />
                  )}
                  {isLocked ? 'Locked' : 'Lock pattern'}
                </Button>
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
            onSaved={(savedWord) => {
              // Tracked separately so a pending presence lookup merges rather
              // than erases this save when it resolves.
              savedDuringLookupRef.current.add(savedWord)
              setRecordedWords((prev) => new Set(prev).add(savedWord))
            }}
            onDeleted={(deletedWord) => {
              // Tracked separately so a pending presence lookup subtracts
              // rather than resurrects this delete when it resolves.
              deletedDuringLookupRef.current.add(deletedWord)
              setRecordedWords((prev) => {
                const next = new Set(prev)
                next.delete(deletedWord)
                return next
              })
            }}
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
