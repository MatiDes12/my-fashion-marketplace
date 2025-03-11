import { TelebirrPayment } from '@/lib/telebirr';
import { createClientComponent } from '@/lib/supabase';

// Transfer to seller
export async function transferToSeller(
  amount: number,
  sellerId: string,
  transactionId: string
) {
  const supabase = createClientComponent();
  
  // Get seller's payment settings
  const { data: sellerSettings } = await supabase
    .from('payment_settings')
    .select('telebirr_settings')
    .eq('user_id', sellerId)
    .single();

  if (!sellerSettings?.telebirr_settings.is_active) {
    throw new Error('Seller payment settings not configured');
  }

  // Transfer to seller
  const telebirr = new TelebirrPayment({
    // Use admin credentials for transfer
    appId: process.env.TELEBIRR_APP_ID,
    appSecret: process.env.TELEBIRR_APP_SECRET,
    // ... other configs
  });

  await telebirr.transfer({
    amount,
    recipientNumber: sellerSettings.telebirr_settings.telebirr_number,
    recipientName: sellerSettings.telebirr_settings.telebirr_name,
    description: `Payout for transaction ${transactionId}`
  });

  // Update transaction status
  await supabase
    .from('transactions')
    .update({ seller_payout_status: 'completed' })
    .eq('id', transactionId);
}

// Transfer to admin
export async function transferToAdmin(
  amount: number,
  transactionId: string
) {
  const supabase = createClientComponent();
  
  // Get admin payment settings
  const { data: adminSettings } = await supabase
    .from('admin_payment_settings')
    .select('*')
    .single();

  if (!adminSettings?.is_active) {
    throw new Error('Admin payment settings not configured');
  }

  // Transfer platform revenue
  const telebirr = new TelebirrPayment({
    // Use admin credentials
    appId: process.env.TELEBIRR_APP_ID,
    appSecret: process.env.TELEBIRR_APP_SECRET,
    // ... other configs
  });

  await telebirr.transfer({
    amount,
    recipientNumber: adminSettings.telebirr_number,
    recipientName: adminSettings.telebirr_name,
    description: `Platform revenue for transaction ${transactionId}`
  });

  // Update transaction status
  await supabase
    .from('transactions')
    .update({ platform_payout_status: 'completed' })
    .eq('id', transactionId);
} 