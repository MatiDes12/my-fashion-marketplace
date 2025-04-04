import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    // Fetch store owner data
    const { data: storeOwner, error: storeError } = await supabase
      .from('users')
      .select(`
        id,
        full_name,
        email,
        store_settings,
        verification_status,
        role
      `)
      .eq('id', params.id)
      .single();

    if (storeError || !storeOwner) {
      return NextResponse.json(
        { message: 'Store not found' },
        { status: 404 }
      );
    }

    // Fetch payment settings
    const { data: paymentSettings, error: paymentError } = await supabase
      .from('payment_settings')
      .select('*')
      .eq('user_id', storeOwner.id)
      .single();

    // Fetch products
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select(`
        *,
        product_images (*)
      `)
      .eq('owner_id', storeOwner.id)
      .eq('is_active', true);

    if (productsError) {
      console.error('Error fetching products:', productsError);
    }

    // Process payment methods
    const activePaymentMethods = {
      cash: true, // Cash is always available
      TELEBIRR: paymentSettings?.telebirr_settings?.is_active || false,
      CBE: paymentSettings?.cbe_birr_settings?.is_active || false,
      AMOLE: paymentSettings?.amole_settings?.is_active || false,
      CHAPA: paymentSettings?.chapa_settings?.is_active || false,
      BANK: paymentSettings?.bank_settings?.is_active || false,
      MPESA: paymentSettings?.mpesa_settings?.is_active || false
    };

    // Include payment methods in the store settings
    const storeData = {
      owner: {
        ...storeOwner,
        store_settings: {
          ...storeOwner.store_settings,
          payment_methods: activePaymentMethods
        }
      },
      products: products || []
    };

    return NextResponse.json(storeData);

  } catch (error) {
    console.error('Error in store API route:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
} 