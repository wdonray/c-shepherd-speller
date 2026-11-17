import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import UfliLesson84AiAyPage, { metadata } from './page'
import PrintButton from './print-button'
import { getPrebuiltWeek } from '@/lib/prebuilt-lists'

vi.mock('@/lib/prebuilt-lists', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/prebuilt-lists')>()
  return {
    ...actual,
    getPrebuiltWeek: vi.fn((id: string) => actual.getPrebuiltWeek(id)),
  }
})

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('notFound')
  },
}))

describe('UfliLesson84AiAyPage metadata', () => {
  it('targets the UFLI Lesson 84 ai/ay search phrase', () => {
    expect(metadata.title).toContain('UFLI Lesson 84')
    expect(metadata.title).toContain('ai/ay')
    expect(metadata.description).toContain('UFLI Foundations Lesson 84')
  })
})

describe('UfliLesson84AiAyPage', () => {
  it('renders the lesson heading', () => {
    render(<UfliLesson84AiAyPage />)
    expect(screen.getByRole('heading', { name: 'UFLI Lesson 84: ai and ay Words', level: 1 })).toBeInTheDocument()
  })

  it('calls notFound when the week is missing', () => {
    vi.mocked(getPrebuiltWeek).mockReturnValueOnce(undefined)
    expect(() => UfliLesson84AiAyPage()).toThrow('notFound')
  })

  it('shows every word from the app list, grouped by pattern', () => {
    render(<UfliLesson84AiAyPage />)
    for (const word of [
      'rain',
      'train',
      'wait',
      'snail',
      'paint',
      'chain',
      'play',
      'day',
      'say',
      'away',
      'stay',
      'tray',
    ]) {
      expect(screen.getAllByText(word).length).toBeGreaterThan(0)
    }
  })

  it('explains the ai middle, ay end pattern without an email gate', () => {
    render(<UfliLesson84AiAyPage />)
    expect(screen.getByText(/in the middle of a word/i)).toBeInTheDocument()
    expect(screen.getByText(/No sign-up needed/i)).toBeInTheDocument()
  })

  it('includes a worksheet with an answer key and a print button', () => {
    render(<UfliLesson84AiAyPage />)
    expect(screen.getByRole('heading', { name: /free printable worksheet/i, level: 2 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /answer key/i, level: 3 })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /print this worksheet/i })).toBeInTheDocument()
  })

  it('links once to the list in the app', () => {
    render(<UfliLesson84AiAyPage />)
    const link = screen.getByRole('link', { name: /open this list in patternspell/i })
    expect(link).toHaveAttribute('href', '/lists/prebuilt/ufli-g2-w07')
  })

  it('places the signup call to action after the chart and before the worksheet', () => {
    render(<UfliLesson84AiAyPage />)
    const chart = screen.getByRole('heading', { name: /projectable pattern chart/i, level: 2 })
    const signup = screen.getByRole('heading', { name: /use this list in patternspell/i, level: 2 })
    const worksheet = screen.getByRole('heading', { name: /free printable worksheet/i, level: 2 })
    expect(chart.compareDocumentPosition(signup) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(signup.compareDocumentPosition(worksheet) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('carries the UFLI non-endorsement disclaimer', () => {
    render(<UfliLesson84AiAyPage />)
    expect(screen.getByText(/not created by, affiliated with, or endorsed by/i)).toBeInTheDocument()
  })
})

describe('PrintButton', () => {
  it('calls window.print when clicked', () => {
    const printSpy = vi.fn()
    vi.stubGlobal('print', printSpy)
    render(<PrintButton />)
    screen.getByRole('button', { name: /print this worksheet/i }).click()
    expect(printSpy).toHaveBeenCalledOnce()
    vi.unstubAllGlobals()
  })
})
