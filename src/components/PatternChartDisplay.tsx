'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { WordList, SpellingPattern, PatternFrequency } from '@/models/WordList'
import WordAnalysis from './WordAnalysis'
import { OddDuck } from './OddDuck'
import { Volume2Icon, LockIcon, LockOpenIcon, PencilIcon } from 'lucide-react'
import { PowerBar, FREQUENCY_LABELS, type PowerBarLevel } from '@/components/ui/power-bar'
import { speak } from '@/lib/tts'
import { getPatternUnderlineRanges } from '@/lib/pattern-underline'
import { getSoundType, SOUND_TYPE_BORDER, SOUND_TYPE_UNDERLINE_COLOR } from '@/lib/sound-type'
import PatternRuleEditor from './PatternRuleEditor'
import AnimatedRuleSlot from './AnimatedRuleSlot'

interface PatternChartDisplayProps {
  list: WordList
  /** When provided, each column header gets a lock/unlock toggle for progressive reveal. */
  onToggleLock?: (patternId: string) => void
  /**
   * The list's classroom rules by pattern text. The class rule wins over
   * the pattern's unscoped rule when both exist (issue #263 moved
   * management off the chart to the list page; issue #372 put editing back
   * on the present chart behind a pencil icon).
   */
  classRules?: Record<string, string> | null
  /**
   * Persist one pattern's rule from the present chart (issue #372). When
   * provided, the rule callout gets a pencil icon at its right side that
   * opens the rule editor modal. Omitted for display-only usages (print,
   * sample chart).
   */
  onSaveRule?: (patternId: string, patternText: string, rule: string) => Promise<void>
  /** The classroom's display name, shown in the rule editor modal. */
  className?: string | null
  /**
   * Whether the rule display under the column headers is shown (issue #310).
   * Default true preserves current behavior; the parent renders a toggle.
   */
  showRules?: boolean
  /**
   * 'present' is the interactive projector chart. 'print' renders a
   * non-interactive poster: locked patterns are excluded entirely, words are
   * plain text, and all buttons are hidden.
   */
  variant?: 'present' | 'print'
  /**
   * Whether to underline the spelling-pattern letters inside each word card
   * on the present chart (issue #264). Default false: underlines stay off
   * until the teacher turns them on with the header toggle. The printed
   * poster never underlines.
   */
  showUnderlines?: boolean
}

const FREQUENCY_LEVEL: Record<PatternFrequency, PowerBarLevel> = {
  common: 3,
  'less-common': 2,
  rare: 1,
}

/**
 * Column border color comes from the pattern's sound type (vowels green,
 * consonants red, bossy R blue). Frequency is shown by the power-bar length
 * only, never by color, so the bar and its label stay neutral.
 */

/**
 * Pattern chart display mode: list name header, one equal-width column per
 * spelling pattern ordered by frequency (most common first), a power-bar
 * gauge in each header showing how common the spelling is, and words as
 * large tappable cards. The projector-friendly replacement for the old
 * tree view. Stays light in dark mode.
 *
 * Designed for projectors: large text, high contrast, keyboard accessible,
 * every word visible at once.
 *
 * variant="print" renders the same chart as a non-interactive poster for
 * printing: locked patterns are excluded entirely, words are plain text,
 * and all buttons and the caption are hidden.
 */
export default function PatternChartDisplay({
  list,
  onToggleLock,
  classRules,
  onSaveRule,
  className,
  showRules = true,
  variant = 'present',
  showUnderlines = false,
}: PatternChartDisplayProps) {
  const [selected, setSelected] = useState<{ word: string; pattern: SpellingPattern } | null>(null)
  const isPrint = variant === 'print'

  const { columns, allLocked, oddDuckWords } = useMemo(() => {
    // The printed poster matches what is currently taught: locked patterns
    // are excluded entirely.
    const teachable = isPrint ? list.patterns.filter((p) => !p.isLocked) : list.patterns

    // Most common spelling first.
    const columns = [...teachable].sort((a, b) => FREQUENCY_LEVEL[b.frequency] - FREQUENCY_LEVEL[a.frequency])
    const allLocked = columns.length > 0 && columns.every((p) => p.isLocked)
    const oddDuckWords: string[] = []
    for (const pattern of teachable) {
      const odd = new Set(pattern.oddDucks ?? [])
      for (const word of pattern.words) {
        if (odd.has(word)) oddDuckWords.push(word)
      }
    }
    return { columns, allLocked, oddDuckWords }
  }, [list, isPrint])

  const openAnalysis = (word: string, pattern: SpellingPattern) => {
    setSelected({ word, pattern })
  }

  // Print keeps the old side-by-side flex row sizing; present-mode columns
  // are grid items, so no inline flex sizing applies.
  const columnStyle = isPrint ? { flex: '1 1 0', minWidth: 220 } : undefined

  // Present-mode grid tracks are capped at a consistent column width and
  // centered, so one or two patterns render at the same size as a full
  // three-column row instead of stretching. The track count follows the
  // pattern count so a lone column lands in the middle of the screen.
  let presentTracks = 'sm:grid-cols-[repeat(2,minmax(0,420px))] lg:grid-cols-[repeat(3,minmax(0,420px))]'
  if (columns.length === 1) {
    presentTracks = 'sm:grid-cols-[minmax(0,420px)]'
  } else if (columns.length === 2) {
    presentTracks = 'sm:grid-cols-[repeat(2,minmax(0,420px))]'
  }

  /**
   * The pencil trigger for the rule editor (issue #372, extended to empty
   * slots by issue #410): an accessible round button that opens the editor
   * for the pattern, whether or not a rule exists yet.
   */
  const ruleEditorTrigger = (pattern: SpellingPattern) => (open: () => void) => (
    <button
      type="button"
      onClick={open}
      aria-label={`Edit rule for ${pattern.pattern}`}
      title={`Edit rule for ${pattern.pattern}`}
      className="flex min-h-[44px] min-w-[44px] shrink-0 cursor-pointer items-center justify-center rounded-full outline-none transition hover:bg-line/50 hover:text-ink focus-visible:bg-line/50 focus-visible:text-ink focus-visible:ring-[3px] focus-visible:ring-ring/60"
    >
      <PencilIcon className="size-4" aria-hidden="true" />
    </button>
  )

  /**
   * The rule editor for one pattern (issue #372, #410). Opened from the
   * pencil trigger; the modal starts from the pattern's effective rule,
   * empty when none exists yet.
   */
  const renderRuleEditor = (pattern: SpellingPattern, rule: string | undefined) => {
    if (!onSaveRule) return null
    return (
      <PatternRuleEditor
        patternId={pattern.id}
        patternText={pattern.pattern}
        initialRule={rule ?? ''}
        shared={classRules?.[pattern.pattern] !== undefined}
        className={className ?? null}
        onSave={(next) => onSaveRule(pattern.id, pattern.pattern, next)}
        trigger={ruleEditorTrigger(pattern)}
      />
    )
  }

  /**
   * The rule under a column header (issue #263). The classroom's rule wins
   * over the pattern's unscoped rule when both exist. Rendered larger than
   * before so it reads from the back of the room. On the present chart the
   * callout also carries a pencil icon at its right side that opens the
   * rule editor modal (issue #372); the modal reuses the list page's
   * PatternRuleEditor.
   */
  const renderRuleDisplay = (pattern: SpellingPattern) => {
    if (isPrint) return null
    const rule = classRules?.[pattern.pattern] ?? pattern.rule
    const isClassRule = classRules?.[pattern.pattern] !== undefined
    // Issue #370: a visible empty placeholder keeps every column the same
    // size when a pattern has no rule; the dashed border marks it as an
    // empty slot rather than a real rule. Issue #410: the empty slot gets
    // the same pencil so a rule can be added from here too.
    const content = !rule ? (
      <figure className="mt-3 border-l-4 border-dashed border-line bg-background/50 px-3 py-2 text-left">
        <div className="flex items-center justify-between gap-2">
          <p className="text-lg font-bold text-muted-foreground">No rule yet</p>
          {renderRuleEditor(pattern, rule)}
        </div>
      </figure>
    ) : (
      <figure className="mt-3 border-l-4 border-sun bg-sun/15 px-3 py-2 text-left">
        <figcaption className="flex items-center justify-between gap-2 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
          <span>{isClassRule ? 'Our class figured out:' : 'The rule:'}</span>
          {renderRuleEditor(pattern, rule)}
        </figcaption>
        <blockquote className="text-lg font-bold leading-snug text-ink">{rule}</blockquote>
      </figure>
    )
    // Issue #374: the slot smoothly animates in and out when the eye toggle
    // flips; after the exit transition it leaves the DOM entirely.
    return <AnimatedRuleSlot show={showRules}>{content}</AnimatedRuleSlot>
  }

  /** Lock toggle for an unlocked column header (locked columns render a placeholder instead). */
  const renderLockToggle = (pattern: SpellingPattern) => {
    if (!onToggleLock || isPrint) return null
    return (
      <button
        type="button"
        onClick={() => onToggleLock(pattern.id)}
        aria-pressed={false}
        aria-label={`Lock pattern ${pattern.pattern}`}
        title={`Lock pattern ${pattern.pattern}`}
        className="flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-full text-muted-foreground outline-none transition hover:bg-line/50 hover:text-ink focus-visible:bg-line/50 focus-visible:text-ink focus-visible:ring-[3px] focus-visible:ring-ring/60"
      >
        <LockIcon className="size-6" aria-hidden="true" />
      </button>
    )
  }

  const renderColumn = (pattern: SpellingPattern) => {
    const border = SOUND_TYPE_BORDER[getSoundType(pattern.pattern)]
    const level = FREQUENCY_LEVEL[pattern.frequency]
    // A locked pattern keeps its equal-width column footprint (no layout
    // reflow when toggling) but hides its name and words behind a placeholder.
    if (pattern.isLocked) {
      return (
        <section
          key={pattern.id}
          aria-label="Locked pattern"
          className={cn('min-w-0 rounded-2xl border-[3px] bg-card p-5', border)}
          style={columnStyle}
        >
          <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 text-center">
            <LockIcon className="size-10 text-muted-foreground" aria-hidden="true" />
            <p className="text-2xl font-extrabold text-muted-foreground">Locked</p>
            {onToggleLock && (
              <button
                type="button"
                onClick={() => onToggleLock(pattern.id)}
                aria-pressed={true}
                aria-label={`Unlock pattern ${pattern.pattern}`}
                className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border-2 border-line px-4 py-1.5 text-[15px] font-bold text-muted-foreground outline-none transition hover:border-sky-deep hover:text-sky-ink focus-visible:border-sky-deep focus-visible:text-sky-ink focus-visible:ring-[3px] focus-visible:ring-ring/60"
              >
                <LockOpenIcon className="size-5" aria-hidden="true" />
                Unlock
              </button>
            )}
          </div>
        </section>
      )
    }
    return (
      <section
        key={pattern.id}
        aria-label={`Pattern ${pattern.pattern}`}
        className={cn('min-w-0 rounded-2xl border-[3px] bg-card p-5', border)}
        style={columnStyle}
      >
        <div className="mb-4 text-center">
          {pattern.keywordImage ? (
            <img
              src={pattern.keywordImage}
              alt={`Keyword image for pattern ${pattern.pattern}`}
              className="mx-auto mb-2 block size-12 rounded-xl object-cover"
            />
          ) : (
            pattern.keywordEmoji && (
              <span
                role="img"
                aria-label={`Keyword image for pattern ${pattern.pattern}`}
                className="mb-2 block text-5xl leading-none"
              >
                {pattern.keywordEmoji}
              </span>
            )
          )}
          <div className="flex items-center justify-center gap-2">
            <h2 className="text-2xl font-extrabold text-ink">{pattern.pattern}</h2>
            {renderLockToggle(pattern)}
          </div>
          {/* Issue #379: the pattern's target sound always reads under the
              pattern name. Present-mode projector size keeps it subtle but
              readable from the back of the room. The print poster keeps its
              existing layout (see issue #402). */}
          {!isPrint && <p className="mt-1 text-lg font-semibold text-muted-foreground">{pattern.sound}</p>}
          <div className="mt-2 flex items-center justify-center gap-2">
            <PowerBar level={level} filledClassName="bg-ink" />
            <span className="text-sm font-bold text-muted-foreground">{FREQUENCY_LABELS[level]}</span>
          </div>
          {renderRuleDisplay(pattern)}
        </div>
        <ul className="space-y-3">
          {pattern.words.map((word) => renderWordCard(word, pattern, `${pattern.id}-${word}`))}
        </ul>
      </section>
    )
  }

  /**
   * Renders a word with its spelling-pattern letters underlined for the
   * present chart (issue #264), using the same ranges and sound-type colors
   * as the sort page. Returns the plain word when the pattern does not
   * occur in it.
   */
  const renderUnderlinedWord = (word: string, pattern: SpellingPattern): ReactNode => {
    const underlineRanges = getPatternUnderlineRanges(word, pattern.pattern)
    if (underlineRanges.length === 0) return word
    const soundType = getSoundType(pattern.pattern)
    const underlineColor = SOUND_TYPE_UNDERLINE_COLOR[soundType]
    const parts: ReactNode[] = []
    let lastIndex = 0
    underlineRanges.forEach((range, i) => {
      if (range.start > lastIndex) {
        parts.push(<span key={`t${i}`}>{word.slice(lastIndex, range.start)}</span>)
      }
      parts.push(
        <span
          key={`u${i}`}
          style={{
            // text-decoration paints the underline without changing the
            // box: border-bottom + padding-bottom made underlined segments
            // taller than plain ones, shifting the word up and breaking
            // letter alignment inside the word card.
            textDecorationLine: 'underline',
            textDecorationColor: underlineColor,
            textDecorationThickness: '4px',
            textUnderlineOffset: '4px',
            textDecorationSkipInk: 'none',
          }}
        >
          {word.slice(range.start, range.end)}
        </span>
      )
      lastIndex = range.end
    })
    if (lastIndex < word.length) {
      parts.push(<span key="t-end">{word.slice(lastIndex)}</span>)
    }
    return <>{parts}</>
  }

  const renderWordCard = (word: string, pattern: SpellingPattern, key: string) => {
    const isOddDuck = pattern.oddDucks?.includes(word) ?? false
    // The printed poster is not interactive: words are plain text, no analysis
    // tap target and no speaker button.
    if (isPrint) {
      return (
        <li
          key={key}
          className={cn(
            'flex min-h-[58px] items-center justify-center rounded-[14px] border-2 px-4 py-2 text-center text-[22px] font-bold',
            isOddDuck ? 'border-plum bg-plum-soft text-plum-ink' : 'border-line bg-card text-ink'
          )}
        >
          {word}
        </li>
      )
    }
    return (
      <li
        key={key}
        className={cn(
          // No hover lift on present-mode word cards: the hover lift moved to
          // the list picker in issue #268, so hover stays flat on the
          // projector here. The flat card still highlights on keyboard
          // focus-within.
          'flex min-h-[58px] w-full items-stretch gap-1 rounded-[14px] border-2 bg-card p-1.5 transition-colors focus-within:border-sky-deep',
          isOddDuck ? 'border-plum bg-plum-soft' : 'border-line'
        )}
      >
        <button
          type="button"
          onClick={() => openAnalysis(word, pattern)}
          aria-label={`Analyze the word ${word}`}
          className="flex min-h-[44px] flex-1 cursor-pointer items-center justify-center rounded-[10px] px-4 py-2 text-[22px] font-bold text-ink outline-none transition-colors hover:bg-sky-soft focus-visible:bg-sky-soft focus-visible:ring-[3px] focus-visible:ring-ring/60"
        >
          {showUnderlines ? renderUnderlinedWord(word, pattern) : word}
        </button>
        <button
          type="button"
          onClick={() => speak(word)}
          aria-label={`Hear the word ${word}`}
          className="flex min-h-[44px] min-w-[52px] cursor-pointer items-center justify-center rounded-[10px] text-sky-deep outline-none transition-colors hover:bg-sky-soft focus-visible:bg-sky-soft focus-visible:ring-[3px] focus-visible:ring-ring/60"
        >
          <Volume2Icon className="size-7" aria-hidden="true" />
        </button>
      </li>
    )
  }

  return (
    <div className={cn('force-light w-full rounded-[20px] bg-background p-6 sm:p-10', isPrint && 'print-chart')}>
      <div className="mb-8 text-center">
        <p className="text-[30px] font-extrabold text-ink">{list.name || 'Untitled list'}</p>
      </div>

      {columns.length === 0 ? (
        isPrint && list.patterns.length > 0 ? (
          <p className="py-12 text-center text-xl text-muted-foreground">
            All patterns are locked, so there is nothing to print. Unlock a pattern in present mode first.
          </p>
        ) : (
          <p className="py-12 text-center text-xl text-muted-foreground">
            No patterns in this list yet. Add patterns from My Spelling Lists first.
          </p>
        )
      ) : (
        <>
          {allLocked && (
            <p className="mb-6 text-center text-xl font-bold text-ink">
              All patterns are locked. Unlock a pattern to begin.
            </p>
          )}
          <div
            className={cn(
              'gap-6',
              // Present: at most 3 columns per row, wrapping to the next row.
              // Track widths are capped and the grid is centered (see
              // presentTracks above), so one or two patterns render at the
              // same size as a full three-column row instead of stretching.
              // Print keeps the old uncapped flex row so the poster layout is
              // unchanged (the print stylesheet forces side-by-side columns).
              isPrint
                ? 'flex flex-col lg:flex-row lg:items-stretch'
                : cn('mx-auto grid w-full max-w-[1400px] grid-cols-1 justify-center', presentTracks)
            )}
            data-chart-columns
          >
            {columns.map((pattern) => renderColumn(pattern))}
          </div>

          {oddDuckWords.length > 0 && (
            <section aria-label="Odd ducks" className="mt-6 rounded-2xl border-2 border-plum bg-plum-soft p-5">
              <div className="mb-2 flex items-center gap-3">
                <OddDuck className="size-11 text-plum" label="Odd duck" />
                <h2 className="text-lg font-bold text-plum-ink">Odd ducks</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                {oddDuckWords.join(', ')}: these spellings do not follow the patterns, so memorize the whole word.
              </p>
            </section>
          )}
        </>
      )}

      {!isPrint && selected && (
        <WordAnalysis
          word={selected.word}
          pattern={selected.pattern}
          onClose={() => setSelected(null)}
          onSpeak={speak}
        />
      )}
    </div>
  )
}
