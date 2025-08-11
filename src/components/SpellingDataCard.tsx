import { Input } from './ui/input'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { AlertCircle, Plus } from 'lucide-react'
import { Alert, AlertTitle } from './ui/alert'

interface SpellingDataCardProps {
  title: string
  value: string
  setValue: (value: string) => void
  addItem: () => void
  removeItem: (index: number) => void
  spellingData: string[]
  loading: boolean
}

export default function SpellingDataCard({
  title,
  value,
  setValue,
  addItem,
  removeItem,
  spellingData,
  loading,
}: SpellingDataCardProps) {
  const placeHolder: Record<string, string> = {
    words: 'Enter a word',
    sounds: 'Enter a sound',
    spelling: 'Enter a spelling',
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    addItem()
  }

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
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={placeHolder[title.toLowerCase()]}
                  required
                />
                <Button
                  type="submit"
                  disabled={!value.trim() || loading}
                  className="absolute right-0 top-0 h-full px-3 rounded-l-none"
                  variant="ghost"
                  size="icon"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {spellingData.map((data, index) => (
                  <div
                    key={index}
                    className="group flex items-center justify-between p-2 bg-card border border-border rounded-lg hover:bg-accent/50 transition-colors duration-200"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-6 h-6 bg-primary/10 rounded-full">
                        <span className="text-xs font-medium text-primary">{index + 1}</span>
                      </div>
                      <span className="text-sm font-medium text-foreground">{data}</span>
                    </div>
                    <Button
                      onClick={() => removeItem(index)}
                      variant="ghost"
                      size="sm"
                      disabled={loading}
                      className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10 transition-all duration-200"
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                {spellingData.length === 0 && (
                  <Alert variant="destructive" className="text-sm text-muted-foreground">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No {title.toLowerCase()} added</AlertTitle>
                  </Alert>
                )}
              </div>
            </div>
          </CardContent>
        </div>
      </form>
    </Card>
  )
}
