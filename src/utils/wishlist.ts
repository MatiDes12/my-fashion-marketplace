import { createClientComponent } from '@/lib/supabase';

export const checkWishlistStatus = async (productId: string, userId: string) => {
  const supabase = createClientComponent();
  
  try {
    const { data, error } = await supabase
      .from('wishlist')
      .select('id')
      .eq('user_id', userId)
      .eq('product_id', productId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found" error
      throw error;
    }

    return !!data;
  } catch (error) {
    console.error('Error checking wishlist status:', error);
    return false;
  }
};

export const addToWishlist = async (productId: string, userId: string) => {
  const supabase = createClientComponent();
  
  try {
    const { error } = await supabase
      .from('wishlist')
      .insert({
        user_id: userId,
        product_id: productId
      });

    if (error && error.code !== '23505') { // Ignore unique constraint violation
      throw error;
    }

    return { success: true };
  } catch (error) {
    console.error('Error adding to wishlist:', error);
    return { success: false, error };
  }
};

export const removeFromWishlist = async (productId: string, userId: string) => {
  const supabase = createClientComponent();
  
  try {
    const { error } = await supabase
      .from('wishlist')
      .delete()
      .eq('user_id', userId)
      .eq('product_id', productId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error removing from wishlist:', error);
    return { success: false, error };
  }
}; 