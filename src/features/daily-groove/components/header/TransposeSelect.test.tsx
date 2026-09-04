import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { header } from '@/lib/snippets'
import { WRITTEN } from '@/lib/theory/transpose'
import { TransposeSelect } from './TransposeSelect'

const box = () => screen.getByRole('combobox', { name: header.transpose })

describe('TransposeSelect', () => {
  it('is named Transpose and shows the current key (F23 E1 R1, AC1)', () => {
    render(<TransposeSelect written="C" onChange={vi.fn()} />)
    expect(box()).toHaveValue('C')
  })

  it('names the instrument beside each key, in WRITTEN’s order (F23 E1 R1, AC1b)', () => {
    render(<TransposeSelect written="C" onChange={vi.fn()} />)
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(
      WRITTEN.map((written) => header.instruments[written]),
    )
  })

  it('shows the key alone once picked, not the instrument (F23 E1 R1, AC1b)', () => {
    render(<TransposeSelect written="E♭" onChange={vi.fn()} />)
    expect(
      screen.getAllByText('E♭').filter((el) => el.tagName === 'SPAN'),
    ).toHaveLength(1)
    expect(screen.queryByText(header.instruments['E♭'])?.tagName).toBe('OPTION')
  })

  it.each(WRITTEN)('shows %s when that is the choice (F23 E1 R1, AC1b)', (written) => {
    render(<TransposeSelect written={written} onChange={vi.fn()} />)
    expect(box()).toHaveValue(written)
  })

  it.each(['B♭', 'E♭', 'F'] as const)(
    'reports %s once when picked (F23 E1 R1, AC1b)',
    async (written) => {
      const user = userEvent.setup()
      const onChange = vi.fn()
      render(<TransposeSelect written="C" onChange={onChange} />)

      await user.selectOptions(box(), written)

      expect(onChange).toHaveBeenCalledTimes(1)
      expect(onChange).toHaveBeenCalledWith(written)
    },
  )

  it('is never disabled (F23 E1 R1)', () => {
    render(<TransposeSelect written="B♭" onChange={vi.fn()} />)
    expect(box()).not.toBeDisabled()
  })
})
