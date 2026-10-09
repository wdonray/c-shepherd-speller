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

  it('picks an emoji from the curated grid', () => {
    const props = renderPicker()
    fireEvent.click(screen.getByRole('button', { name: 'Keyword image for pattern ee' }))
    fireEvent.click(screen.getByRole('button', { name: 'Bee' }))
    expect(props.onEmojiSelect).toHaveBeenCalledWith('🐝')
  })

  it('accepts a custom emoji', () => {
    const props = renderPicker()
    fireEvent.click(screen.getByRole('button', { name: 'Keyword image for pattern ee' }))
    fireEvent.change(screen.getByLabelText('Custom keyword emoji'), { target: { value: '🦄' } })
    fireEvent.click(screen.getByRole('button', { name: 'Use emoji' }))
    expect(props.onEmojiSelect).toHaveBeenCalledWith('🦄')
  })

  it('uploads a photo and selects the processed data URL', async () => {
    const { processKeywordImage } = await import('@/lib/profile-image')
    vi.mocked(processKeywordImage).mockResolvedValue('data:image/jpeg;base64,thumb')
    const props = renderPicker()
    fireEvent.click(screen.getByRole('button', { name: 'Keyword image for pattern ee' }))
    const file = new File(['x'], 'bee.jpg', { type: 'image/jpeg' })
    fireEvent.change(screen.getByLabelText('Upload photo'), { target: { files: [file] } })
    await waitFor(() => {
      expect(processKeywordImage).toHaveBeenCalledWith(file)
      expect(props.onImageSelect).toHaveBeenCalledWith('data:image/jpeg;base64,thumb')
    })
  })

  it('surfaces the real upload error instead of a generic message', async () => {
    const { processKeywordImage } = await import('@/lib/profile-image')
    vi.mocked(processKeywordImage).mockRejectedValue(new Error('Please choose a JPEG, PNG, WebP, or HEIC image.'))
    renderPicker()
    fireEvent.click(screen.getByRole('button', { name: 'Keyword image for pattern ee' }))
    const file = new File(['x'], 'bee.tiff', { type: 'image/tiff' })
    fireEvent.change(screen.getByLabelText('Upload photo'), { target: { files: [file] } })
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Please choose a JPEG, PNG, WebP, or HEIC image.')
    })
  })

  it('removes the photo, falling back to the emoji', () => {
    const props = renderPicker({ image: 'data:image/jpeg;base64,photo', emoji: '🐝' })
    fireEvent.click(screen.getByRole('button', { name: 'Keyword image for pattern ee' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove photo' }))
    expect(props.onImageSelect).toHaveBeenCalledWith(undefined)
  })

  it('removes the emoji', () => {
    const props = renderPicker({ emoji: '🐝' })
    fireEvent.click(screen.getByRole('button', { name: 'Keyword image for pattern ee' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove emoji' }))
    expect(props.onEmojiSelect).toHaveBeenCalledWith(undefined)
  })

  it('applies a custom emoji with the Enter key', () => {
    const props = renderPicker()
    fireEvent.click(screen.getByRole('button', { name: 'Keyword image for pattern ee' }))
    fireEvent.change(screen.getByLabelText('Custom keyword emoji'), { target: { value: '🦄' } })
    fireEvent.keyDown(screen.getByLabelText('Custom keyword emoji'), { key: 'Enter' })
    expect(props.onEmojiSelect).toHaveBeenCalledWith('🦄')
  })

  it('ignores non-Enter keys in the custom emoji input', () => {
    const props = renderPicker()
    fireEvent.click(screen.getByRole('button', { name: 'Keyword image for pattern ee' }))
    fireEvent.change(screen.getByLabelText('Custom keyword emoji'), { target: { value: '🦄' } })
    fireEvent.keyDown(screen.getByLabelText('Custom keyword emoji'), { key: 'a' })
    expect(props.onEmojiSelect).not.toHaveBeenCalled()
  })

  it('ignores an empty custom emoji', () => {
    const props = renderPicker()
    fireEvent.click(screen.getByRole('button', { name: 'Keyword image for pattern ee' }))
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
    fireEvent.click(screen.getByRole('button', { name: 'Keyword image for pattern ee' }))
    fireEvent.change(screen.getByLabelText('Upload photo'), { target: { files: [] } })
    expect(processKeywordImage).not.toHaveBeenCalled()
    expect(props.onImageSelect).not.toHaveBeenCalled()
  })

  it('falls back to a generic message when the upload error has no message', async () => {
    const { processKeywordImage } = await import('@/lib/profile-image')
    vi.mocked(processKeywordImage).mockRejectedValue('boom')
    renderPicker()
    fireEvent.click(screen.getByRole('button', { name: 'Keyword image for pattern ee' }))
    fireEvent.change(screen.getByLabelText('Upload photo'), {
      target: { files: [new File(['x'], 'bee.jpg', { type: 'image/jpeg' })] },
    })
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Could not use that photo. Please try another.')
    })
  })

  it('closes on Escape', () => {
    renderPicker()
    fireEvent.click(screen.getByRole('button', { name: 'Keyword image for pattern ee' }))
    expect(screen.getByRole('dialog', { name: 'Choose keyword image' })).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Choose keyword image' })).not.toBeInTheDocument()
  })

  it('closes when the scrim is clicked', () => {
    renderPicker()
    fireEvent.click(screen.getByRole('button', { name: 'Keyword image for pattern ee' }))
    fireEvent.pointerDown(screen.getByTestId('keyword-image-scrim'))
    expect(screen.queryByRole('dialog', { name: 'Choose keyword image' })).not.toBeInTheDocument()
  })
})
