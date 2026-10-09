import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ImportExportDialog from './ImportExportDialog'
import { ErrorToaster } from './error-toaster'
import type { WordList } from '@/models/WordList'

const { getLists, createList } = vi.hoisted(() => ({
  getLists: vi.fn(),
  createList: vi.fn(),
}))
vi.mock('@/lib/lists-api', () => ({ getLists, createList }))

const list: WordList = {
  id: 'l1',
  userId: 'u1',
  name: 'Week 5: Long A',
  patterns: [],
  createdAt: '2026-10-06T00:00:00.000Z',
  updatedAt: '2026-10-06T00:00:00.000Z',
}

function renderDialog(props?: Partial<React.ComponentProps<typeof ImportExportDialog>>) {
  return render(
    <>
      <ImportExportDialog isOpen={true} onClose={vi.fn()} onImported={vi.fn()} {...props} />
      <ErrorToaster />
    </>
  )
}

describe('ImportExportDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // jsdom lacks URL.createObjectURL / revokeObjectURL.
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:mock'),
      revokeObjectURL: vi.fn(),
    })
  })

  it('renders the export and import sections', () => {
    renderDialog()
    expect(screen.getByRole('heading', { name: 'Import / export' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /export lists/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /choose file/i })).toBeInTheDocument()
  })

  it('opens the file picker when Choose file is clicked', () => {
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {})

    renderDialog()
    fireEvent.click(screen.getByRole('button', { name: /choose file/i }))

    expect(clickSpy).toHaveBeenCalled()
    clickSpy.mockRestore()
  })

  it('exports lists to a downloaded JSON file', async () => {
    getLists.mockResolvedValue([list])
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    renderDialog()
    fireEvent.click(screen.getByRole('button', { name: /export lists/i }))

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Exported 1 list.')
    })
    expect(getLists).toHaveBeenCalled()
    expect(clickSpy).toHaveBeenCalled()
    clickSpy.mockRestore()
  })

  it('names the downloaded file patternspell-lists-YYYY-MM-DD.json', async () => {
    getLists.mockResolvedValue([list])
    const anchors: HTMLAnchorElement[] = []
    const createElement = document.createElement.bind(document)
    const createSpy = vi.spyOn(document, 'createElement').mockImplementation(((
      tagName: string,
      options?: ElementCreationOptions
    ) => {
      const el = createElement(tagName as 'a', options)
      if (tagName === 'a') anchors.push(el as unknown as HTMLAnchorElement)
      return el
    }) as typeof document.createElement)
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    renderDialog()
    fireEvent.click(screen.getByRole('button', { name: /export lists/i }))

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Exported 1 list.')
    })
    expect(anchors).toHaveLength(1)
    expect(anchors[0].download).toMatch(/^patternspell-lists-\d{4}-\d{2}-\d{2}\.json$/)
    expect(anchors[0].download).not.toContain('shepherd')
    expect(anchors[0].download).not.toContain('shepard')
    createSpy.mockRestore()
  })

  it('uses the plural when exporting multiple lists', async () => {
    getLists.mockResolvedValue([list, { ...list, id: 'l2', name: 'Week 6' }])
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    renderDialog()
    fireEvent.click(screen.getByRole('button', { name: /export lists/i }))

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Exported 2 lists.')
    })
  })

  it('shows a toast when export fails', async () => {
    getLists.mockRejectedValue(new Error('network down'))
    renderDialog()
    fireEvent.click(screen.getByRole('button', { name: /export lists/i }))

    await waitFor(() => {
      expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument()
    })
  })

  it('imports lists from a valid file', async () => {
    const onImported = vi.fn()
    createList.mockResolvedValue(list)
    renderDialog({ onImported })

    const file = new File([JSON.stringify([{ name: 'Week 7: Long O', patterns: [] }])], 'lists.json', {
      type: 'application/json',
    })
    fireEvent.change(screen.getByLabelText(/choose a lists file/i), { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Imported 1 list.')
    })
    expect(createList).toHaveBeenCalledWith({ name: 'Week 7: Long O', patterns: [] })
    expect(onImported).toHaveBeenCalled()
    expect(screen.getByText('lists.json')).toBeInTheDocument()
  })

  it('uses the plural when importing multiple lists', async () => {
    createList.mockResolvedValue(list)
    renderDialog()

    const file = new File(
      [
        JSON.stringify([
          { name: 'Week 7: Long O', patterns: [] },
          { name: 'Week 8', patterns: [] },
        ]),
      ],
      'lists.json',
      { type: 'application/json' }
    )
    fireEvent.change(screen.getByLabelText(/choose a lists file/i), { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Imported 2 lists.')
    })
    expect(createList).toHaveBeenCalledTimes(2)
  })

  it('rejects a file that is not JSON', async () => {
    renderDialog()
    const file = new File(['not json{{{'], 'bad.json', { type: 'application/json' })
    fireEvent.change(screen.getByLabelText(/choose a lists file/i), { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('That file is not valid JSON.')
    })
    expect(createList).not.toHaveBeenCalled()
  })

  it('rejects JSON that is not a lists export', async () => {
    renderDialog()
    const file = new File([JSON.stringify({ hello: 'world' })], 'weird.json', {
      type: 'application/json',
    })
    fireEvent.change(screen.getByLabelText(/choose a lists file/i), { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('That file does not look like a PatternSpell export.')
    })
    expect(createList).not.toHaveBeenCalled()
  })

  it('shows a toast when creating an imported list fails', async () => {
    createList.mockRejectedValue(new Error('network down'))
    renderDialog()
    const file = new File([JSON.stringify([{ name: 'Week 7: Long O', patterns: [] }])], 'lists.json', {
      type: 'application/json',
    })
    fireEvent.change(screen.getByLabelText(/choose a lists file/i), { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument()
    })
  })

  it('does nothing when the file picker is cancelled', () => {
    renderDialog()
    fireEvent.change(screen.getByLabelText(/choose a lists file/i), { target: { files: [] } })
    expect(createList).not.toHaveBeenCalled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
