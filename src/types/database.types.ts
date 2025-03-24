export interface User {
  id: string;
  full_name: string | null;
  email: string;
  role: 'owner' | 'customer' | 'admin';
  created_at: string;
  subscription_plan: 'basic' | 'pro' | 'enterprise';
  store_settings: any | null;
  is_admin: boolean;
  is_verified: boolean;
  verification_status: 'pending' | 'verified' | 'rejected';
} 