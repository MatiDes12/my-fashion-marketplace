export interface CartItem {
  id: string;
  user_id: string;
  product_id: string;
  quantity: number;
  created_at: string;
  updated_at: string;
  price: number;
  delivery_fee: number | null;
  delivery_method: 'delivery' | 'pickup' | null;
  flash_sale_price?: number | null;
  product: {
    id: string;
    title: string;
    price: number;
    delivery_fee: number;
    delivery_options: {
      pickup: boolean;
      delivery: boolean;
      delivery_time: string | null;
      pickup_location: string | null;
    };
    shipping_info: {
      return_policy: string;
      processing_time: string;
      shipping_options: any[];
    };
    delivery_time: string | null;
    images: {
      id: string;
      image_url: string;
      is_model_picture: boolean;
    }[];
    owner: {
      id: string;
      full_name: string;
      store_settings?: {
        name: string;
        email: string;
        phone: string;
        address: any;
      };
      payment_settings?: PaymentSettings;
    };
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

interface StoreAddress {
  city: string;
  kebele: string;
  wereda: string;
  houseNo: string;
  subCity: string;
  landmark?: string;
  mapLink?: string;
}

interface OwnerStoreSettings {
  seo?: {
    keywords: string;
    metaTitle: string;
    metaDescription: string;
  };
  name: string;
  email: string;
  phone: string;
  address: StoreAddress;
}

interface CustomerStoreSettings {
  phone: string;
  address: StoreAddress;
  preferred_language?: string;
}

interface User {
  id: string;
  role: 'owner' | 'customer';
  store_settings: OwnerStoreSettings | CustomerStoreSettings;
}

interface PaymentSettings {
  telebirr_settings?: {
    is_active: boolean;
    merchant_id?: string;
    api_key?: string;
  };
  bank_settings?: {
    is_active: boolean;
  };
  cbe_birr_settings?: {
    is_active: boolean;
  };
  amole_settings?: {
    is_active: boolean;
  };
  chapa_settings?: {
    is_active: boolean;
    public_key?: string;
    secret_key?: string;
    callback_url?: string;
  };
}

export type { PaymentSettings }; 