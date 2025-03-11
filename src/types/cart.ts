export interface CartItem {
  id: string;
  user_id: string;
  product_id: string;
  quantity: number;
  price: number;
  delivery_fee?: number;
  product?: {
    id: string;
    title: string;
    description: string;
    price: number;
    owner?: {
      id: string;
      full_name: string;
      store_settings?: {
        name?: string;
      };
      payment_settings?: {
        telebirr_settings?: {
          is_active: boolean;
        };
      };
    };
    images?: {
      image_url: string;
    }[];
  };
}

export interface SellerOrder {
  id: string;
  name: string;
  hasPaymentSettings: boolean;
  subtotal: number;
  platformFee: number;
  serviceFee: number;
  ethiopiaTax: number;
  deliveryFee: number;
  total: number;
  items: CartItem[];
} 