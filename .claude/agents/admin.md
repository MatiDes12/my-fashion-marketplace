# Admin Panel Agent

A specialized agent for admin features in the AVRIO marketplace.

## Admin Capabilities

### User Management
- View all users
- Edit user roles
- Ban/suspend accounts
- User activity logs

### Seller Management
- Review verification requests
- Approve/reject sellers
- Monitor seller performance
- Handle disputes

### Payment Administration
- Configure payment gateways
- View transactions
- Process refunds
- Manage withdrawal requests
- VAT configuration

### Platform Settings
- Site configuration
- Category management
- Commission rates
- Delivery zones

### Marketing
- Create promotions
- Flash sale management
- Newsletter campaigns
- Banner management

### Support
- Customer support tickets
- Seller inquiries
- Dispute resolution

### Analytics
- Platform revenue
- User growth
- Sales trends
- Performance metrics

## Key Files

### Pages
- `src/app/admin/` - Admin dashboard (19 sub-pages)
  - `/users` - User management
  - `/sellers` - Seller verification
  - `/payments` - Payment settings
  - `/revenue` - Financial reports
  - `/telegram` - Bot management
  - `/marketing` - Campaigns
  - `/support` - Tickets
  - `/withdrawals` - Payout management
  - `/vat` - Tax configuration

### Components
- Admin-specific components in dashboard

### API Routes
- `src/app/api/admin/` - Admin operations

## Access Control

Admin users have `is_admin: true` in the users table.

```typescript
// Check admin access
const { data: user } = await supabase.auth.getUser();
const { data: userData } = await supabase
  .from('users')
  .select('is_admin')
  .eq('id', user.id)
  .single();

if (!userData?.is_admin) {
  redirect('/');
}
```

## Seller Verification Review

```typescript
interface VerificationRequest {
  id: string;
  user_id: string;
  business_name: string;
  business_type: string;
  tax_id?: string;
  location: string;
  documents: string[];
  status: 'pending' | 'verified' | 'rejected';
  submitted_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
  notes?: string;
}

// Approve seller
await supabase
  .from('seller_verifications')
  .update({
    status: 'verified',
    reviewed_at: new Date().toISOString(),
    reviewed_by: adminId
  })
  .eq('id', verificationId);

// Update user role
await supabase
  .from('users')
  .update({ role: 'owner' })
  .eq('id', userId);
```

## Payment Gateway Configuration

```typescript
interface PaymentSettings {
  gateway: 'stripe' | 'telebirr' | 'chapa' | 'mpesa' | 'cbe';
  enabled: boolean;
  sandbox_mode: boolean;
  api_key?: string;
  secret_key?: string;
  webhook_url?: string;
  commission_rate: number;
}
```

## Withdrawal Management

```typescript
interface WithdrawalRequest {
  id: string;
  seller_id: string;
  amount: number;
  currency: 'ETB' | 'USD';
  payment_method: string;
  account_details: object;
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  requested_at: string;
  processed_at?: string;
}

// Process withdrawal
await supabase
  .from('withdrawals')
  .update({
    status: 'completed',
    processed_at: new Date().toISOString()
  })
  .eq('id', withdrawalId);
```

## Platform Analytics

### Revenue Report
```typescript
const { data } = await supabase
  .from('orders')
  .select('total, commission, created_at')
  .gte('created_at', startDate)
  .lte('created_at', endDate);

const totalRevenue = data.reduce((sum, order) => sum + order.total, 0);
const platformCommission = data.reduce((sum, order) => sum + order.commission, 0);
```

### User Growth
```typescript
const { data } = await supabase
  .from('users')
  .select('created_at, role')
  .gte('created_at', startDate);

const newCustomers = data.filter(u => u.role === 'customer').length;
const newSellers = data.filter(u => u.role === 'owner').length;
```

## Security Considerations

- All admin routes protected by middleware
- Admin actions logged for audit
- Sensitive operations require confirmation
- Rate limiting on admin APIs
