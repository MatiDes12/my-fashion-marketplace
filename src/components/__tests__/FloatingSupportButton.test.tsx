import renderer from 'react-test-renderer'
import FloatingSupportButton from '../FloatingSupportButton'

jest.mock('next/link', () => (props: any) => <a {...props} />)
jest.mock('next/navigation', () => ({ usePathname: jest.fn() }))
jest.mock('@/contexts/AuthContext', () => ({ useAuth: jest.fn() }))

import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

describe('FloatingSupportButton', () => {
  it('renders null when no user', () => {
    ;(useAuth as jest.Mock).mockReturnValue({ user: null })
    ;(usePathname as jest.Mock).mockReturnValue('/products')
    const tree = renderer.create(<FloatingSupportButton />).toJSON()
    expect(tree).toBeNull()
  })
})
