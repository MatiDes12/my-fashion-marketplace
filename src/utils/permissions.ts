export type UserRole = 'admin' | 'owner' | 'customer';

interface Permissions {
  canAccessAdminPanel: boolean;
  canManageUsers: boolean;
  canManagePayments: boolean;
  canViewRevenue: boolean;
  canProcessWithdrawals: boolean;
  canManageProducts: boolean;
  canManageOrders: boolean;
}

export const getRolePermissions = (role: UserRole, isAdmin: boolean): Permissions => {
  switch (role) {
    case 'admin':
      return {
        canAccessAdminPanel: true,
        canManageUsers: true,
        canManagePayments: true,
        canViewRevenue: true,
        canProcessWithdrawals: true,
        canManageProducts: false,
        canManageOrders: false,
      };
    case 'owner':
      return {
        canAccessAdminPanel: true,
        canManageUsers: false,
        canManagePayments: false,
        canViewRevenue: isAdmin,
        canProcessWithdrawals: false,
        canManageProducts: true,
        canManageOrders: true,
      };
    default:
      return {
        canAccessAdminPanel: false,
        canManageUsers: false,
        canManagePayments: false,
        canViewRevenue: false,
        canProcessWithdrawals: false,
        canManageProducts: false,
        canManageOrders: false,
      };
  }
}; 