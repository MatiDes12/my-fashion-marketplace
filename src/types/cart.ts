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
  productId: string;
  sellerId: string;
  sellerName: string;
  product: {
    id: string;
    title: string;
    price: number;
    images?: {
      image_url: string;
    }[];
    owner?: {
      id: string;
      full_name: string;
      store_settings?: {
        name?: string;
      };
    };
  };
  quantity: number;
  total: number;
  subtotal: number;
  platformFee: number;
  serviceFee: number;
  ethiopiaTax: number;
  deliveryFee: number;
  hasPaymentSettings?: boolean;
} 