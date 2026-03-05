import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

const supabase = supabaseServer;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const deliveryId = formData.get('deliveryId') as string;
    const deliveryAccountId = formData.get('deliveryAccountId') as string;

    if (!file || !deliveryId) {
      return NextResponse.json({ error: 'File and delivery ID are required' }, { status: 400 });
    }

    // Verify the delivery exists and the caller owns it
    if (!deliveryAccountId) {
      return NextResponse.json({ error: 'Delivery account ID is required' }, { status: 400 });
    }

    const { data: delivery, error: deliveryError } = await supabase
      .from('delivery_tracking')
      .select('id, delivery_account_id')
      .eq('id', deliveryId)
      .eq('delivery_account_id', deliveryAccountId)
      .single();

    if (deliveryError || !delivery) {
      return NextResponse.json({ error: 'Unauthorized - delivery not found for this account' }, { status: 403 });
    }

    // Verify the delivery account is active
    const { data: account, error: accountError } = await supabase
      .from('delivery_accounts')
      .select('is_active')
      .eq('id', deliveryAccountId)
      .single();

    if (accountError || !account?.is_active) {
      return NextResponse.json({ error: 'Delivery account is not active' }, { status: 403 });
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be less than 10MB' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'File type must be JPEG, PNG, or GIF' }, { status: 400 });
    }

    // Create a unique file path with delivery folder structure
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `${deliveryId}/${fileName}`; // Save in delivery-specific folder

    // Upload image to Supabase Storage
    const { error: uploadError, data } = await supabase.storage
      .from('delivery-proofs')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Upload error details:', uploadError);
      return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('delivery-proofs')
      .getPublicUrl(filePath);

    return NextResponse.json({
      success: true,
      url: publicUrl
    });

  } catch (error) {
    console.error('Error in upload-proof:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 