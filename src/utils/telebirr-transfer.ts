import { TelebirrPayment } from '@/lib/telebirr';
import { createClientComponent } from '@/lib/supabase';

// Transfer to seller
export async function transferToSeller(
  amount: number,
  sellerId: string,
  transactionId: string
) {
  const supabase = createClientComponent();
  
  // Get admin's payment settings (we use admin's credentials to send money)
  const { data: adminSettings } = await supabase
    .from('admin_payment_settings')
    .select('*')
    .single();

  if (!adminSettings) {
    throw new Error('Admin payment settings not configured');
  }

  // Get seller's Telebirr number to send to
  const { data: sellerSettings } = await supabase
    .from('payment_settings')
    .select('telebirr_settings')
    .eq('user_id', sellerId)
    .single();

  if (!sellerSettings?.telebirr_settings.is_active) {
    throw new Error('Seller payment settings not configured');
  }

  // Initialize Telebirr with admin credentials
  const telebirr = new TelebirrPayment({
    merchantAppId: adminSettings.merchant_app_id,
    fabricAppId: adminSettings.fabric_app_id,
    appSecret: adminSettings.app_secret,
    privateKey: adminSettings.private_key,
    shortCode: adminSettings.short_code,
    notifyUrl: adminSettings.notify_url,
    redirectUrl: adminSettings.redirect_url
  });

  // Transfer to seller using admin's account
  const result = await telebirr.createTransfer({
    amount,
    recipientNumber: sellerSettings.telebirr_settings.telebirr_number,
    recipientName: sellerSettings.telebirr_settings.telebirr_name,
    description: `Payout for transaction ${transactionId}`,
    merchantOrderId: `PAYOUT-${transactionId}`
  });

  // Update transaction status
  await supabase
    .from('transactions')
    .update({ 
      seller_payout_status: 'completed',
      seller_payout_reference: result.transactionId
    })
    .eq('id', transactionId);

  return result;
}

// Transfer platform fees to admin account
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

  // Initialize Telebirr with admin credentials
  const telebirr = new TelebirrPayment({
    merchantAppId: adminSettings.merchant_app_id,
    fabricAppId: adminSettings.fabric_app_id,
    appSecret: adminSettings.app_secret,
    privateKey: adminSettings.private_key,
    shortCode: adminSettings.short_code,
    notifyUrl: adminSettings.notify_url,
    redirectUrl: adminSettings.redirect_url
  });

  // Transfer platform revenue to admin's Telebirr
  const result = await telebirr.createTransfer({
    amount,
    recipientNumber: adminSettings.telebirr_number,
    recipientName: adminSettings.telebirr_name,
    description: `Platform revenue for transaction ${transactionId}`,
    merchantOrderId: `REVENUE-${transactionId}`
  });

  // Update transaction status
  await supabase
    .from('transactions')
    .update({ 
      platform_payout_status: 'completed',
      platform_payout_reference: result.transactionId
    })
    .eq('id', transactionId);

  return result;
} 