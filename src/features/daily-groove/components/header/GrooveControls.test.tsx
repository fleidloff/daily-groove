import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GrooveControls } from './GrooveControls'

const source = readFileSync(
  resolve(
    process.cwd(),
    'src/features/daily-groove/components/header/GrooveControls.tsx',
  ),
  'utf8',
)

const share = () => (
  <button type="button" onClick={() => {}}>
    Share
  </button>
)
const transpose = () => (
  <button type="button" onClick={() => {}}>
    Transpose
  </button>
)

const row = () =>
  screen.getByRole('button', { name: 'Share' }).parentElement as HTMLElement

describe('GrooveControls (quick 9)', () => {
  it('puts transpose ahead of share on one row', () => {
    render(<GrooveControls share={share()} transpose={transpose()} />)

    const shareButton = screen.getByRole('button', { name: 'Share' })
    const pill = screen.getByRole('button', { name: 'Transpose' })

    expect(row()).toContainElement(pill)
    expect(
      pill.compareDocumentPosition(shareButton) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('keeps the controls at the end of the row', () => {
    render(<GrooveControls share={share()} transpose={transpose()} />)

    expect(row().className).toContain('justify-end')
  })

  it('renders either slot on its own', () => {
    const { unmount } = render(<GrooveControls share={share()} />)
    expect(screen.getByRole('button', { name: 'Share' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Transpose' })).toBeNull()
    unmount()

    render(<GrooveControls transpose={transpose()} />)
    expect(screen.getByRole('button', { name: 'Transpose' })).toBeInTheDocument()
  })

  it('renders nothing when it has neither slot', () => {
    const { container } = render(<GrooveControls />)
    expect(container).toBeEmptyDOMElement()
  })

  it('is no second banner landmark', () => {
    render(<GrooveControls share={share()} transpose={transpose()} />)
    expect(screen.queryByRole('banner')).toBeNull()
  })

  it('learns nothing about sharing to render it', () => {
    expect(source).not.toMatch(/from ['"][^'"]*share/)
    expect(source).not.toContain('shareUrlOf')
    expect(source).not.toContain('ShareGroove')
  })

  it('learns nothing about pitch to render it', () => {
    expect(source).not.toMatch(/transpose['"]/)
    expect(source).not.toContain('TransposeSelect')
    expect(source).not.toContain('useInstrumentKey')
  })
})
