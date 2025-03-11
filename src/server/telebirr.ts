import { signRequestObject, createNonceStr, createTimeStamp } from '@/utils/telebirr-utils';
import { telebirrConfig } from '@/config/telebirr';
import request, { CoreOptions, RequiredUriUrl } from 'request';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { Agent } from 'http';

interface TelebirrConfig {
  fabricAppId: string;
  appSecret: string;
  merchantAppId: string;
  shortCode: string;
  privateKey: string;
  notifyUrl: string;
  redirectUrl: string;
}

type RequestOptions = RequiredUriUrl & CoreOptions & {
  method: string;
  url: string;
  headers: {
    'Content-Type': string;
    'X-APP-Key': string;
    'Authorization'?: string;
  };
  body: string;
};

export class TelebirrPayment {
  private config: TelebirrConfig;

  constructor(config: TelebirrConfig) {
    this.validateConfig(config);
    this.config = config;
  }

  private validateConfig(config: TelebirrConfig) {
    const requiredFields: (keyof TelebirrConfig)[] = [
      'fabricAppId',
      'appSecret',
      'merchantAppId',
      'shortCode',
      'privateKey',
      'notifyUrl',
      'redirectUrl'
    ];

    const missingFields = requiredFields.filter(field => !config[field]);
    if (missingFields.length > 0) {
      throw new Error(`Missing required configuration fields: ${missingFields.join(', ')}`);
    }
  }

  private async getFabricToken(): Promise<string> {
    return new Promise((resolve, reject) => {
      const options: RequestOptions = {
        method: 'POST',
        url: `${telebirrConfig.baseUrl}${telebirrConfig.endpoints.token}`,
        headers: {
          'Content-Type': 'application/json',
          'X-APP-Key': this.config.fabricAppId,
        },
        rejectUnauthorized: false,
        agent: undefined,
        body: JSON.stringify({
          appSecret: this.config.appSecret,
        }),
      };

      request(options, function (error, response) {
        if (error) {
          console.error('Token request error:', error);
          reject(error);
          return;
        }

        try {
          const result = JSON.parse(response.body);
          if (!result.token) {
            reject(new Error('Invalid token response'));
            return;
          }
          resolve(result.token);
        } catch (parseError) {
          console.error('Token parse error:', parseError);
          reject(parseError);
        }
      });
    });
  }

  private async makeRequest(requestObject: any, token: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const options: RequestOptions = {
        method: 'POST',
        url: `${telebirrConfig.baseUrl}${telebirrConfig.endpoints.preOrder}`,
        headers: {
          'Content-Type': 'application/json',
          'X-APP-Key': this.config.fabricAppId,
          'Authorization': `Bearer ${token}`
        },
        rejectUnauthorized: false,
        agent: undefined,
        body: JSON.stringify(requestObject)
      };

      request(options, function (error, response) {
        if (error) {
          console.error('Order request error:', error);
          reject(error);
          return;
        }

        try {
          const result = JSON.parse(response.body);
          if (result.code !== '0') {
            reject(new Error(result.msg || 'Failed to create order'));
            return;
          }
          resolve(result);
        } catch (parseError) {
          console.error('Order response parse error:', parseError);
          reject(parseError);
        }
      });
    });
  }

  public async createOrder(params: {
    title: string;
    total_amount: number;
    merch_order_id: string;
    callback_info?: string;
  }) {
    try {
      // Get token first
      const fabricToken = await this.getFabricToken();
      
      // Create request object exactly like the demo
      const reqObject = {
        timestamp: createTimeStamp(),
        nonce_str: createNonceStr(),
        method: 'payment.preorder',
        version: '1.0',
        biz_content: {
          notify_url: this.config.notifyUrl,
          appid: this.config.merchantAppId,
          merch_code: this.config.shortCode,
          merch_order_id: params.merch_order_id,
          trade_type: 'Checkout',
          title: params.title,
          total_amount: params.total_amount.toFixed(2),
          trans_currency: 'ETB',
          timeout_express: '120m',
          business_type: 'BuyGoods',
          payee_identifier: this.config.shortCode,
          payee_identifier_type: '04',
          payee_type: '5000',
          redirect_url: this.config.redirectUrl,
          callback_info: params.callback_info || '',
        }
      };

      // Sign the request
      const signature = signRequestObject(reqObject, this.config.privateKey);
      const finalRequest = {
        ...reqObject,
        sign: signature,
        sign_type: 'SHA256WithRSA'
      };

      // Make the request using the same format as demo
      const result = await this.makeRequest(finalRequest, fabricToken);
      
      // Create and return the checkout URL
      return this.createCheckoutUrl(result.biz_content.prepay_id);

    } catch (error) {
      console.error('Telebirr payment error:', error);
      throw error;
    }
  }

  private createCheckoutUrl(prepayId: string): string {
    const params = {
      appid: this.config.merchantAppId,
      merch_code: this.config.shortCode,
      nonce_str: createNonceStr(),
      prepay_id: prepayId,
      timestamp: createTimeStamp(),
    };

    const signature = signRequestObject(params, this.config.privateKey);
    
    const queryString = [
      `appid=${params.appid}`,
      `merch_code=${params.merch_code}`,
      `nonce_str=${params.nonce_str}`,
      `prepay_id=${params.prepay_id}`,
      `timestamp=${params.timestamp}`,
      `sign=${signature}`,
      'sign_type=SHA256WithRSA',
      'version=1.0',
      'trade_type=Checkout'
    ].join('&');

    return `${telebirrConfig.webBaseUrl}?${queryString}`;
  }
} 