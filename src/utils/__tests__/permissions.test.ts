import { getRolePermissions } from '../permissions'

describe('role permissions', () => {
  it('returns admin permissions', () => {
    const perms = getRolePermissions('admin', true)
    expect(perms.canManageUsers).toBe(true)
    expect(perms.canManageProducts).toBe(false)
  })

  it('returns owner permissions with admin flag', () => {
    const perms = getRolePermissions('owner', true)
    expect(perms.canViewRevenue).toBe(true)
    expect(perms.canManageProducts).toBe(true)
  })
})
