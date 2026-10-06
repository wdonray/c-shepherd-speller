'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { XIcon, PlusIcon, TrashIcon } from 'lucide-react'
import type { SpellingPattern, PatternFrequency } from '@/models/WordList'

interface PatternEditorProps {
  pattern: SpellingPattern
  onChange: (pattern: SpellingPattern) => void
  onRemove: () => void
}

const FREQUENCIES: { value: PatternFrequency; label: string }[] = [
  { value: 'common', label: 'Common' },
  { value: 'less-common', label: 'Less common' },
  { value: 'rare', label: 'Rare' },
]

/** Editor for a single spelling pattern (one branch of the tree). */
export default function PatternEditor({ pattern, onChange, onRemove }: PatternEditorProps) {
  const [newWord, setNewWord] = useState('')

  const update = (updates: Partial<SpellingPattern>) => {
    onChange({ ...pattern, ...updates })
  }

  const addWord = () => {
    const word = newWord.trim().toLowerCase()
    if (!word || pattern.words.includes(word)) return
    update({ words: [...pattern.words, word] })
    setNewWord('')
  }

  const removeWord = (word: string) => {
    update({ words: pattern.words.filter((w) => w !== word) })
  }

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="grid grid-cols-2 gap-2 flex-1">
          <div>
            <Label htmlFor={`sound-${pattern.id}`}>Sound</Label>
            <Input
              id={`sound-${pattern.id}`}
              value={pattern.sound}
              onChange={(e) => update({ sound: e.target.value })}
              placeholder="e.g. long a"
              maxLength={50}
            />
          </div>
          <div>
            <Label htmlFor={`pattern-${pattern.id}`}>Pattern</Label>
            <Input
              id={`pattern-${pattern.id}`}
              value={pattern.pattern}
              onChange={(e) => update({ pattern: e.target.value })}
              placeholder="e.g. a_e"
              maxLength={20}
            />
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={onRemove} aria-label="Remove pattern">
          <TrashIcon className="size-4" />
        </Button>
      </div>

      <div>
        <Label>Frequency</Label>
        <div className="flex gap-2 mt-1">
          {FREQUENCIES.map((f) => (
            <Button
              key={f.value}
              size="sm"
              variant={pattern.frequency === f.value ? 'default' : 'outline'}
              onClick={() => update({ frequency: f.value })}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <Label>
          <input
            type="checkbox"
            checked={pattern.isOddDuck ?? false}
            onChange={(e) => update({ isOddDuck: e.target.checked })}
            className="mr-2"
          />
          Odd duck (irregular spelling)
        </Label>
      </div>

      <div>
        <Label>Words ({pattern.words.length})</Label>
        <div className="flex flex-wrap gap-1.5 mt-2 mb-2">
          {pattern.words.map((word) => (
            <Badge key={word} variant="secondary" className="gap-1">
              {word}
              <button onClick={() => removeWord(word)} aria-label={`Remove ${word}`} className="hover:text-destructive">
                <XIcon className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
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
          <Button size="sm" onClick={addWord}>
            <PlusIcon className="size-4" />
            Add
          </Button>
        </div>
      </div>
    </div>
  )
}
