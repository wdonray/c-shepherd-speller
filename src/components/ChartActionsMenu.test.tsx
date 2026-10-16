import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ChartActionsMenu from './ChartActionsMenu'
import { WHY_CHART_BODY, WHY_CHART_TITLE } from './WhyChartPopover'

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

function setFullscreenApi(available: boolean) {
  Object.defineProperty(document.documentElement, 'requestFullscreen', {
    configurable: true,
    writable: true,
    value: available ? vi.fn().mockResolvedValue(undefined) : undefined,
  })
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, writable: true, value: null })
  Object.defineProperty(document, 'exitFullscreen', {
    configurable: true,
    writable: true,
    value: vi.fn().mockResolvedValue(undefined),
  })
}

const props = {
  listId: 'l1',
  showRules: true,
  onToggleRules: vi.fn(),
  showUnderlines: false,
  onToggleUnderlines: vi.fn(),
}

async function openMenu() {
  render(<ChartActionsMenu {...props} />)
  fireEvent.click(screen.getByRole('button', { name: 'Open chart options' }))
  await screen.findByRole('dialog', { name: 'Chart options' })
}

describe('ChartActionsMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setFullscreenApi(true)
  })

  afterEach(() => {
    setFullscreenApi(false)
  })

  it('renders the mobile menu trigger', () => {
    render(<ChartActionsMenu {...props} />)
    const trigger = screen.getByRole('button', { name: 'Open chart options' })
    expect(trigger).toHaveClass('sm:hidden')
  })

  it('opens a bottom sheet titled Chart options', async () => {
    await openMenu()
    expect(screen.getByRole('dialog', { name: 'Chart options' })).toBeInTheDocument()
  })

  it('toggles the rules display from the sheet', async () => {
    await openMenu()
    fireEvent.click(screen.getByRole('button', { name: 'Show rules' }))
    expect(props.onToggleRules).toHaveBeenCalledTimes(1)
  })

  it('toggles word underlines from the sheet', async () => {
    await openMenu()
    fireEvent.click(screen.getByRole('button', { name: 'Show word underlines' }))
    expect(props.onToggleUnderlines).toHaveBeenCalledTimes(1)
  })

  it('links to the print view for the list', async () => {
    await openMenu()
    expect(screen.getByRole('link', { name: 'Print chart' })).toHaveAttribute('href', '/lists/l1/print')
  })

  it('shows the full screen toggle as a labeled row when supported', async () => {
    await openMenu()
    const button = screen.getByRole('button', { name: 'Full screen' })
    expect(button).toHaveTextContent('Full screen')
  })

  it('omits the full screen row when the Fullscreen API is unavailable', async () => {
    setFullscreenApi(false)
    await openMenu()
    expect(screen.queryByRole('button', { name: /full screen/i })).not.toBeInTheDocument()
  })

  it('shows the same why-this-chart explainer as the desktop popover', async () => {
    await openMenu()
    expect(screen.getByText(WHY_CHART_TITLE)).toBeInTheDocument()
    expect(screen.getByText(WHY_CHART_BODY)).toBeInTheDocument()
  })
})
