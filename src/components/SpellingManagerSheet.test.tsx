import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import SpellingManagerSheet from './SpellingManagerSheet'
import { exportSpellingData, importSpellingData } from '@/lib/spelling-utils'

const api = vi.hoisted(() => ({
  getUserByEmail: vi.fn(),
  getSpelling: vi.fn(),
  addWord: vi.fn(),
  addSound: vi.fn(),
  addSpelling: vi.fn(),
  updateItem: vi.fn(),
  removeItem: vi.fn(),
  updateLastActive: vi.fn(),
  saveSpellingData: vi.fn(),
}))

vi.mock('next-auth/react', () => ({ useSession: vi.fn() }))
vi.mock('@/lib/spelling-api', () => api)
vi.mock('@/lib/spelling-utils', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/spelling-utils')>()
  return { ...mod, exportSpellingData: vi.fn(), importSpellingData: vi.fn() }
})

const exportMock = vi.mocked(exportSpellingData)
const importMock = vi.mocked(importSpellingData)
const useSessionMock = vi.mocked(useSession)

const emptyData = { words: [] as string[], sounds: [] as string[], spelling: [] as string[] }

function mockSession(email?: string) {
  useSessionMock.mockReturnValue({
    data: { user: email ? { email } : {} },
    status: 'authenticated',
    update: async () => null,
  } as never)
}

function renderSheet(isOpen = true) {
  mockSession('t@e.c')
  return render(<SpellingManagerSheet isOpen={isOpen} setIsOpen={vi.fn()} />)
}

function selectFile(input: HTMLInputElement, name: string) {
  const file = new File(['{}'], name, { type: 'application/json' })
  fireEvent.change(input, { target: { files: [file] } })
}

describe('SpellingManagerSheet', () => {
  beforeEach(() => {
    useSessionMock.mockReset()
    exportMock.mockReset()
    importMock.mockReset()
    Object.values(api).forEach((fn) => fn.mockReset())
    api.getUserByEmail.mockResolvedValue({ id: 'u1', email: 't@e.c', name: 'Teacher' })
    api.getSpelling.mockResolvedValue({ ...emptyData })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders nothing when closed', () => {
    renderSheet(false)
    expect(screen.queryByText('Spelling Collection')).not.toBeInTheDocument()
  })

  it('loads the user and spelling data when opened', async () => {
    api.getSpelling.mockResolvedValue({ words: ['cat'], sounds: [], spelling: [] })
    renderSheet()

    await waitFor(() => {
      expect(api.getUserByEmail).toHaveBeenCalledWith('t@e.c')
      expect(api.getSpelling).toHaveBeenCalledWith('u1')
      expect(api.updateLastActive).toHaveBeenCalledWith('u1')
    })
    expect(await screen.findByText('Spelling Collection')).toBeInTheDocument()
    expect(screen.getByText('cat')).toBeInTheDocument()
  })

  it('does not fetch when there is no session email', () => {
    mockSession(undefined)
    render(<SpellingManagerSheet isOpen setIsOpen={vi.fn()} />)
    expect(api.getUserByEmail).not.toHaveBeenCalled()
  })

  it('keeps the loading state when the user is not found', async () => {
    api.getUserByEmail.mockResolvedValue(null)
    renderSheet()

    await waitFor(() => {
      expect(screen.getByText('Loading your spelling collection...')).toBeInTheDocument()
    })
    expect(api.getSpelling).not.toHaveBeenCalled()
  })

  it('adds a word through the API and the list', async () => {
    api.getSpelling.mockResolvedValue({ words: ['cat'], sounds: [], spelling: [] })
    renderSheet()
    await screen.findByText('cat')

    const input = screen.getByPlaceholderText('Add a new word to your list')
    fireEvent.change(input, { target: { value: 'dog' } })
    fireEvent.submit(input.closest('form') as HTMLFormElement)

    await waitFor(() => {
      expect(api.addWord).toHaveBeenCalledWith('u1', 'dog', ['cat'])
      expect(api.updateLastActive).toHaveBeenCalledWith('u1')
    })
    expect(screen.getByText('dog')).toBeInTheDocument()
  })

  it('ignores a blank word submit', async () => {
    renderSheet()
    await waitFor(() => expect(api.getUserByEmail).toHaveBeenCalled())

    const input = screen.getByPlaceholderText('Add a new word to your list')
    fireEvent.submit(input.closest('form') as HTMLFormElement)

    await waitFor(() => expect(api.updateLastActive).toHaveBeenCalled())
    expect(api.addWord).not.toHaveBeenCalled()
  })

  it('adds a sound through the API', async () => {
    renderSheet()
    await waitFor(() => expect(api.getUserByEmail).toHaveBeenCalled())

    const input = screen.getByPlaceholderText('Add a new sound pattern')
    fireEvent.change(input, { target: { value: 'sh' } })
    fireEvent.submit(input.closest('form') as HTMLFormElement)

    await waitFor(() => {
      expect(api.addSound).toHaveBeenCalledWith('u1', 'sh', [])
    })
  })

  it('adds a spelling pattern through the API and the list', async () => {
    api.getSpelling.mockResolvedValue({ words: [], sounds: [], spelling: ['tion'] })
    renderSheet()
    await screen.findByText('tion')

    const input = screen.getByPlaceholderText('Add a new spelling rule')
    fireEvent.change(input, { target: { value: 'ight' } })
    fireEvent.submit(input.closest('form') as HTMLFormElement)

    await waitFor(() => {
      expect(api.addSpelling).toHaveBeenCalledWith('u1', 'ight', ['tion'])
      expect(api.updateLastActive).toHaveBeenCalledWith('u1')
    })
    expect(screen.getByText('ight')).toBeInTheDocument()
  })

  it('ignores a blank spelling submit', async () => {
    renderSheet()
    await waitFor(() => expect(api.getUserByEmail).toHaveBeenCalled())

    const input = screen.getByPlaceholderText('Add a new spelling rule')
    fireEvent.submit(input.closest('form') as HTMLFormElement)

    await waitFor(() => expect(api.updateLastActive).toHaveBeenCalled())
    expect(api.addSpelling).not.toHaveBeenCalled()
  })

  it('removes an item through the API', async () => {
    api.getSpelling.mockResolvedValue({ words: ['cat'], sounds: [], spelling: [] })
    renderSheet()
    await screen.findByText('cat')

    fireEvent.click(screen.getAllByText('Remove')[0])

    await waitFor(() => {
      expect(api.removeItem).toHaveBeenCalledWith('u1', 'words', 0, ['cat'])
      expect(api.updateLastActive).toHaveBeenCalledWith('u1')
    })
  })

  it('updates an item through the API', async () => {
    api.getSpelling.mockResolvedValue({ words: ['cat', 'dog'], sounds: [], spelling: [] })
    renderSheet()
    await screen.findByText('cat')

    fireEvent.click(screen.getByRole('button', { name: 'Edit "cat"' }))
    fireEvent.change(screen.getByLabelText('Edit words 1'), { target: { value: 'bat' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save "cat"' }))

    await waitFor(() => {
      expect(api.updateItem).toHaveBeenCalledWith('u1', 'words', 0, 'bat', ['cat', 'dog'])
      expect(api.updateLastActive).toHaveBeenCalledWith('u1')
    })
    await waitFor(() => expect(screen.getByText('bat')).toBeInTheDocument())
  })

  describe('import', () => {
    it('shows the confirm dialog when data exists and proceeds to file selection', async () => {
      api.getSpelling.mockResolvedValue({ words: ['cat'], sounds: [], spelling: [] })
      const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {})
      renderSheet()
      await screen.findByText('cat')

      fireEvent.click(screen.getByRole('button', { name: 'Import' }))

      expect(screen.getByText('Add New Spelling Collection')).toBeInTheDocument()
      expect(screen.getByText(/1 item in your spelling collection/)).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: /add new collection/i }))
      expect(clickSpy).toHaveBeenCalledTimes(1)
      expect(screen.queryByText('Add New Spelling Collection')).not.toBeInTheDocument()
    })

    it('exports the current collection from the confirm dialog', async () => {
      api.getSpelling.mockResolvedValue({ words: ['cat'], sounds: [], spelling: [] })
      renderSheet()
      await screen.findByText('cat')

      fireEvent.click(screen.getByRole('button', { name: 'Import' }))
      fireEvent.click(screen.getByRole('button', { name: /save current collection/i }))

      expect(exportMock).toHaveBeenCalledTimes(1)
      expect(exportMock).toHaveBeenCalledWith(
        expect.objectContaining({ words: ['cat'] }),
        expect.stringMatching(/^spelling-data-\d{4}-\d{2}-\d{2}-.*\.json$/)
      )
      expect(screen.queryByText('Add New Spelling Collection')).not.toBeInTheDocument()
    })

    it('closes the confirm dialog on cancel', async () => {
      api.getSpelling.mockResolvedValue({ words: ['cat'], sounds: [], spelling: [] })
      renderSheet()
      await screen.findByText('cat')

      fireEvent.click(screen.getByRole('button', { name: 'Import' }))
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

      expect(screen.queryByText('Add New Spelling Collection')).not.toBeInTheDocument()
    })

    it('opens the file picker directly when there is no data', async () => {
      const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {})
      renderSheet()
      await waitFor(() => expect(api.getUserByEmail).toHaveBeenCalled())

      fireEvent.click(screen.getByRole('button', { name: 'Import' }))

      expect(clickSpy).toHaveBeenCalledTimes(1)
      expect(screen.queryByText('Add New Spelling Collection')).not.toBeInTheDocument()
    })

    it('imports a selected file and saves it', async () => {
      const imported = { words: ['zebra'], sounds: [], spelling: [] }
      importMock.mockResolvedValue(imported)
      const { container } = renderSheet()
      await waitFor(() => expect(api.getUserByEmail).toHaveBeenCalled())

      selectFile(container.querySelector('input[type="file"]') as HTMLInputElement, 'x.json')

      await waitFor(() => {
        expect(importMock).toHaveBeenCalledTimes(1)
        expect(api.saveSpellingData).toHaveBeenCalledWith('u1', imported)
        expect(api.updateLastActive).toHaveBeenCalledWith('u1')
      })
      expect(screen.getByText('zebra')).toBeInTheDocument()
    })

    it('shows an inline error and logs when the import fails', async () => {
      const error = new Error('bad file')
      importMock.mockRejectedValue(error)
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { container } = renderSheet()
      await waitFor(() => expect(api.getUserByEmail).toHaveBeenCalled())

      selectFile(container.querySelector('input[type="file"]') as HTMLInputElement, 'x.json')

      await waitFor(() => {
        expect(
          screen.getByText('Could not import that file. Make sure it is a JSON export from Shepherd Speller.')
        ).toBeInTheDocument()
        expect(consoleSpy).toHaveBeenCalledWith(error)
      })
      expect(api.saveSpellingData).not.toHaveBeenCalled()
    })

    it('dismisses the import error', async () => {
      importMock.mockRejectedValue(new Error('bad file'))
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const { container } = renderSheet()
      await waitFor(() => expect(api.getUserByEmail).toHaveBeenCalled())

      selectFile(container.querySelector('input[type="file"]') as HTMLInputElement, 'x.json')

      await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
      fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('ignores file selection with no file', async () => {
      const { container } = renderSheet()
      await waitFor(() => expect(api.getUserByEmail).toHaveBeenCalled())

      fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, {
        target: { files: [] },
      })

      expect(importMock).not.toHaveBeenCalled()
      expect(api.saveSpellingData).not.toHaveBeenCalled()
    })
  })

  describe('export', () => {
    it('disables the Export button when there is no data', async () => {
      renderSheet()
      await waitFor(() => expect(api.getUserByEmail).toHaveBeenCalled())

      expect(screen.getByRole('button', { name: 'Export' })).toBeDisabled()
    })

    it('opens the export dialog and exports with the chosen filename', async () => {
      api.getSpelling.mockResolvedValue({ words: ['cat'], sounds: [], spelling: [] })
      renderSheet()
      await screen.findByText('cat')

      fireEvent.click(screen.getByRole('button', { name: 'Export' }))
      expect(screen.getByText('Save Your Spelling Collection')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: /save file/i }))

      expect(exportMock).toHaveBeenCalledTimes(1)
      expect(exportMock).toHaveBeenCalledWith(
        expect.objectContaining({ words: ['cat'] }),
        expect.stringMatching(/^spelling-data-\d{4}-\d{2}-\d{2}-.*\.json$/)
      )
      expect(screen.queryByText('Save Your Spelling Collection')).not.toBeInTheDocument()
    })
  })

  describe('without a loaded user', () => {
    beforeEach(() => {
      useSessionMock.mockReturnValue({
        data: null,
        status: 'unauthenticated',
        update: async () => null,
      } as never)
    })

    it('ignores adding a sound when there is no user id', () => {
      render(<SpellingManagerSheet isOpen setIsOpen={vi.fn()} />)
      const input = screen.getByPlaceholderText('Add a new sound pattern')
      fireEvent.change(input, { target: { value: 'sh' } })
      fireEvent.submit(input.closest('form') as HTMLFormElement)
      expect(api.addSound).not.toHaveBeenCalled()
    })

    it('imports without saving to the server when there is no user id', async () => {
      importMock.mockResolvedValue({ words: ['cat'], sounds: [], spelling: [] })
      render(<SpellingManagerSheet isOpen setIsOpen={vi.fn()} />)

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      selectFile(fileInput, 'lists.json')

      await waitFor(() => {
        expect(importMock).toHaveBeenCalled()
      })
      expect(api.saveSpellingData).not.toHaveBeenCalled()
      expect(screen.getByText('cat')).toBeInTheDocument()
    })
  })
})
