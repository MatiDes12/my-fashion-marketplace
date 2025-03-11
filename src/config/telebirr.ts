export const telebirrConfig = {
  baseUrl: process.env.NEXT_PUBLIC_TELEBIRR_API_URL || 'https://developerportal.ethiotelebirr.et:38443/apiaccess/payment/gateway',
  webBaseUrl: process.env.NEXT_PUBLIC_TELEBIRR_WEB_URL || 'https://developerportal.ethiotelebirr.et:38443/apiaccess/payment/gateway/ammwebfront',
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