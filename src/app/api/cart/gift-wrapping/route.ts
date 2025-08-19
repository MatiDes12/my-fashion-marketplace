// Gift Wrapping API - DISABLED
// import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
// import { cookies } from 'next/headers';
// import { NextRequest, NextResponse } from 'next/server';

// export async function GET() {
//   try {
//     const supabase = createRouteHandlerClient({ cookies });
    
//     // Get all active gift wrapping options
//     const { data: options, error } = await supabase
//       .from('gift_wrapping_options')
//       .select('*')
//       .eq('is_active', true)
//       .order('price', { ascending: true });

//     if (error) {
//       throw error;
//     }

//     return NextResponse.json({ options });

//   } catch (error) {
//     console.error('Error fetching gift wrapping options:', error);
//     return NextResponse.json(
//       { error: 'Failed to fetch gift wrapping options' },
//       { status: 500 }
//     );
//   }
// }

// export async function POST(request: NextRequest) {
//   try {
//     const supabase = createRouteHandlerClient({ cookies });
    
//     // Check authentication
//     const { data: { session } } = await supabase.auth.getSession();
//     if (!session) {
//       return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
//     }

//     const { cartItemId, giftWrapping, giftMessage, wrappingOptionId } = await request.json();

//     if (!cartItemId) {
//       return NextResponse.json({ error: 'Cart item ID is required' }, { status: 400 });
//     }

//     // Get the cart item
//     const { data: cartItem, error: fetchError } = await supabase
//       .from('cart_items')
//       .select('*')
//       .eq('id', cartItemId)
//       .eq('user_id', session.user.id)
//       .single();

//     if (fetchError || !cartItem) {
//       return NextResponse.json({ error: 'Cart item not found' }, { status: 404 });
//     }

//     let giftWrappingFee = 0;

//     // If gift wrapping is enabled, get the wrapping option
//     if (giftWrapping && wrappingOptionId) {
//       const { data: wrappingOption, error: wrappingError } = await supabase
//       .from('gift_wrapping_options')
//       .select('*')
//       .eq('id', wrappingOptionId)
//       .eq('is_active', true)
//       .single();

//       if (wrappingError || !wrappingOption) {
//         return NextResponse.json({ error: 'Invalid gift wrapping option' }, { status: 400 });
//       }

//       giftWrappingFee = wrappingOption.price;
//     }

//     // Update cart item with gift wrapping details
//     const { error: updateError } = await supabase
//       .from('cart_items')
//       .update({
//         gift_wrapping: giftWrapping || false,
//         gift_message: giftMessage || null,
//         gift_wrapping_fee: giftWrappingFee
//       })
//       .eq('id', cartItemId)
//       .eq('user_id', session.user.id);

//     if (updateError) {
//       throw updateError;
//     }

//     return NextResponse.json({ 
//       success: true, 
//       message: giftWrapping ? 'Gift wrapping added' : 'Gift wrapping removed',
//       giftWrappingFee
//     });

//   } catch (error) {
//     console.error('Error updating gift wrapping:', error);
//     return NextResponse.json(
//       { error: 'Failed to update gift wrapping' },
//       { status: 500 }
//     );
//   }
// }

// Export empty object to make this a valid module
export {};
