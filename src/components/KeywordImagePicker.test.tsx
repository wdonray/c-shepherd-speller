import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import KeywordImagePicker from './KeywordImagePicker'

vi.mock('@/lib/profile-image', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/profile-image')>()
  return {
    ...original,
    processKeywordImage: vi.fn(),
  }
})

const baseProps = {
  patternName: 'ee',
  image: undefined as string | undefined,
  emoji: undefined as string | undefined,
  onImageSelect: vi.fn(),
  onEmojiSelect: vi.fn(),
}

function renderPicker(overrides: Partial<typeof baseProps> = {}) {
  const props = { ...baseProps, onImageSelect: vi.fn(), onEmojiSelect: vi.fn(), ...overrides }
  render(<KeywordImagePicker {...props} />)
  return props
}

function openDialog() {
  fireEvent.click(screen.getByRole('button', { name: 'Keyword image for pattern ee' }))
  return screen.getByRole('dialog', { name: 'Choose keyword image' })
}

describe('KeywordImagePicker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows an Add placeholder when no image or emoji is set', () => {
    renderPicker()
    expect(screen.getByRole('button', { name: 'Keyword image for pattern ee' })).toHaveTextContent('Add')
  })

  it('shows the uploaded photo in the trigger when set', () => {
    renderPicker({ image: 'data:image/jpeg;base64,photo' })
    const img = screen.getByRole('button', { name: 'Keyword image for pattern ee' }).querySelector('img')
    expect(img).toHaveAttribute('src', 'data:image/jpeg;base64,photo')
  })

  it('shows the emoji in the trigger when no photo is set', () => {
    renderPicker({ emoji: '🐝' })
    expect(screen.getByRole('button', { name: 'Keyword image for pattern ee' })).toHaveTextContent('🐝')
  })

  it('opens a centered dialog constrained to the viewport', () => {
    renderPicker()
    const dialog = openDialog()
    expect(dialog.parentElement).toBe(document.body)
    expect(dialog).toHaveClass('max-h-[85dvh]', 'overflow-y-auto')
  })

  it('picks an emoji from the curated grid and closes the dialog', () => {
    const props = renderPicker()
    openDialog()
    fireEvent.click(screen.getByRole('button', { name: 'Bee' }))
    expect(props.onEmojiSelect).toHaveBeenCalledWith('🐝')
    expect(screen.queryByRole('dialog', { name: 'Choose keyword image' })).not.toBeInTheDocument()
  })

  it('accepts a custom emoji', () => {
    const props = renderPicker()
    openDialog()
    fireEvent.change(screen.getByLabelText('Custom keyword emoji'), { target: { value: '🦄' } })
    fireEvent.click(screen.getByRole('button', { name: 'Use emoji' }))
    expect(props.onEmojiSelect).toHaveBeenCalledWith('🦄')
  })

  it('uploads a photo, selects the processed data URL, and closes the dialog', async () => {
    const { processKeywordImage } = await import('@/lib/profile-image')
    vi.mocked(processKeywordImage).mockResolvedValue('data:image/jpeg;base64,thumb')
    const props = renderPicker()
    openDialog()
    const file = new File(['x'], 'bee.jpg', { type: 'image/jpeg' })
    fireEvent.change(screen.getByLabelText('Upload photo'), { target: { files: [file] } })
    await waitFor(() => {
      expect(processKeywordImage).toHaveBeenCalledWith(file)
      expect(props.onImageSelect).toHaveBeenCalledWith('data:image/jpeg;base64,thumb')
      expect(screen.queryByRole('dialog', { name: 'Choose keyword image' })).not.toBeInTheDocument()
    })
  })

  it('surfaces the real upload error instead of a generic message', async () => {
    const { processKeywordImage } = await import('@/lib/profile-image')
    vi.mocked(processKeywordImage).mockRejectedValue(new Error('Please choose a JPEG, PNG, WebP, or HEIC image.'))
    renderPicker()
    openDialog()
    const file = new File(['x'], 'bee.tiff', { type: 'image/tiff' })
    fireEvent.change(screen.getByLabelText('Upload photo'), { target: { files: [file] } })
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Please choose a JPEG, PNG, WebP, or HEIC image.')
    })
    // The dialog stays open so the teacher can try another photo.
    expect(screen.getByRole('dialog', { name: 'Choose keyword image' })).toBeInTheDocument()
  })

  it('removes the photo, falling back to the emoji', () => {
    const props = renderPicker({ image: 'data:image/jpeg;base64,photo', emoji: '🐝' })
    openDialog()
    fireEvent.click(screen.getByRole('button', { name: 'Remove photo' }))
    expect(props.onImageSelect).toHaveBeenCalledWith(undefined)
    expect(screen.queryByRole('dialog', { name: 'Choose keyword image' })).not.toBeInTheDocument()
  })

  it('removes the emoji', () => {
    const props = renderPicker({ emoji: '🐝' })
    openDialog()
    fireEvent.click(screen.getByRole('button', { name: 'Remove emoji' }))
    expect(props.onEmojiSelect).toHaveBeenCalledWith(undefined)
    expect(screen.queryByRole('dialog', { name: 'Choose keyword image' })).not.toBeInTheDocument()
  })

  it('applies a custom emoji with the Enter key', () => {
    const props = renderPicker()
    openDialog()
    fireEvent.change(screen.getByLabelText('Custom keyword emoji'), { target: { value: '🦄' } })
    fireEvent.keyDown(screen.getByLabelText('Custom keyword emoji'), { key: 'Enter' })
    expect(props.onEmojiSelect).toHaveBeenCalledWith('🦄')
  })

  it('ignores non-Enter keys in the custom emoji input', () => {
    const props = renderPicker()
    openDialog()
    fireEvent.change(screen.getByLabelText('Custom keyword emoji'), { target: { value: '🦄' } })
    fireEvent.keyDown(screen.getByLabelText('Custom keyword emoji'), { key: 'a' })
    expect(props.onEmojiSelect).not.toHaveBeenCalled()
  })

  it('ignores an empty custom emoji', () => {
    const props = renderPicker()
    openDialog()
    fireEvent.change(screen.getByLabelText('Custom keyword emoji'), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Use emoji' }))
    expect(props.onEmojiSelect).not.toHaveBeenCalled()
  })

  it('labels the trigger generically when the pattern name is blank', () => {
    renderPicker({ patternName: '   ' })
    expect(screen.getByRole('button', { name: 'Keyword image for this pattern' })).toBeInTheDocument()
  })

  it('ignores a file selection with no file', async () => {
    const { processKeywordImage } = await import('@/lib/profile-image')
    const props = renderPicker()
    openDialog()
    fireEvent.change(screen.getByLabelText('Upload photo'), { target: { files: [] } })
    expect(processKeywordImage).not.toHaveBeenCalled()
    expect(props.onImageSelect).not.toHaveBeenCalled()
  })

  it('falls back to a generic message when the upload error has no message', async () => {
    const { processKeywordImage } = await import('@/lib/profile-image')
    vi.mocked(processKeywordImage).mockRejectedValue('boom')
    renderPicker()
    openDialog()
    fireEvent.change(screen.getByLabelText('Upload photo'), {
      target: { files: [new File(['x'], 'bee.jpg', { type: 'image/jpeg' })] },
    })
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Could not use that photo. Please try another.')
    })
  })

  it('closes on Escape', () => {
    renderPicker()
    openDialog()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Choose keyword image' })).not.toBeInTheDocument()
  })

  it('closes when the overlay is clicked', async () => {
    renderPicker()
    openDialog()
    // Radix attaches its document pointerdown listener on a timer tick and
    // defers the outside-pointerdown close until the matching click lands.
    await new Promise((resolve) => setTimeout(resolve, 0))
    const overlay = document.querySelector('[data-slot="dialog-overlay"]')
    expect(overlay).not.toBeNull()
    fireEvent.pointerDown(overlay!)
    fireEvent.click(overlay!)
    expect(screen.queryByRole('dialog', { name: 'Choose keyword image' })).not.toBeInTheDocument()
  })

  it('closes with the close button', () => {
    renderPicker()
    openDialog()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog', { name: 'Choose keyword image' })).not.toBeInTheDocument()
  })

  it('returns focus to the trigger when the dialog closes', async () => {
    renderPicker()
    const trigger = screen.getByRole('button', { name: 'Keyword image for pattern ee' })
    openDialog()
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })
})
