import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

const { reportError } = vi.hoisted(() => ({ reportError: vi.fn() }))
vi.mock('@/lib/report-error', () => ({ reportError }))

import FeedbackForm from './FeedbackForm'

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
    expect(JSON.parse(init.body)).toEqual({
      type: 'feature',
      subject: 'Print button is broken',
      details: validDetails,
      website: '',
    })
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
    expect(JSON.parse(init.body).website).toBe('http://spam.example')
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
    vi.unstubAllEnvs()
  })

  it('resets to a blank form from the success state', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 })
    render(<FeedbackForm />)
    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))
    await screen.findByText('Message sent')

    fireEvent.click(screen.getByRole('button', { name: 'Send another message' }))

    expect(screen.getByRole('radio', { name: /report an issue/i })).toBeChecked()
    expect(screen.getByLabelText('Subject')).toHaveValue('')
    expect(screen.getByLabelText('Details')).toHaveValue('')
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
