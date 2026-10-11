import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

const { reportError } = vi.hoisted(() => ({ reportError: vi.fn() }))
vi.mock('@/lib/report-error', () => ({ reportError }))

import FeedbackForm from './FeedbackForm'
import { resetTurnstileScript } from '@/app/auth/email/_components/turnstile-widget'

const fetchMock = vi.fn()
const validDetails = 'Clicking print on the list page does nothing at all.'

function fillValidForm() {
  fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Print button is broken' } })
  fireEvent.change(screen.getByLabelText('Details'), { target: { value: validDetails } })
}

describe('FeedbackForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    delete window.turnstile
    resetTurnstileScript()
  })

  it('renders with issue selected by default', () => {
    render(<FeedbackForm />)

    expect(screen.getByRole('radio', { name: /report an issue/i })).toBeChecked()
    expect(screen.getByRole('radio', { name: /request a feature/i })).not.toBeChecked()
    expect(screen.getByLabelText('Subject')).toBeInTheDocument()
    expect(screen.getByLabelText('Details')).toBeInTheDocument()
  })

  it('switches the feedback type', () => {
    render(<FeedbackForm />)

    fireEvent.click(screen.getByText('Request a feature'))

    expect(screen.getByRole('radio', { name: /request a feature/i })).toBeChecked()
  })

  it('shows field errors when submitted empty', async () => {
    render(<FeedbackForm />)

    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))

    expect(await screen.findByText('Give your message a short subject.')).toBeInTheDocument()
    expect(screen.getByText(/at least 10 characters/)).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows only the subject error when just the subject is short', async () => {
    render(<FeedbackForm />)
    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'ab' } })
    fireEvent.change(screen.getByLabelText('Details'), { target: { value: validDetails } })

    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))

    expect(await screen.findByText('Give your message a short subject.')).toBeInTheDocument()
    expect(screen.queryByText(/at least 10 characters/)).not.toBeInTheDocument()
  })

  it('sends the feedback and shows the success state', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 })
    render(<FeedbackForm />)
    fireEvent.click(screen.getByText('Request a feature'))
    fillValidForm()

    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))

    expect(await screen.findByText('Message sent')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/feedback')
    expect(init.method).toBe('POST')
    const body = init.body as FormData
    expect(body.get('type')).toBe('feature')
    expect(body.get('subject')).toBe('Print button is broken')
    expect(body.get('details')).toBe(validDetails)
    expect(body.get('website')).toBe('')
    expect(body.get('attachment')).toBeNull()
  })

  it('renders a honeypot field hidden from assistive tech', () => {
    render(<FeedbackForm />)

    const honeypot = document.getElementById('website')
    expect(honeypot).toBeInTheDocument()
    expect(honeypot?.closest('[aria-hidden="true"]')).not.toBeNull()
    expect(honeypot).toHaveAttribute('tabindex', '-1')
  })

  it('submits the honeypot value so the server can reject bot fills', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 })
    render(<FeedbackForm />)
    fillValidForm()
    fireEvent.change(document.getElementById('website')!, { target: { value: 'http://spam.example' } })

    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))

    expect(await screen.findByText('Message sent')).toBeInTheDocument()
    const [, init] = fetchMock.mock.calls[0]
    expect((init.body as FormData).get('website')).toBe('http://spam.example')
  })

  it('shows the server message when verification fails', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: 'Verification failed. Please try again.' }),
    })
    render(<FeedbackForm />)
    fillValidForm()

    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))

    expect(await screen.findByText('Verification failed. Please try again.')).toBeInTheDocument()
    expect(screen.queryByText('Message sent')).not.toBeInTheDocument()
  })

  it('blocks submit when the Turnstile challenge produces no token', async () => {
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'test-site-key')
    fetchMock.mockResolvedValue({ ok: true, status: 200 })
    render(<FeedbackForm />)
    fillValidForm()

    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))

    expect(await screen.findByText('Could not verify you are human. Please try again.')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends the Turnstile token when the challenge succeeds', async () => {
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'test-site-key')
    let capturedCallback: ((token: string) => void) | null = null
    const renderedWidgets: string[] = []
    const fakeTurnstile = {
      render: (_el: HTMLElement, options: { callback: (token: string) => void }) => {
        capturedCallback = options.callback
        renderedWidgets.push('widget-1')
        return 'widget-1'
      },
      execute: () => {
        capturedCallback?.('test-token-123')
      },
      remove: vi.fn(),
    }
    Object.defineProperty(window, 'turnstile', { value: fakeTurnstile, configurable: true, writable: true })
    fetchMock.mockResolvedValue({ ok: true, status: 200 })
    render(<FeedbackForm />)
    // Wait for the widget's async setup (script load + render + pre-warm)
    // so a token is ready before submitting, as in a real browser.
    await waitFor(() => expect(renderedWidgets).toContain('widget-1'))
    fillValidForm()

    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))

    expect(await screen.findByText('Message sent')).toBeInTheDocument()
    const [, init] = fetchMock.mock.calls[0]
    expect((init.body as FormData).get('turnstileToken')).toBe('test-token-123')
  })

  it('shows a generic error when the error body has no message', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) })
    render(<FeedbackForm />)
    fillValidForm()

    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))

    expect(await screen.findByText('Something went wrong sending your message. Please try again.')).toBeInTheDocument()
  })

  it('shows a generic error when the error body is unreadable', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('bad json')
      },
    })
    render(<FeedbackForm />)
    fillValidForm()

    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))

    expect(await screen.findByText('Something went wrong sending your message. Please try again.')).toBeInTheDocument()
  })

  it('rejects a non-image attachment but still sends the message without it', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 })
    render(<FeedbackForm />)
    const input = screen.getByLabelText('Screenshot (optional)') as HTMLInputElement
    const exe = new File(['MZ'], 'evil.exe', { type: 'application/x-msdownload' })

    fireEvent.change(input, { target: { files: [exe] } })

    expect(await screen.findByText('Attachments must be PNG, JPEG, GIF, or WebP images.')).toBeInTheDocument()
    expect(input.value).toBe('')
    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))

    expect(await screen.findByText('Message sent')).toBeInTheDocument()
    const [, init] = fetchMock.mock.calls[0]
    expect((init.body as FormData).get('attachment')).toBeNull()
  })

  it('rejects an oversized attachment', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 })
    render(<FeedbackForm />)
    const input = screen.getByLabelText('Screenshot (optional)') as HTMLInputElement
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' })

    fireEvent.change(input, { target: { files: [big] } })

    expect(await screen.findByText('Attachments must be 5 MB or smaller.')).toBeInTheDocument()
    expect(input.value).toBe('')
    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))

    expect(await screen.findByText('Message sent')).toBeInTheDocument()
    const [, init] = fetchMock.mock.calls[0]
    expect((init.body as FormData).get('attachment')).toBeNull()
  })

  it('sends a valid attachment with the form', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 })
    render(<FeedbackForm />)
    const png = new File(['fake-png-bytes'], 'shot.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText('Screenshot (optional)'), { target: { files: [png] } })
    fillValidForm()

    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))

    expect(await screen.findByText('Message sent')).toBeInTheDocument()
    const [, init] = fetchMock.mock.calls[0]
    const sentFile = (init.body as FormData).get('attachment') as File
    expect(sentFile).toBeInstanceOf(File)
    expect(sentFile.name).toBe('shot.png')
  })

  it('clears the attachment when the file selection is removed', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 })
    render(<FeedbackForm />)
    const input = screen.getByLabelText('Screenshot (optional)')
    const png = new File(['fake-png-bytes'], 'shot.png', { type: 'image/png' })
    fireEvent.change(input, { target: { files: [png] } })
    fireEvent.change(input, { target: { files: [] } })
    fillValidForm()

    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))

    expect(await screen.findByText('Message sent')).toBeInTheDocument()
    const [, init] = fetchMock.mock.calls[0]
    expect((init.body as FormData).get('attachment')).toBeNull()
  })

  it('resets to a blank form from the success state', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 })
    render(<FeedbackForm />)
    const png = new File(['fake-png-bytes'], 'shot.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText('Screenshot (optional)'), { target: { files: [png] } })
    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))
    await screen.findByText('Message sent')

    fireEvent.click(screen.getByRole('button', { name: 'Send another message' }))

    expect(screen.getByRole('radio', { name: /report an issue/i })).toBeChecked()
    expect(screen.getByLabelText('Subject')).toHaveValue('')
    expect(screen.getByLabelText('Details')).toHaveValue('')
    expect((screen.getByLabelText('Screenshot (optional)') as HTMLInputElement).value).toBe('')
  })

  it('shows a specific message when rate limited', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 429 })
    render(<FeedbackForm />)
    fillValidForm()

    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))

    expect(await screen.findByText(/sent a few messages recently/)).toBeInTheDocument()
    expect(screen.queryByText('Message sent')).not.toBeInTheDocument()
  })

  it('shows a generic error when the server fails', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 })
    render(<FeedbackForm />)
    fillValidForm()

    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))

    expect(await screen.findByText('Something went wrong sending your message. Please try again.')).toBeInTheDocument()
  })

  it('shows a generic error and reports when the network fails', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    render(<FeedbackForm />)
    fillValidForm()

    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))

    expect(await screen.findByText('Something went wrong sending your message. Please try again.')).toBeInTheDocument()
    expect(reportError).toHaveBeenCalledTimes(1)
  })

  it('ignores a second submit while a send is in flight', async () => {
    let resolveFetch!: (value: { ok: boolean; status: number }) => void
    fetchMock.mockReturnValue(new Promise((resolve) => (resolveFetch = resolve)))
    render(<FeedbackForm />)
    fillValidForm()

    // Submit the form directly: the submit button is disabled while sending,
    // so this is the only way to reach the in-flight guard.
    const form = document.querySelector('form')
    expect(form).toBeInTheDocument()
    fireEvent.submit(form!)
    fireEvent.submit(form!)
    resolveFetch({ ok: true, status: 200 })

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('Message sent')).toBeInTheDocument()
  })

  it('shows character counts for subject and details', () => {
    render(<FeedbackForm />)

    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Hello' } })

    expect(screen.getByText('5/120')).toBeInTheDocument()
    expect(screen.getByText('0/5000')).toBeInTheDocument()
  })
})
