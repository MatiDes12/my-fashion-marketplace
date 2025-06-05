import { convertUSDtoETB, formatETB, formatCurrency } from '../currency'

describe('currency utilities', () => {
  it('converts USD to ETB correctly', () => {
    expect(convertUSDtoETB(2)).toBe(110)
  })

  it('formats ETB amounts correctly', () => {
    const formatted = formatETB(99)
    expect(formatted.includes('99.00')).toBe(true)
  })

  it('formats nullable values as currency', () => {
    expect(formatCurrency(null)).toBe('ETB\u00a00.00')
  })
})
