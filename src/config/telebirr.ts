export const telebirrConfig = {
  // API Base URL for token and preOrder endpoints
  baseUrl: 'https://portal.ethiomobilemoney.et:5118/payment/',
  
  // Web URL for checkout page (where users enter their PIN)
  webBaseUrl: 'https://portal.ethiomobilemoney.et:5118/payment/',
  
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