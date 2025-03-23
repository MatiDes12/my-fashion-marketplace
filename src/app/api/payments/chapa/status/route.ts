import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tx_ref = searchParams.get('tx_ref');

    if (!tx_ref) {
      throw new Error('Transaction reference is required');
    }

    // Check if any order with this tx_ref has been paid
    const { data: orders, error } = await supabase
      .from('orders')
      .select('payment_status')
      .eq('tx_ref', tx_ref)
      .single();

    if (error) {
      throw error;
    }

    return Response.json({
      status: orders?.payment_status === 'paid' ? 'success' : 'pending'
    });

  } catch (error) {
    console.error('Payment status check error:', error);
    return Response.json(
      { 
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to check payment status'
      },
      { status: 500 }
    );
  }
} 