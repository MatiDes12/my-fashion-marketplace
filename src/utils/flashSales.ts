import { createClientComponent } from '@/lib/supabase';

export async function getActiveFlashSale() {
  const supabase = createClientComponent();
  const now = new Date().toISOString();

  const { data } = await supabase
    .from('flash_sales')
    .select('*')
    .eq('is_active', true)
    .lte('start_time', now)
    .gte('end_time', now)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return data;
}

export async function getFlashSalePrices(productIds: string[]) {
  const supabase = createClientComponent();
  const now = new Date().toISOString();

  console.log('Current time:', now);
  console.log('Fetching flash sales for products:', productIds);

  // First, let's check what flash sales are active
  const { data: activeFlashSales, error: flashSaleError } = await supabase
    .from('flash_sales')
    .select('*')
    .eq('is_active', true);

  console.log('Active flash sales:', activeFlashSales);

  const { data, error } = await supabase
    .from('flash_sale_products')
    .select(`
      product_id,
      special_price,
      flash_sales!inner (
        id,
        discount_percentage,
        start_time,
        end_time,
        is_active
      )
    `)
    .in('product_id', productIds)
    .eq('flash_sales.is_active', true)
    .gte('flash_sales.end_time', now)    // end time is in the future
    .lte('flash_sales.start_time', now); // start time is in the past or now

  if (error) {
    console.error('Error fetching flash sales:', error);
    return {};
  }

  console.log('Flash sales data:', data);

  if (!data || data.length === 0) return {};

  // Create a map of product IDs to their flash sale prices
  const flashSalePrices: Record<string, number> = {};
  data.forEach(item => {
    // Only update if the new price is lower than any existing sale price
    if (!flashSalePrices[item.product_id] || 
        flashSalePrices[item.product_id] > item.special_price) {
      flashSalePrices[item.product_id] = item.special_price;
    }
  });

  console.log('Final flash sale prices:', flashSalePrices);
  return flashSalePrices;
}

export async function getAllActiveFlashSales() {
  const supabase = createClientComponent();
  const now = new Date().toISOString();

  const { data } = await supabase
    .from('flash_sales')
    .select(`
      id,
      title,
      description,
      discount_percentage,
      start_time,
      end_time,
      store_id,
      store_name,
      flash_sale_products!inner (
        id,
        product_id,
        special_price,
        products (
          id,
          title,
          price,
          product_images (
            id,
            image_url
          )
        )
      )
    `)
    .eq('is_active', true)
    .lte('start_time', now)
    .gte('end_time', now)
    .order('created_at', { ascending: false });

  return data || [];
} 