import { tools } from '../tools'

describe('tools utilities', () => {
  it('creates 32 char nonce', () => {
    const nonce = tools.createNonceStr()
    expect(nonce).toHaveLength(32)
  })

  it('creates timestamp string', () => {
    const ts = tools.createTimeStamp()
    expect(typeof ts).toBe('string')
    expect(ts.length).toBeGreaterThan(0)
  })
})
