import { createRouteClient } from '@/lib/supabase-route';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createRouteClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { cartItemId } = await request.json();

    if (!cartItemId) {
      return NextResponse.json({ error: 'Cart item ID is required' }, { status: 400 });
    }

    // Get the cart item
    const { data: cartItem, error: fetchError } = await supabase
      .from('cart_items')
      .select('id, saved_for_later')
      .eq('id', cartItemId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !cartItem) {
      return NextResponse.json({ error: 'Cart item not found' }, { status: 404 });
    }

    // Check if item is already saved for later
    if (cartItem.saved_for_later) {
      return NextResponse.json({ error: 'Item is already saved for later' }, { status: 400 });
    }

    // Move item to saved for later
    const { error: updateError } = await supabase
      .from('cart_items')
      .update({ saved_for_later: true })
      .eq('id', cartItemId)
      .eq('user_id', user.id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Item saved for later' 
    });

  } catch (error) {
    console.error('Error saving item for later:', error);
    return NextResponse.json(
      { error: 'Failed to save item for later' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createRouteClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { cartItemId } = await request.json();

    if (!cartItemId) {
      return NextResponse.json({ error: 'Cart item ID is required' }, { status: 400 });
    }

    // Move item back to active cart
    const { error: updateError } = await supabase
      .from('cart_items')
      .update({ saved_for_later: false })
      .eq('id', cartItemId)
      .eq('user_id', user.id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Item moved back to cart' 
    });

  } catch (error) {
    console.error('Error moving item back to cart:', error);
    return NextResponse.json(
      { error: 'Failed to move item back to cart' },
      { status: 500 }
    );
  }
}
