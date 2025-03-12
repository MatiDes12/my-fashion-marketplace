export const telebirrConfig = {
  // API Base URL for token and preOrder endpoints
  baseUrl: 'https://api.ethiomobilemoney.et:2121',
  
  // Web URL for checkout page (where users enter their PIN)
  webBaseUrl: 'https://app.ethiomobilemoney.et:2121/ammwebpay',
  
  endpoints: {
    token: '/payment/v1/token',
    preOrder: '/payment/v1/merchant/preOrder',
  },
  // These will come from the seller's settings in database
  defaultConfig: {
    timeout_express: '120m',
    trans_currency: 'ETB',
    business_type: 'BuyGoods',
    payee_identifier_type: '04',
    payee_type: '5000',
  }
};

export interface TelebirrOrderParams {
  title: string;
  amount: number;
  merchantOrderId: string;
  notifyUrl: string;
  redirectUrl: string;
}