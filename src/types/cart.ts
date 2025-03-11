export interface CartItem {
  id: string;
  product_id: string;
  quantity: number;
  price: number;
  delivery_fee: number | null;
  product: {
    id: string;
    title: string;
    description: string;
    price: number;
    owner: {
      id: string;
      full_name: string;
      payment_settings?: {
        telebirr_settings?: {
          is_active: boolean;
          app_secret: string;
          notify_url: string;
          short_code: string;
          private_key: string;
          redirect_url: string;
          fabric_app_id: string;
          merchant_app_id: string;
        };
      };
    };
  };
} 