import { useState } from 'react'
import { Input } from './ui/input'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Plus, Pencil, Check, X } from 'lucide-react'
import { isDuplicateItem } from '@/lib/spelling-utils'

interface SpellingDataCardProps {
  title: string
  value: string
  setValue: (value: string) => void
  addItem: () => void
  updateItem: (index: number, newValue: string) => void
  removeItem: (index: number) => void
  spellingData: string[]
  loading: boolean
}

const MAX_ITEM_LENGTH = 100

export default function SpellingDataCard({
  title,
  value,
  setValue,
  addItem,
  updateItem,
  removeItem,
  spellingData,
  loading,
}: SpellingDataCardProps) {
  const [addError, setAddError] = useState<string | null>(null)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editError, setEditError] = useState<string | null>(null)

  const placeHolder: Record<string, string> = {
    words: 'Add a new word to your list',
    sounds: 'Add a new sound pattern',
    spelling: 'Add a new spelling rule',
  }
  const listName = title.toLowerCase()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // Blank submits are blocked by the disabled submit button and the
    // sheet-level guard; the card only needs the duplicate check here.
    const trimmed = value.trim()
    if (isDuplicateItem(spellingData, trimmed)) {
      setAddError(`"${trimmed}" is already in your ${listName} list.`)
      return
    }
    setAddError(null)
    addItem()
  }

  function handleAddChange(next: string) {
    setValue(next)
    if (addError) setAddError(null)
  }

  function startEditing(index: number) {
    setEditingIndex(index)
    setEditValue(spellingData[index])
    setEditError(null)
  }

  function cancelEditing() {
    setEditingIndex(null)
    setEditValue('')
    setEditError(null)
  }

  function saveEdit(index: number) {
    const trimmed = editValue.trim()
    if (!trimmed) {
      setEditError('An item cannot be empty.')
      return
    }
    if (isDuplicateItem(spellingData, trimmed, index)) {
      setEditError(`"${trimmed}" is already in your ${listName} list.`)
      return
    }
    setEditError(null)
    updateItem(index, trimmed)
    setEditingIndex(null)
    setEditValue('')
  }

  function handleEditKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key === 'Enter') {
      e.preventDefault()
      saveEdit(index)
    } else if (e.key === 'Escape') {
      cancelEditing()
    }
  }

  function handleEditChange(next: string) {
    setEditValue(next)
    if (editError) setEditError(null)
  }

  const actionButtonClass =
    'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 transition-all duration-200'

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <div className="flex flex-col gap-4">
          <CardHeader>
            <CardTitle>{title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <div className="relative flex items-center">
                <Input
                  value={value}
                  onChange={(e) => handleAddChange(e.target.value)}
                  placeholder={placeHolder[listName]}
                  maxLength={MAX_ITEM_LENGTH}
                  required
                  aria-label={placeHolder[listName]}
                />
                <Button
                  type="submit"
                  disabled={!value.trim() || loading}
                  className="absolute right-0 top-0 h-full px-3 rounded-l-none"
                  variant="ghost"
                  size="icon"
                  aria-label={`Add to ${listName}`}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {addError && (
                <p role="alert" className="text-sm text-destructive">
                  {addError}
                </p>
              )}
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {spellingData.map((data, index) =>
                  editingIndex === index ? (
                    <div key={index} className="flex flex-col gap-2 p-2 bg-card border border-border rounded-lg">
                      <div className="flex items-center gap-2">
                        <Input
                          value={editValue}
                          onChange={(e) => handleEditChange(e.target.value)}
                          onKeyDown={(e) => handleEditKeyDown(e, index)}
                          maxLength={MAX_ITEM_LENGTH}
                          aria-label={`Edit ${listName} ${index + 1}`}
                          ref={(el) => el?.focus()}
                          className="h-9"
                        />
                        <Button
                          type="button"
                          onClick={() => saveEdit(index)}
                          variant="ghost"
                          size="sm"
                          disabled={loading}
                          aria-label={`Save "${data}"`}
                          className="shrink-0 text-primary hover:text-primary"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          onClick={cancelEditing}
                          variant="ghost"
                          size="sm"
                          aria-label="Cancel editing"
                          className="shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      {editError && (
                        <p role="alert" className="text-sm text-destructive">
                          {editError}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div
                      key={index}
                      className="group flex items-center justify-between p-2 bg-card border border-border rounded-lg hover:bg-accent/50 transition-colors duration-200"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex items-center justify-center w-6 h-6 bg-primary/10 rounded-full shrink-0">
                          <span className="text-xs font-medium text-primary">{index + 1}</span>
                        </div>
                        <span className="text-sm font-medium text-foreground truncate">{data}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          type="button"
                          onClick={() => startEditing(index)}
                          variant="ghost"
                          size="sm"
                          disabled={loading}
                          aria-label={`Edit "${data}"`}
                          className={actionButtonClass}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          onClick={() => removeItem(index)}
                          variant="ghost"
                          size="sm"
                          disabled={loading}
                          aria-label={`Remove "${data}"`}
                          className={`${actionButtonClass} text-destructive hover:text-destructive hover:bg-destructive/10`}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  )
                )}
                {spellingData.length === 0 && (
                  <div className="text-center py-6 text-sm text-muted-foreground border border-dashed border-border rounded-lg">
                    No {listName} in your collection yet. Add your first one above.
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </div>
      </form>
    </Card>
  )
}
