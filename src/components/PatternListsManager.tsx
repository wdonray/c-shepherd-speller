'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PlusIcon, ArrowLeftIcon, SaveIcon } from 'lucide-react'
import { getLists, createList, updateList, deleteList } from '@/lib/lists-api'
import { generatePatternId, type WordList, type SpellingPattern } from '@/models/WordList'
import WordListCard from './WordListCard'
import PatternEditor from './PatternEditor'

/** Main manager for pattern-based word lists. Replaces the flat list manager. */
export default function PatternListsManager() {
  const [lists, setLists] = useState<WordList[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingList, setEditingList] = useState<WordList | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newGrade, setNewGrade] = useState('')
  const [saving, setSaving] = useState(false)

  const loadLists = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getLists()
      setLists(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load lists')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadLists()
  }, [loadLists])

  const handleCreate = async () => {
    if (!newName.trim()) return
    setSaving(true)
    try {
      const list = await createList({
        name: newName.trim(),
        gradeLevel: newGrade.trim() || undefined,
        patterns: [],
      })
      setLists((prev) => [list, ...prev])
      setNewName('')
      setNewGrade('')
      setIsCreating(false)
      setEditingList(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create list')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (list: WordList) => {
    if (!confirm(`Delete "${list.name}"? This cannot be undone.`)) return
    try {
      await deleteList(list.id)
      setLists((prev) => prev.filter((l) => l.id !== list.id))
      if (editingList?.id === list.id) setEditingList(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete list')
    }
  }

  const handleSave = async () => {
    if (!editingList) return
    setSaving(true)
    try {
      const updated = await updateList(editingList.id, {
        name: editingList.name,
        gradeLevel: editingList.gradeLevel,
        patterns: editingList.patterns,
      })
      setLists((prev) => prev.map((l) => (l.id === updated.id ? updated : l)))
      setEditingList(updated)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save list')
    } finally {
      setSaving(false)
    }
  }

  const addPattern = () => {
    if (!editingList) return
    const newPattern: SpellingPattern = {
      id: generatePatternId(),
      sound: '',
      pattern: '',
      frequency: 'common',
      words: [],
    }
    setEditingList({ ...editingList, patterns: [...editingList.patterns, newPattern] })
  }

  const updatePattern = (patternId: string, updated: SpellingPattern) => {
    if (!editingList) return
    setEditingList({
      ...editingList,
      patterns: editingList.patterns.map((p) => (p.id === patternId ? updated : p)),
    })
  }

  const removePattern = (patternId: string) => {
    if (!editingList) return
    setEditingList({
      ...editingList,
      patterns: editingList.patterns.filter((p) => p.id !== patternId),
    })
  }

  if (loading) {
    return (
      <div className="text-center py-8" role="status">
        <p className="text-muted-foreground">Loading your word lists...</p>
      </div>
    )
  }

  // Editing a single list
  if (editingList) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => setEditingList(null)}>
            <ArrowLeftIcon className="size-4" />
            All lists
          </Button>
        </div>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="list-name">List name</Label>
            <Input
              id="list-name"
              value={editingList.name}
              onChange={(e) => setEditingList({ ...editingList, name: e.target.value })}
              maxLength={100}
            />
          </div>
          <div>
            <Label htmlFor="list-grade">Grade level (optional)</Label>
            <Input
              id="list-grade"
              value={editingList.gradeLevel ?? ''}
              onChange={(e) => setEditingList({ ...editingList, gradeLevel: e.target.value || undefined })}
              placeholder="e.g. 1"
              maxLength={20}
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Spelling patterns ({editingList.patterns.length})</h3>
            <Button size="sm" variant="outline" onClick={addPattern}>
              <PlusIcon className="size-4" />
              Add pattern
            </Button>
          </div>
          {editingList.patterns.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No patterns yet. Add a pattern for each spelling of the target sound. For example, for long A you might
              add a_e (cake), ai (rain), and ay (day).
            </p>
          ) : (
            editingList.patterns.map((pattern) => (
              <PatternEditor
                key={pattern.id}
                pattern={pattern}
                onChange={(updated) => updatePattern(pattern.id, updated)}
                onRemove={() => removePattern(pattern.id)}
              />
            ))
          )}
        </div>

        <Button onClick={handleSave} disabled={saving || !editingList.name.trim()}>
          <SaveIcon className="size-4" />
          {saving ? 'Saving...' : 'Save list'}
        </Button>
      </div>
    )
  }

  // List overview
  return (
    <div className="space-y-4">
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">My word lists ({lists.length})</h3>
        <Button size="sm" onClick={() => setIsCreating(true)}>
          <PlusIcon className="size-4" />
          New list
        </Button>
      </div>

      {isCreating && (
        <div className="border rounded-lg p-4 space-y-3">
          <div>
            <Label htmlFor="new-list-name">List name</Label>
            <Input
              id="new-list-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Week 5: Long A"
              maxLength={100}
            />
          </div>
          <div>
            <Label htmlFor="new-list-grade">Grade level (optional)</Label>
            <Input
              id="new-list-grade"
              value={newGrade}
              onChange={(e) => setNewGrade(e.target.value)}
              placeholder="e.g. 1"
              maxLength={20}
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={saving || !newName.trim()}>
              {saving ? 'Creating...' : 'Create list'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setIsCreating(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {lists.length === 0 && !isCreating ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground mb-2">No word lists yet.</p>
          <p className="text-sm text-muted-foreground">Create your first list to organize words by spelling pattern.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {lists.map((list) => (
            <WordListCard key={list.id} list={list} onEdit={setEditingList} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  )
}
