import { cleanImageUrl, normalizeUrl, getAppUrl } from '../url'

describe('url utilities', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supabase.test'
    process.env.NEXT_PUBLIC_SITE_URL = 'https://myapp.test'
  })

  it('normalizes urls correctly', () => {
    const url = normalizeUrl('https://example.com/', '/path')
    expect(url).toBe('https://example.com/path')
  })

  it('returns cleaned supabase url for filename', () => {
    const url = cleanImageUrl('image.png')
    expect(url).toBe('https://supabase.test/storage/v1/object/public/products/image.png')
  })

  it('gets app url from env', () => {
    expect(getAppUrl()).toBe('https://myapp.test')
  })
})
