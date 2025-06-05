import { convertUSDtoETB } from '../currency'

describe('currency utilities', () => {
  it('converts USD to ETB correctly', () => {
    expect(convertUSDtoETB(2)).toBe(110)
  })
})
