jest.mock('../../lib/supabase', () => ({ supabase: {} }))

import { isPasswordStrong } from '../signup/page'

describe('signup utilities', () => {
  it('validates strong password', () => {
    expect(isPasswordStrong('Abcdef1!')).toBe(true)
    expect(isPasswordStrong('weak')).toBe(false)
  })
})
