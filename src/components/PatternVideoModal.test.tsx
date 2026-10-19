import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import PatternVideoModal from './PatternVideoModal'
import type { PatternVideo, WordList } from '@/models/WordList'

const { getLists, updateList, notifyListsChanged } = vi.hoisted(() => ({
  getLists: vi.fn(),
  updateList: vi.fn(),
  notifyListsChanged: vi.fn(),
}))
vi.mock('@/lib/lists-api', () => ({ getLists, updateList, notifyListsChanged }))

const { reportError } = vi.hoisted(() => ({ reportError: vi.fn() }))
vi.mock('@/lib/report-error', () => ({ reportError }))

const curatedAi: PatternVideo = {
  videoId: 'GdmcWQCbqY8',
  title: 'When Two Vowels Go Walking | Jack Hartmann Vowel Teams Song | Vowels Song',
  channel: 'Jack Hartmann Kids Music Channel',
  source: 'curated',
}

const curatedEe: PatternVideo = {
  videoId: 'ZfbWOTCgRE0',
  title: 'The Vowel Teams Song  | The Long E Sound | Phonics Song',
  channel: 'Scratch Garden',
  source: 'curated',
}

const customVideo: PatternVideo = {
  videoId: 'dQw4w9WgXcQ',
  title: 'My classroom song',
  source: 'custom',
}

function renderEditable(
  overrides: {
    videos?: PatternVideo[]
    suggestionPattern?: string
    startPlayingId?: string
    onChange?: (videos: PatternVideo[]) => void
  } = {}
) {
  const onChange = overrides.onChange ?? vi.fn()
  render(
    <PatternVideoModal
      title="Song videos for pattern ai"
      videos={overrides.videos ?? [curatedAi]}
      onChange={onChange}
      suggestionPattern={overrides.suggestionPattern ?? 'ai'}
      startPlayingId={overrides.startPlayingId}
      onClose={vi.fn()}
    />
  )
  return { onChange }
}

function dialog() {
  return screen.getByRole('dialog', { name: 'Song videos for pattern ai' })
}

function attachedSection() {
  return within(screen.getByRole('region', { name: 'Attached videos' }))
}

function suggestionsSection() {
  return within(screen.getByRole('region', { name: 'Suggestions' }))
}

function searchSection() {
  return within(screen.getByRole('region', { name: 'Search videos' }))
}

function pasteSection() {
  return within(screen.getByRole('region', { name: 'Add a YouTube link' }))
}

describe('PatternVideoModal (editable)', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('lists attached videos with thumbnail, title, channel, play, and remove', () => {
    renderEditable({ videos: [curatedAi, customVideo] })
    const sectionEl = screen.getByRole('region', { name: 'Attached videos' })
    const section = within(sectionEl)
    expect(section.getByText('Attached videos (2)')).toBeInTheDocument()
    expect(section.getByText(curatedAi.title)).toBeInTheDocument()
    expect(section.getByText(curatedAi.channel!)).toBeInTheDocument()
    expect(section.getByText(customVideo.title)).toBeInTheDocument()
    expect(section.getByRole('button', { name: `Play ${curatedAi.title}` })).toBeInTheDocument()
    expect(section.getByRole('button', { name: `Remove ${curatedAi.title}` })).toBeInTheDocument()
    const thumbnails = sectionEl.querySelectorAll('img')
    expect(thumbnails).toHaveLength(2)
    expect(thumbnails[0]).toHaveAttribute('src', `https://i.ytimg.com/vi/${curatedAi.videoId}/hqdefault.jpg`)
  })

  it('shows an empty state when nothing is attached', () => {
    renderEditable({ videos: [], suggestionPattern: 'xyz' })
    expect(attachedSection().getByText(/No videos attached yet/)).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Suggestions' })).not.toBeInTheDocument()
  })

  it('removes an attached video', () => {
    const { onChange } = renderEditable({ videos: [curatedAi, customVideo] })
    fireEvent.click(attachedSection().getByRole('button', { name: `Remove ${curatedAi.title}` }))
    expect(onChange).toHaveBeenCalledWith([customVideo])
  })

  it('plays a video in the embedded player, and back unmounts it', () => {
    renderEditable()
    fireEvent.click(attachedSection().getByRole('button', { name: `Play ${curatedAi.title}` }))
    const frame = screen.getByTitle(curatedAi.title)
    expect(frame.tagName).toBe('IFRAME')
    expect(frame).toHaveAttribute(
      'src',
      `https://www.youtube-nocookie.com/embed/${curatedAi.videoId}?rel=0&cc_load_policy=1`
    )
    // The browse list is replaced by the player.
    expect(screen.queryByRole('region', { name: 'Attached videos' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Back to videos' }))
    expect(screen.queryByTitle(curatedAi.title)).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Attached videos' })).toBeInTheDocument()
  })

  it('shows the player without a channel line when the video has none', () => {
    renderEditable({ videos: [customVideo] })
    fireEvent.click(attachedSection().getByRole('button', { name: `Play ${customVideo.title}` }))
    expect(screen.getByTitle(customVideo.title)).toBeInTheDocument()
    expect(screen.queryByText(curatedAi.channel!)).not.toBeInTheDocument()
  })

  it('shows curated suggestions for the pattern with Add buttons', () => {
    const { onChange } = renderEditable({ videos: [], suggestionPattern: 'ee' })
    const section = suggestionsSection()
    // The bank title has a double space (verbatim); text queries match the
    // whitespace-collapsed DOM text, so match on a distinctive substring.
    expect(section.getByText(/The Vowel Teams Song/)).toBeInTheDocument()
    const addButton = section
      .getAllByRole('button', { name: /^Add / })
      .find((button) => button.getAttribute('aria-label')?.includes('Vowel Teams Song'))
    expect(addButton).toBeDefined()
    fireEvent.click(addButton!)
    expect(onChange).toHaveBeenCalledWith([{ ...curatedEe }])
  })

  it('excludes already-attached videos from suggestions', () => {
    // The ck bank entry is attached, so the suggestions section disappears.
    renderEditable({ videos: [{ ...curatedEe, videoId: 'qEgggBAF_nw', title: 'Digraph CK' }], suggestionPattern: 'ck' })
    expect(screen.queryByRole('region', { name: 'Suggestions' })).not.toBeInTheDocument()
  })

  it('searches the bank and attached videos by title or channel', () => {
    renderEditable({ videos: [curatedAi] })
    fireEvent.change(searchSection().getByLabelText('Search videos by title or channel'), {
      target: { value: 'diphthong' },
    })
    const section = searchSection()
    expect(section.getByText('The Diphthong Song | Jack Hartmann| How to Sing Diphthongs')).toBeInTheDocument()
  })

  it('marks attached videos in search results and offers Add for the rest', () => {
    const { onChange } = renderEditable({ videos: [curatedAi] })
    fireEvent.change(searchSection().getByLabelText('Search videos by title or channel'), {
      target: { value: 'hartmann' },
    })
    const section = searchSection()
    expect(section.getByText('Attached')).toBeInTheDocument()
    const addButton = section.getByRole('button', { name: 'Add Silent E | Phonics Song for Kids | Jack Hartmann' })
    fireEvent.click(addButton)
    expect(onChange).toHaveBeenCalledWith([
      curatedAi,
      expect.objectContaining({ videoId: 'mxVWScxsOsc', source: 'curated' }),
    ])
  })

  it('shows a no-match message for an empty search result', () => {
    renderEditable()
    fireEvent.change(searchSection().getByLabelText('Search videos by title or channel'), {
      target: { value: 'quokka' },
    })
    expect(searchSection().getByText('No videos matched your search.')).toBeInTheDocument()
  })

  it('rejects a paste that is not a YouTube link', async () => {
    const { onChange } = renderEditable({ videos: [] })
    const section = pasteSection()
    fireEvent.change(section.getByLabelText('Paste a YouTube link'), {
      target: { value: 'https://vimeo.com/123456789' },
    })
    fireEvent.click(section.getByRole('button', { name: 'Add video' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('does not look like a YouTube link')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('rejects pasting a video that is already attached', async () => {
    const { onChange } = renderEditable()
    const section = pasteSection()
    fireEvent.change(section.getByLabelText('Paste a YouTube link'), {
      target: { value: `https://www.youtube.com/watch?v=${curatedAi.videoId}` },
    })
    fireEvent.click(section.getByRole('button', { name: 'Add video' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('already in the list')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('shows an error when the pasted link cannot be verified', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    const { onChange } = renderEditable({ videos: [] })
    const section = pasteSection()
    fireEvent.change(section.getByLabelText('Paste a YouTube link'), {
      target: { value: 'https://youtu.be/dQw4w9WgXcQ' },
    })
    fireEvent.click(section.getByRole('button', { name: 'Add video' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load that video')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('verifies then adds a pasted link with its oEmbed title and channel', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ title: 'My verified song', author_name: 'My Channel' }),
      })
    )
    const { onChange } = renderEditable({ videos: [] })
    const section = pasteSection()
    const input = section.getByLabelText('Paste a YouTube link')
    fireEvent.change(input, { target: { value: 'https://youtu.be/dQw4w9WgXcQ' } })
    fireEvent.click(section.getByRole('button', { name: 'Add video' }))
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith([
        { videoId: 'dQw4w9WgXcQ', title: 'My verified song', channel: 'My Channel', source: 'custom' },
      ])
    })
    expect(input).toHaveValue('')
  })

  it('adds a pasted link without a channel when oEmbed has no author name', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ title: 'No channel song' }) })
    )
    const { onChange } = renderEditable({ videos: [] })
    const section = pasteSection()
    fireEvent.change(section.getByLabelText('Paste a YouTube link'), {
      target: { value: 'dQw4w9WgXcQ' },
    })
    fireEvent.click(section.getByRole('button', { name: 'Add video' }))
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith([{ videoId: 'dQw4w9WgXcQ', title: 'No channel song', source: 'custom' }])
    })
  })

  it('shows a checking state while the pasted link verifies', async () => {
    let resolveFetch!: (value: unknown) => void
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise((resolve) => {
            resolveFetch = resolve
          })
      )
    )
    renderEditable({ videos: [] })
    const section = pasteSection()
    fireEvent.change(section.getByLabelText('Paste a YouTube link'), {
      target: { value: 'https://youtu.be/dQw4w9WgXcQ' },
    })
    fireEvent.click(section.getByRole('button', { name: 'Add video' }))
    expect(await screen.findByRole('button', { name: 'Checking...' })).toBeDisabled()
    resolveFetch({ ok: true, json: () => Promise.resolve({ title: 'Late song' }) })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Add video' })).toBeInTheDocument()
    })
  })

  it('clears the paste error when the teacher edits the link', async () => {
    const { onChange } = renderEditable({ videos: [] })
    const section = pasteSection()
    const input = section.getByLabelText('Paste a YouTube link')
    fireEvent.change(input, { target: { value: 'not a link' } })
    fireEvent.click(section.getByRole('button', { name: 'Add video' }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    fireEvent.change(input, { target: { value: 'https://youtu.be/dQw4w9WgXcQ' } })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('disables the paste Add button for a blank link', () => {
    renderEditable({ videos: [] })
    expect(pasteSection().getByRole('button', { name: 'Add video' })).toBeDisabled()
  })

  it('adds a pasted video to the teacher video collection (issue #458)', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith('/api/video-library')) {
        return { ok: true, json: () => Promise.resolve({ videos: [] }) }
      }
      return { ok: true, json: () => Promise.resolve({ title: 'My verified song', author_name: 'My Channel' }) }
    })
    vi.stubGlobal('fetch', fetchMock)
    const { onChange } = renderEditable({ videos: [] })
    const section = pasteSection()
    fireEvent.change(section.getByLabelText('Paste a YouTube link'), {
      target: { value: 'https://youtu.be/dQw4w9WgXcQ' },
    })
    fireEvent.click(section.getByRole('button', { name: 'Add video' }))
    const video = { videoId: 'dQw4w9WgXcQ', title: 'My verified song', channel: 'My Channel', source: 'custom' }
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith([video])
    })
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/video-library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video }),
      })
    })
  })

  it('does not store a pasted bank video in the collection (issue #458)', async () => {
    // curatedEe is in the bank but not attached to this pattern.
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: () => Promise.resolve({ title: curatedEe.title, author_name: curatedEe.channel }),
    }))
    vi.stubGlobal('fetch', fetchMock)
    const { onChange } = renderEditable({ videos: [] })
    const section = pasteSection()
    fireEvent.change(section.getByLabelText('Paste a YouTube link'), {
      target: { value: `https://youtu.be/${curatedEe.videoId}` },
    })
    fireEvent.click(section.getByRole('button', { name: 'Add video' }))
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith([
        { videoId: curatedEe.videoId, title: curatedEe.title, channel: curatedEe.channel, source: 'custom' },
      ])
    })
    // The bank video is already in every teacher's collection by definition,
    // so the library endpoint is never hit (the fetch call itself is
    // synchronous, so the call log is final once onChange resolved above).
    expect(fetchMock).not.toHaveBeenCalledWith('/api/video-library', expect.anything())
  })

  it('still attaches the video when the collection save fails (issue #458)', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith('/api/video-library')) {
        return { ok: false, status: 500, json: () => Promise.resolve({ error: 'boom' }) }
      }
      return { ok: true, json: () => Promise.resolve({ title: 'My verified song' }) }
    })
    vi.stubGlobal('fetch', fetchMock)
    const { onChange } = renderEditable({ videos: [] })
    const section = pasteSection()
    fireEvent.change(section.getByLabelText('Paste a YouTube link'), {
      target: { value: 'https://youtu.be/dQw4w9WgXcQ' },
    })
    fireEvent.click(section.getByRole('button', { name: 'Add video' }))
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith([{ videoId: 'dQw4w9WgXcQ', title: 'My verified song', source: 'custom' }])
    })
    await waitFor(() => {
      expect(reportError).toHaveBeenCalledWith(expect.anything(), { location: 'PatternVideoModal.pasteAndAdd' })
    })
    // The paste itself succeeded: no error surfaces in the modal.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('closes on Escape', () => {
    const onClose = vi.fn()
    render(
      <PatternVideoModal
        title="Song videos for pattern ai"
        videos={[curatedAi]}
        onChange={vi.fn()}
        suggestionPattern="ai"
        onClose={onClose}
      />
    )
    expect(dialog()).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('PatternVideoModal (browse-only)', () => {
  it('hides every editing control and plays videos', () => {
    render(
      <PatternVideoModal
        title="Song videos"
        videos={[curatedAi, curatedEe]}
        startPlayingId={curatedEe.videoId}
        onClose={vi.fn()}
      />
    )
    const dialogEl = screen.getByRole('dialog', { name: 'Song videos' })
    // Browse-only: no suggestions, search, paste, or remove controls.
    expect(within(dialogEl).queryByRole('button', { name: /^(Add|Remove) / })).not.toBeInTheDocument()
    expect(within(dialogEl).queryByLabelText('Search videos by title or channel')).not.toBeInTheDocument()
    // startPlayingId opens the player directly.
    const frame = dialogEl.querySelector('iframe')
    expect(frame).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/ZfbWOTCgRE0?rel=0&cc_load_policy=1')
    fireEvent.click(screen.getByRole('button', { name: 'Back to videos' }))
    // Back unmounts the player, which stops playback.
    expect(dialogEl.querySelector('iframe')).not.toBeInTheDocument()
    expect(within(dialogEl).getByText('Videos')).toBeInTheDocument()
    expect(within(dialogEl).getByText(curatedAi.title)).toBeInTheDocument()
  })

  it('shows an empty collection message when there are no videos', () => {
    render(<PatternVideoModal title="Song videos" videos={[]} onClose={vi.fn()} />)
    expect(screen.getByText('No videos in this collection yet.')).toBeInTheDocument()
  })

  it('ignores an unknown startPlayingId', () => {
    render(<PatternVideoModal title="Song videos" videos={[curatedAi]} startPlayingId="bogus" onClose={vi.fn()} />)
    expect(screen.getByRole('region', { name: 'Videos' })).toBeInTheDocument()
    expect(screen.queryByTitle(curatedAi.title)).not.toBeInTheDocument()
  })
})

describe('PatternVideoModal add to list (issue #449)', () => {
  const aiList: WordList = {
    id: 'l1',
    userId: 'u1',
    name: 'Week 5: Long A',
    patterns: [{ id: 'p1', sound: 'long a', pattern: 'ai', frequency: 'common', words: ['rain'] }],
    createdAt: '2026-10-06T00:00:00.000Z',
    updatedAt: '2026-10-06T00:00:00.000Z',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    getLists.mockResolvedValue([aiList])
    updateList.mockResolvedValue(aiList)
  })

  function renderPlayer(overrides: { canAddToList?: boolean; onChange?: (videos: PatternVideo[]) => void } = {}) {
    const onClose = vi.fn()
    render(
      <PatternVideoModal
        title="Song videos"
        videos={[curatedAi]}
        startPlayingId={curatedAi.videoId}
        canAddToList={overrides.canAddToList}
        onChange={overrides.onChange}
        suggestionPattern="ai"
        onClose={onClose}
      />
    )
    return { onClose }
  }

  it('opens the add-to-list flow from the player button and back returns to the player', async () => {
    renderPlayer({ canAddToList: true })
    fireEvent.click(screen.getByRole('button', { name: 'Add to list' }))
    expect(getLists).toHaveBeenCalledTimes(1)
    // The player is replaced by the list picker.
    expect(screen.queryByTitle(curatedAi.title)).not.toBeInTheDocument()
    expect(await screen.findByRole('region', { name: 'Pick a list' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    // Back from the flow restores the player, which keeps playing.
    expect(screen.getByTitle(curatedAi.title)).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Pick a list' })).not.toBeInTheDocument()
  })

  it('attaching through the flow and pressing Done closes the modal', async () => {
    const { onClose } = renderPlayer({ canAddToList: true })
    fireEvent.click(screen.getByRole('button', { name: 'Add to list' }))
    fireEvent.click((await screen.findByRole('region', { name: 'Pick a list' })).querySelector('button')!)
    fireEvent.click((await screen.findByRole('region', { name: 'Pick a pattern' })).querySelector('button')!)
    expect(await screen.findByText('Added to Week 5: Long A, pattern ai.')).toBeInTheDocument()
    expect(updateList).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('hides the Add to list button for signed-out visitors', () => {
    renderPlayer()
    expect(screen.getByTitle(curatedAi.title)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add to list' })).not.toBeInTheDocument()
  })

  it('hides the Add to list button in edit mode even when canAddToList is set', () => {
    renderPlayer({ canAddToList: true, onChange: vi.fn() })
    expect(screen.getByTitle(curatedAi.title)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add to list' })).not.toBeInTheDocument()
  })

  it('states the video purpose for signed-in teachers in browse-only mode', () => {
    renderPlayer({ canAddToList: true })
    expect(
      screen.getByText(
        'Phonics songs for spelling patterns. Pick one to play, or add it to a pattern in one of your spelling lists.'
      )
    ).toBeInTheDocument()
  })

  it('omits the add-to-list purpose for signed-out visitors', () => {
    renderPlayer()
    expect(screen.getByText('Phonics songs for spelling patterns. Pick one to play.')).toBeInTheDocument()
  })
})

describe('PatternVideoModal save errors', () => {
  it('shows a save error inside the modal when provided', () => {
    render(
      <PatternVideoModal
        title="Song videos for pattern ai"
        videos={[]}
        onChange={vi.fn()}
        suggestionPattern="ai"
        saveError="Could not save the videos. Check your connection and try again."
        onClose={vi.fn()}
      />
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save the videos')
  })

  it('shows no save error by default', () => {
    render(
      <PatternVideoModal
        title="Song videos for pattern ai"
        videos={[]}
        onChange={vi.fn()}
        suggestionPattern="ai"
        onClose={vi.fn()}
      />
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('PatternVideoModal hidden videos (issue #443)', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function renderWithHide(
    overrides: {
      videos?: PatternVideo[]
      blockedVideoIds?: string[]
      onHideVideo?: ((video: PatternVideo) => void) | undefined
    } = {}
  ) {
    const onChange = vi.fn()
    const onHideVideo = 'onHideVideo' in overrides ? overrides.onHideVideo : vi.fn()
    render(
      <PatternVideoModal
        title="Song videos for pattern ai"
        videos={overrides.videos ?? []}
        onChange={onChange}
        suggestionPattern="ai"
        blockedVideoIds={overrides.blockedVideoIds}
        onHideVideo={onHideVideo}
        onClose={vi.fn()}
      />
    )
    return { onChange, onHideVideo: onHideVideo as ReturnType<typeof vi.fn> }
  }

  it('shows suggestions unfiltered when nothing is hidden', () => {
    renderWithHide()
    expect(suggestionsSection().getByText(curatedAi.title)).toBeInTheDocument()
    expect(suggestionsSection().getByRole('button', { name: `Hide ${curatedAi.title}` })).toBeInTheDocument()
  })

  it('filters hidden videos out of the suggestions', () => {
    renderWithHide({ blockedVideoIds: [curatedAi.videoId] })
    expect(screen.queryByRole('region', { name: 'Suggestions' })).not.toBeInTheDocument()
  })

  it('filters hidden videos out of search results', () => {
    renderWithHide({ blockedVideoIds: [curatedAi.videoId] })
    fireEvent.change(searchSection().getByLabelText('Search videos by title or channel'), {
      target: { value: 'scratch' },
    })
    const results = searchSection()
    expect(results.queryByText(curatedAi.title)).not.toBeInTheDocument()
    // The bank title carries a double space; Testing Library collapses it.
    expect(results.getByText('The Vowel Teams Song | The Long E Sound | Phonics Song')).toBeInTheDocument()
  })

  it('hides a suggested video without detaching anything', () => {
    const { onChange, onHideVideo } = renderWithHide()
    fireEvent.click(suggestionsSection().getByRole('button', { name: `Hide ${curatedAi.title}` }))
    expect(onHideVideo).toHaveBeenCalledWith(curatedAi)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('hiding an attached video removes it from the list and blocks it', () => {
    const { onChange, onHideVideo } = renderWithHide({ videos: [curatedAi] })
    fireEvent.click(attachedSection().getByRole('button', { name: `Hide ${curatedAi.title}` }))
    expect(onChange).toHaveBeenCalledWith([])
    expect(onHideVideo).toHaveBeenCalledWith(curatedAi)
  })

  it('hides a search result via the Hide button', () => {
    const { onHideVideo } = renderWithHide()
    fireEvent.change(searchSection().getByLabelText('Search videos by title or channel'), {
      target: { value: 'scratch' },
    })
    fireEvent.click(searchSection().getByRole('button', { name: /Hide The Vowel Teams Song/ }))
    expect(onHideVideo).toHaveBeenCalledWith(expect.objectContaining({ videoId: curatedEe.videoId, source: 'curated' }))
  })

  it('shows no Hide buttons when onHideVideo is omitted', () => {
    renderWithHide({ videos: [curatedAi], onHideVideo: undefined })
    expect(screen.queryByRole('button', { name: `Hide ${curatedAi.title}` })).not.toBeInTheDocument()
    expect(attachedSection().getByRole('button', { name: `Remove ${curatedAi.title}` })).toBeInTheDocument()
  })
})
