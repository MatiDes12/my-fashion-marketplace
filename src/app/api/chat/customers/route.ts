import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sellerId = searchParams.get('sellerId');

    if (!sellerId) {
      return NextResponse.json({ error: 'Seller ID is required' }, { status: 400 });
    }

    const supabase = createRouteHandlerClient({ cookies });

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify the current user is the seller
    if (user.id !== sellerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get customers who have bought products from this seller
    const { data: customers, error } = await supabase
      .from('orders')
      .select(`
        user_id,
        products!orders_product_id_fkey(
          owner_id
        )
      `)
      .eq('products.owner_id', sellerId)
      .not('user_id', 'eq', sellerId);

    if (error) {
      console.error('Error fetching customers:', error);
      return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 });
    }

    // Get unique customer IDs
    const uniqueCustomerIds = [...new Set(customers.map(order => order.user_id))];

    // Get customer details with chat status
    const { data: customerDetails, error: customerError } = await supabase
      .from('users')
      .select(`
        id,
        email,
        full_name,
        created_at,
        user_chat_status(
          is_online,
          last_seen
        )
      `)
      .in('id', uniqueCustomerIds)
      .eq('role', 'customer');

    if (customerError) {
      console.error('Error fetching customer details:', customerError);
      return NextResponse.json({ error: 'Failed to fetch customer details' }, { status: 500 });
    }

    // Format customer data
    const uniqueCustomers = customerDetails?.map(customer => ({
      ...customer,
      user_chat_status: customer.user_chat_status?.[0] || { is_online: false, last_seen: new Date().toISOString() }
    })) || [];

    return NextResponse.json({ customers: uniqueCustomers });

  } catch (error) {
    console.error('Error in customers API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 