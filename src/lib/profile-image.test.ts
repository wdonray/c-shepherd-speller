import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  processProfileImage,
  PROFILE_IMAGE_MAX_DATA_URL_LENGTH,
  PROFILE_IMAGE_MAX_DIMENSION,
  PROFILE_IMAGE_MAX_FILE_BYTES,
} from './profile-image'

function makeFile(type: string, size: number): File {
  return new File([new Uint8Array(size)], 'photo.png', { type })
}

describe('processProfileImage', () => {
  let toDataURL: ReturnType<typeof vi.fn>
  let drawImage: ReturnType<typeof vi.fn>
  let imageWidth = 800
  let imageHeight = 600
  let imageShouldFail = false
  let contextShouldFail = false

  beforeEach(() => {
    imageWidth = 800
    imageHeight = 600
    imageShouldFail = false
    contextShouldFail = false
    toDataURL = vi.fn().mockReturnValue('data:image/jpeg;base64,small')
    drawImage = vi.fn()

    vi.stubGlobal(
      'Image',
      class {
        onload: (() => void) | null = null
        onerror: (() => void) | null = null
        src = ''
        width = imageWidth
        height = imageHeight
        constructor() {
          queueMicrotask(() => {
            if (imageShouldFail) this.onerror?.()
            else this.onload?.()
          })
        }
      }
    )

    const createElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation(((tagName: string, options?: unknown) => {
      if (tagName === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: () => (contextShouldFail ? null : { drawImage }),
          toDataURL,
        } as unknown as HTMLCanvasElement
      }
      return createElement(tagName, options)
    }) as typeof document.createElement)

    vi.stubGlobal('URL', {
      createObjectURL: vi.fn().mockReturnValue('blob:fake'),
      revokeObjectURL: vi.fn(),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('resizes a large image to the max dimension and returns a data URL', async () => {
    const dataUrl = await processProfileImage(makeFile('image/png', 1000))
    expect(dataUrl).toBe('data:image/jpeg;base64,small')
    expect(drawImage).toHaveBeenCalledTimes(1)
    // 800x600 scaled to fit within 256 on the long edge.
    const [, , , width, height] = drawImage.mock.calls[0]
    expect(width).toBe(PROFILE_IMAGE_MAX_DIMENSION)
    expect(height).toBe(192)
  })

  it('does not upscale small images', async () => {
    imageWidth = 100
    imageHeight = 80
    await processProfileImage(makeFile('image/jpeg', 1000))
    const [, , , width, height] = drawImage.mock.calls[0]
    expect(width).toBe(100)
    expect(height).toBe(80)
  })

  it('rejects non-image files', async () => {
    await expect(processProfileImage(makeFile('text/plain', 100))).rejects.toThrow(
      'Please choose a JPEG, PNG, or WebP image.'
    )
  })

  it('rejects files over 5MB', async () => {
    await expect(processProfileImage(makeFile('image/png', PROFILE_IMAGE_MAX_FILE_BYTES + 1))).rejects.toThrow(
      'Please choose an image smaller than 5MB.'
    )
  })

  it('rejects when the image cannot be decoded', async () => {
    imageShouldFail = true
    await expect(processProfileImage(makeFile('image/png', 100))).rejects.toThrow('Could not read the image file.')
  })

  it('rejects when the canvas 2d context is unavailable', async () => {
    contextShouldFail = true
    await expect(processProfileImage(makeFile('image/png', 100))).rejects.toThrow('Could not read the image file.')
  })

  it('steps down quality until the data URL fits', async () => {
    const big = 'data:image/jpeg;base64,' + 'a'.repeat(PROFILE_IMAGE_MAX_DATA_URL_LENGTH)
    toDataURL.mockReturnValueOnce(big).mockReturnValueOnce(big).mockReturnValueOnce('data:image/jpeg;base64,small')
    const dataUrl = await processProfileImage(makeFile('image/png', 1000))
    expect(dataUrl).toBe('data:image/jpeg;base64,small')
    expect(toDataURL).toHaveBeenCalledTimes(3)
    expect(toDataURL.mock.calls[0][1]).toBe(0.82)
    expect(toDataURL.mock.calls[1][1]).toBe(0.7)
    expect(toDataURL.mock.calls[2][1]).toBe(0.6)
  })

  it('rejects when even the lowest quality is too large', async () => {
    const big = 'data:image/jpeg;base64,' + 'a'.repeat(PROFILE_IMAGE_MAX_DATA_URL_LENGTH + 1)
    toDataURL.mockReturnValue(big)
    await expect(processProfileImage(makeFile('image/png', 1000))).rejects.toThrow(
      'That image is too detailed to shrink down. Please try a smaller one.'
    )
  })

  it('revokes the object URL after processing', async () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL')
    await processProfileImage(makeFile('image/png', 1000))
    expect(revoke).toHaveBeenCalledWith('blob:fake')
  })

  it('revokes the object URL when processing fails', async () => {
    imageShouldFail = true
    const revoke = vi.spyOn(URL, 'revokeObjectURL')
    await expect(processProfileImage(makeFile('image/png', 100))).rejects.toThrow()
    expect(revoke).toHaveBeenCalledWith('blob:fake')
  })
})
