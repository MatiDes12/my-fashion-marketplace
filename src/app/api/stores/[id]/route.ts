import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Create a Supabase client with the service role key
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Check if environment variables are defined
if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
}

const supabaseAdmin = createClient(
  supabaseUrl || '',
  supabaseServiceKey || ''
);

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    
    console.log('API: Fetching store data for ID:', id);
    
    if (!id) {
      return NextResponse.json(
        { message: 'Store ID is required' },
        { status: 400 }
      );
    }
    
    // Fetch the store owner using the service role client
    const { data: owner, error: ownerError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', id)
      .eq('role', 'owner')
      .single();
    
    if (ownerError) {
      console.error('API: Owner error:', ownerError);
      return NextResponse.json(
        { message: `Store not found. ID: ${id}`, error: ownerError },
        { status: 404 }
      );
    }
    
    // Fetch products for this owner
    const { data: products, error: productsError } = await supabaseAdmin
      .from('products')
      .select(`
        *,
        product_images (*)
      `)
      .eq('owner_id', id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    
    if (productsError) {
      console.error('API: Products error:', productsError);
    }
    
    console.log('API: Successfully fetched store data');
    
    return NextResponse.json({
      owner,
      products: products || [],
    });
    
  } catch (error) {
    console.error('API: Error in store API:', error);
    return NextResponse.json(
      { message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
} 