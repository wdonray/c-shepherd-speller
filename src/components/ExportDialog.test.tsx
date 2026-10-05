import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import ExportDialog from './ExportDialog'

describe('ExportDialog', () => {
  it('renders nothing visible when closed', () => {
    render(<ExportDialog isOpen={false} onClose={vi.fn()} onExport={vi.fn()} />)
    expect(screen.queryByText('Save Your Spelling Collection')).not.toBeInTheDocument()
  })

  it('generates a default filename with the current date when opened', () => {
    render(<ExportDialog isOpen onClose={vi.fn()} onExport={vi.fn()} />)
    const input = screen.getByPlaceholderText('My spelling collection...') as HTMLInputElement
    expect(input.value).toMatch(/^spelling-data-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.json$/)
  })

  it('calls onExport with the trimmed filename and onClose when saving', () => {
    const onExport = vi.fn()
    const onClose = vi.fn()
    render(<ExportDialog isOpen onClose={onClose} onExport={onExport} />)

    const input = screen.getByPlaceholderText('My spelling collection...')
    fireEvent.change(input, { target: { value: '  my-lists  ' } })
    fireEvent.click(screen.getByRole('button', { name: /save file/i }))

    expect(onExport).toHaveBeenCalledWith('my-lists')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('exports via the Enter key', () => {
    const onExport = vi.fn()
    render(<ExportDialog isOpen onClose={vi.fn()} onExport={onExport} />)

    const input = screen.getByPlaceholderText('My spelling collection...')
    fireEvent.change(input, { target: { value: 'lists.json' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onExport).toHaveBeenCalledWith('lists.json')
  })

  it('ignores non-Enter keys', () => {
    const onExport = vi.fn()
    render(<ExportDialog isOpen onClose={vi.fn()} onExport={onExport} />)

    const input = screen.getByPlaceholderText('My spelling collection...')
    fireEvent.keyDown(input, { key: 'Escape' })

    expect(onExport).not.toHaveBeenCalled()
  })

  it('does not export when the filename is blank', () => {
    const onExport = vi.fn()
    const onClose = vi.fn()
    render(<ExportDialog isOpen onClose={onClose} onExport={onExport} />)

    const input = screen.getByPlaceholderText('My spelling collection...')
    fireEvent.change(input, { target: { value: '   ' } })

    const saveButton = screen.getByRole('button', { name: /save file/i })
    expect(saveButton).toBeDisabled()

    // Enter bypasses the disabled button and hits the guard in handleExport.
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onExport).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn()
    render(<ExportDialog isOpen onClose={onClose} onExport={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
