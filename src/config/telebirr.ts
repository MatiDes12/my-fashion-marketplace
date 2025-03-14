export const telebirrConfig = {
  // API Base URL for token and preOrder endpoints
  baseUrl: process.env.NEXT_PUBLIC_TELEBIRR_BASE_URL || 'https://portal.ethiomobilemoney.et:5118/payment/',
  
  // Web URL for checkout page (where users enter their PIN)
  webBaseUrl: 'https://portal.ethiomobilemoney.et:5118/payment/',
  
  endpoints: {
    token: '/payment/v1/token',
    preOrder: '/payment/v1/merchant/preOrder',
    requestOtp: '/payment/v1/request-otp',
    verifyOtp: '/payment/v1/verify-otp',
    notify: '/payment/v1/notify'
  },
  // These will come from the seller's settings in database
  defaultConfig: {
    timeout_express: '120m',
    trans_currency: 'ETB',
    business_type: 'BuyGoods',
    payee_identifier_type: '04',
    payee_type: '5000',
  },
  
  // Update validation to only check merchant-specific fields
  validateConfig(config: any) {
    const required = [
      'fabricAppId',
      'appSecret',
      'merchantAppId',
      'shortCode',
      'privateKey',
      'notifyUrl',
      'redirectUrl'
    ];
    
    const missing = required.filter(key => !config[key]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required merchant config: ${missing.join(', ')}`);
    }
    return true;
  }
};

// Remove the auto-validation
// telebirrConfig.validate();

export interface TelebirrOrderParams {
  title: string;
  amount: number;
  merchantOrderId: string;
  notifyUrl: string;
  redirectUrl: string;
}

export const config = {
  baseUrl: process.env.NEXT_PUBLIC_TELEBIRR_API_URL,
  mockMode: process.env.NEXT_PUBLIC_MOCK_TELEBIRR === 'true',
  phoneRegex: /^((\+251)|(251)|(0))[9][0-9]{8}$/,
  testOtpCode: '123456',
  fees: {
    platform: 0.05, // 5%
    service: 0.02, // 2%
    vat: 0.15, // 15%
  }
};