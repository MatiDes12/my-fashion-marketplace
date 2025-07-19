import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Create a Supabase client with service role for admin operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const deliveryId = formData.get('deliveryId') as string;

    if (!file || !deliveryId) {
      return NextResponse.json({ error: 'File and delivery ID are required' }, { status: 400 });
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

    // Create a unique file path
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `delivery-proofs/${fileName}`;

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