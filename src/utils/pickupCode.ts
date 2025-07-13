import { createClientComponent } from '@/lib/supabase';

// Generate a random code of specified length
function generateRandomCode(length: number = 8): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Generate a unique pickup code
export async function generateUniquePickupCode(): Promise<string> {
  const supabase = createClientComponent();
  let code: string;
  let isUnique = false;
  
  // Try up to 5 times to generate a unique code
  for (let i = 0; i < 5; i++) {
    code = generateRandomCode(8);
    
    // Check if code exists
    const { data, error } = await supabase
      .from('orders')
      .select('id')
      .eq('pickup_code', code)
      .maybeSingle();
      
    if (error) throw error;
    
    if (!data) {
      isUnique = true;
      break;
    }
  }
  
  if (!isUnique) {
    throw new Error('Failed to generate unique pickup code');
  }
  
  return code!;
}

// Verify a pickup code
export async function verifyPickupCode(code: string): Promise<boolean> {
  const supabase = createClientComponent();
  
  // Find order with this pickup code
  const { data: order, error } = await supabase
    .from('orders')
    .select('*')
    .eq('pickup_code', code)
    .eq('pickup_code_verified', false)
    .single();
    
  if (error) return false;
  if (!order) return false;
  
  // Update order status
  const { error: updateError } = await supabase
    .from('orders')
    .update({
      pickup_code_verified: true,
      pickup_code_verified_at: new Date().toISOString(),
      order_status: 'picked up'
    })
    .eq('id', order.id);
    
  if (updateError) return false;
  
  return true;
} 