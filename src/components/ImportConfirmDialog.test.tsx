import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import ImportConfirmDialog from './ImportConfirmDialog'

function renderDialog(count: number) {
  const onClose = vi.fn()
  const onExport = vi.fn()
  const onProceed = vi.fn()
  render(
    <ImportConfirmDialog isOpen onClose={onClose} onExport={onExport} onProceed={onProceed} existingDataCount={count} />
  )
  return { onClose, onExport, onProceed }
}

describe('ImportConfirmDialog', () => {
  it('renders nothing visible when closed', () => {
    render(
      <ImportConfirmDialog
        isOpen={false}
        onClose={vi.fn()}
        onExport={vi.fn()}
        onProceed={vi.fn()}
        existingDataCount={3}
      />
    )
    expect(screen.queryByText('Add New Spelling Collection')).not.toBeInTheDocument()
  })

  it('shows the existing item count with plural wording', () => {
    renderDialog(3)
    expect(screen.getByText('Add New Spelling Collection')).toBeInTheDocument()
    expect(screen.getByText(/You currently have 3 items/)).toBeInTheDocument()
  })

  it('uses singular wording for one item', () => {
    renderDialog(1)
    expect(screen.getByText(/You currently have 1 item in/)).toBeInTheDocument()
  })

  it('calls onClose when Cancel is clicked', () => {
    const { onClose, onExport, onProceed } = renderDialog(2)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onExport).not.toHaveBeenCalled()
    expect(onProceed).not.toHaveBeenCalled()
  })

  it('calls onExport when saving the current collection', () => {
    const { onExport } = renderDialog(2)
    fireEvent.click(screen.getByRole('button', { name: /save current collection/i }))
    expect(onExport).toHaveBeenCalledTimes(1)
  })

  it('calls onProceed when adding the new collection', () => {
    const { onProceed } = renderDialog(2)
    fireEvent.click(screen.getByRole('button', { name: /add new collection/i }))
    expect(onProceed).toHaveBeenCalledTimes(1)
  })
})
