import { classNames } from '../classNames'

describe('classNames util', () => {
  it('combines strings and objects', () => {
    const result = classNames('foo', { bar: true, baz: false }, 'qux')
    expect(result).toBe('foo bar qux')
  })
})
