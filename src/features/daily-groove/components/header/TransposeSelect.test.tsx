import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { header } from '@/lib/snippets'
import { INSTRUMENT_KEYS } from '@/lib/theory/transpose'
import { TransposeSelect } from './TransposeSelect'

const box = () => screen.getByRole('combobox', { name: header.transpose })

describe('TransposeSelect', () => {
  it('is named Transpose and shows the current key (F23 E1 R1, AC1)', () => {
    render(<TransposeSelect instrumentKey="C" onChange={vi.fn()} />)
    expect(box()).toHaveValue('C')
  })

  it('names the instrument beside each key, in INSTRUMENT_KEYS’ order (F23 E1 R1, AC1b)', () => {
    render(<TransposeSelect instrumentKey="C" onChange={vi.fn()} />)
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(
      INSTRUMENT_KEYS.map((instrumentKey) => header.instruments[instrumentKey]),
    )
  })

  it('shows the key alone once picked, not the instrument (F23 E1 R1, AC1b)', () => {
    render(<TransposeSelect instrumentKey="E♭" onChange={vi.fn()} />)
    expect(
      screen.getAllByText('E♭').filter((el) => el.tagName === 'SPAN'),
    ).toHaveLength(1)
    expect(screen.queryByText(header.instruments['E♭'])?.tagName).toBe('OPTION')
  })

  it.each(INSTRUMENT_KEYS)('shows %s when that is the choice (F23 E1 R1, AC1b)', (instrumentKey) => {
    render(<TransposeSelect instrumentKey={instrumentKey} onChange={vi.fn()} />)
    expect(box()).toHaveValue(instrumentKey)
  })

  it.each(['B♭', 'E♭', 'F'] as const)(
    'reports %s once when picked (F23 E1 R1, AC1b)',
    async (instrumentKey) => {
      const user = userEvent.setup()
      const onChange = vi.fn()
      render(<TransposeSelect instrumentKey="C" onChange={onChange} />)

      await user.selectOptions(box(), instrumentKey)

      expect(onChange).toHaveBeenCalledTimes(1)
      expect(onChange).toHaveBeenCalledWith(instrumentKey)
    },
  )

  it('is never disabled (F23 E1 R1)', () => {
    render(<TransposeSelect instrumentKey="B♭" onChange={vi.fn()} />)
    expect(box()).not.toBeDisabled()
  })
})
