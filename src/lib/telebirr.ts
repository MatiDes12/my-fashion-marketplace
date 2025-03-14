import { signRequestObject, createNonceStr, createTimeStamp, generateTelebirrSignature } from '@/utils/telebirr-utils';
import { telebirrConfig } from '@/config/telebirr';
import { config, getTelebirrBaseUrl } from '@/config/env';
import { createClientComponent } from '@/lib/supabase';
import axios from 'axios';
import crypto from 'crypto';

interface TelebirrConfig {
  merchantAppId: string;
  fabricAppId: string;
  appSecret: string;
  privateKey: string;
  shortCode: string;
  notifyUrl: string;
  redirectUrl: string;
}

interface TelebirrError extends Error {
  code?: string;
  details?: string;
}

interface RequestOptions {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
  rejectUnauthorized?: boolean;
  agent?: any;
}

interface TransferParams {
  amount: number;
  recipientNumber: string;
  recipientName: string;
  description: string;
  merchantOrderId: string;
}

interface OTPRequest {
  phoneNumber: string;
  amount: number;
  orderId: string;
  description: string;
  shortCode: string;
}

interface OTPVerification {
  phoneNumber: string;
  otpCode: string;
  otpReference: string;
  amount: number;
  orderId: string;
}

interface TelebirrPaymentResponse {
  success: boolean;
  message?: string;
  otpReference?: string;
  paymentUrl?: string;
  error?: string;
}

export class TelebirrPayment {
  private config: TelebirrConfig;
  private baseUrl: string;
  private maxRetries: number = 3;
  private timeout: number = 30000; // 30 seconds

  constructor(config: TelebirrConfig) {
    this.config = config;
    this.baseUrl = getTelebirrBaseUrl();
  }

  private async makeRequest(endpoint: string, data: any, retryCount = 0): Promise<any> {
    try {
      // Add nonce and timestamp
      const nonce = crypto.randomBytes(16).toString('hex');
      const timestamp = Date.now().toString();

      const requestData = {
        ...data,
        nonce,
        timestamp,
      };

      // Generate signature
      const signature = generateTelebirrSignature(requestData, this.config.appSecret);

      const response = await axios({
        method: 'POST',
        url: `${this.baseUrl}${endpoint}`,
        headers: {
          'Content-Type': 'application/json',
          'App-Id': this.config.fabricAppId,
          'App-Key': this.config.appSecret,
          'X-Telebirr-Signature': signature,
          'X-Telebirr-Nonce': nonce,
          'X-Telebirr-Timestamp': timestamp,
        },
        data: requestData,
        timeout: this.timeout,
      });

      return response.data;
    } catch (error) {
      if (retryCount < this.maxRetries) {
        // Exponential backoff
        const delay = Math.pow(2, retryCount) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.makeRequest(endpoint, data, retryCount + 1);
      }

      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED' || error.response?.status === 504) {
          throw new Error('Telebirr service is temporarily unavailable. Please try again later.');
        }
        throw new Error(error.response?.data?.message || 'Failed to connect to Telebirr service');
      }
      throw error;
    }
  }

  private async getFabricToken(): Promise<string> {
    const response = await this.makeRequest(
      `${telebirrConfig.endpoints.token}`,
      { appSecret: this.config.appSecret }
    );

    if (!response.token) {
      throw new Error('Invalid token response');
    }

    return response.token;
  }

  async requestPaymentOTP(params: {
    phoneNumber: string;
    amount: number;
    orderId: string;
    description: string;
  }): Promise<TelebirrPaymentResponse> {
    try {
      const payload = {
        outTradeNo: params.orderId,
        subject: params.description,
        totalAmount: params.amount.toString(),
        shortCode: this.config.shortCode,
        notifyUrl: this.config.notifyUrl,
        returnUrl: this.config.redirectUrl,
        receiveName: 'Merchant Name',
        timeoutExpress: '30',
        nonce: Math.random().toString(36).substring(7),
        timestamp: Date.now().toString(),
      };

      const response = await this.makeRequest(
        '/payment/create',
        payload
      );

      return {
        success: true,
        otpReference: response.data.otpReference,
      };
    } catch (error) {
      console.error('Telebirr payment error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create payment',
      };
    }
  }

  async verifyPaymentOTP(params: {
    phoneNumber: string;
    otpCode: string;
    otpReference: string;
    amount: number;
    orderId: string;
  }): Promise<TelebirrPaymentResponse> {
    try {
      const payload = {
        outTradeNo: params.orderId,
        otpCode: params.otpCode,
        otpReference: params.otpReference,
      };

      const response = await this.makeRequest(
        '/payment/verify',
        payload
      );

      return {
        success: true,
        message: 'Payment successful',
      };
    } catch (error) {
      console.error('Telebirr verification error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Payment verification failed',
      };
    }
  }

  public async createOrder(params: {
    title: string;
    total_amount: number;
    merch_order_id: string;
    callback_info?: string;
  }) {
    try {
      const fabricToken = await this.getFabricToken();
      
      const reqObject = {
        timestamp: createTimeStamp(),
        nonce_str: createNonceStr(),
        method: 'payment.preorder',
        version: '1.0',
        biz_content: {
          notify_url: this.config.notifyUrl,
          appid: this.config.fabricAppId,
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

      const signature = signRequestObject(reqObject, this.config.privateKey);
      const finalRequest = {
        ...reqObject,
        sign: signature,
        sign_type: 'SHA256WithRSA'
      };

      const result = await this.makeRequest(
        '/payment/preorder',
        finalRequest
      );
      
      return this.createCheckoutUrl(result.biz_content.prepay_id);

    } catch (error) {
      console.error('Telebirr payment error:', error);
      throw error;
    }
  }

  private createCheckoutUrl(prepayId: string): string {
    const params = {
      appid: this.config.fabricAppId,
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

  private formatError(error: unknown): Error {
    if (error instanceof Error) {
      return error;
    }
    return new Error(typeof error === 'string' ? error : 'An unknown error occurred');
  }

  async createTransfer(params: TransferParams) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = Math.random().toString(36).substring(2, 15);

    const requestBody = {
      appId: this.config.fabricAppId,
      timestamp,
      nonce,
      outTradeNo: params.merchantOrderId,
      subject: params.description,
      totalAmount: params.amount.toString(),
      shortCode: this.config.shortCode,
      notifyUrl: this.config.notifyUrl,
      returnUrl: this.config.redirectUrl,
      receiverInfo: {
        telebirrNumber: params.recipientNumber,
        receiverName: params.recipientName
      }
    };

    const signature = signRequestObject(requestBody, this.config.privateKey);

    const response = await fetch(`${this.baseUrl}/transfer/v1/transfer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-APP-Key': this.config.fabricAppId,
      },
      body: JSON.stringify({
        ...requestBody,
        sign: signature,
        sign_type: 'SHA256withRSA'
      })
    });

    if (!response.ok) {
      throw new Error(`Transfer failed: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.code !== '0') {
      throw new Error(`Transfer failed: ${data.message}`);
    }

    return {
      transactionId: data.transactionId,
      status: data.status,
      message: data.message
    };
  }

  async verifyTransfer(merchantOrderId: string) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = Math.random().toString(36).substring(2, 15);

    const requestBody = {
      appId: this.config.fabricAppId,
      timestamp,
      nonce,
      outTradeNo: merchantOrderId,
      shortCode: this.config.shortCode
    };

    const signature = signRequestObject(requestBody, this.config.privateKey);

    const response = await fetch(`${this.baseUrl}/transfer/v1/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-APP-Key': this.config.fabricAppId,
      },
      body: JSON.stringify({
        ...requestBody,
        sign: signature,
        sign_type: 'SHA256withRSA'
      })
    });

    if (!response.ok) {
      throw new Error(`Transfer verification failed: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      status: data.status,
      transactionId: data.transactionId,
      message: data.message
    };
  }
}

export async function getTelebirrConfig(sellerId?: string): Promise<TelebirrConfig> {
  const supabase = createClientComponent();

  try {
    if (sellerId) {
      const { data: sellerSettings, error: sellerError } = await supabase
        .from('payment_settings')
        .select('telebirr_settings')
        .eq('user_id', sellerId)
        .single();

      if (sellerError || !sellerSettings?.telebirr_settings?.is_active) {
        throw new Error('Seller payment settings not found or inactive');
      }

      return {
        merchantAppId: sellerSettings.telebirr_settings.merchant_app_id,
        fabricAppId: sellerSettings.telebirr_settings.fabric_app_id,
        appSecret: sellerSettings.telebirr_settings.app_secret,
        privateKey: sellerSettings.telebirr_settings.private_key,
        shortCode: sellerSettings.telebirr_settings.short_code,
        notifyUrl: sellerSettings.telebirr_settings.notify_url,
        redirectUrl: sellerSettings.telebirr_settings.redirect_url,
      };
    } else {
      const { data: adminSettings, error: adminError } = await supabase
        .from('admin_payment_settings')
        .select('*')
        .eq('is_active', true)
        .single();

      if (adminError || !adminSettings) {
        throw new Error('Admin payment settings not found');
      }

      return {
        merchantAppId: adminSettings.merchant_app_id,
        fabricAppId: adminSettings.fabric_app_id,
        appSecret: adminSettings.app_secret,
        privateKey: adminSettings.private_key,
        shortCode: adminSettings.short_code,
        notifyUrl: adminSettings.notify_url,
        redirectUrl: adminSettings.redirect_url,
      };
    }
  } catch (error) {
    console.error('Error getting Telebirr config:', error);
    throw error;
  }
}

export type { TelebirrConfig, TelebirrPaymentResponse }; 