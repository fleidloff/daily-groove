import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Toast } from './Toast'

const region = () => document.querySelector('[aria-live="polite"]') as HTMLElement
const anchor = () => screen.getByText('Copy')

describe('Toast', () => {
  it('renders what it hangs from', () => {
    render(<Toast><button type="button">Copy</button></Toast>)
    expect(anchor()).toBeInTheDocument()
  })

  it('keeps its live region mounted with nothing to say', () => {
    render(<Toast><button type="button">Copy</button></Toast>)
    expect(region()).toBeInTheDocument()
    expect(region()).toBeEmptyDOMElement()
  })

  it('announces its message from inside that region', () => {
    render(
      <Toast message="Saved">
        <button type="button">Copy</button>
      </Toast>,
    )
    expect(screen.getByText('Saved').closest('[aria-live="polite"]')).toBe(region())
  })

  it('supplies its own positioning context, so the message hangs off the anchor', () => {
    render(
      <Toast message="Saved">
        <button type="button">Copy</button>
      </Toast>,
    )
    const wrap = anchor().parentElement as HTMLElement

    expect(wrap.className).toContain('relative')
    expect(wrap).toContainElement(region())
    expect(region().className).toContain('absolute')
    expect(region().className).toContain('top-full')
    expect(region().className).toContain('pointer-events-none')
  })

  it('hangs from the side it is given', () => {
    const { container } = render(
      <Toast message="Saved" align="end">
        <button type="button">Copy</button>
      </Toast>,
    )
    expect(region().className).toContain('right-0')
    expect(region().className).not.toContain('left-0')

    container.remove()
    render(
      <Toast message="Saved" align="start">
        <button type="button">Copy</button>
      </Toast>,
    )
    expect(region().className).toContain('left-0')
  })
})
