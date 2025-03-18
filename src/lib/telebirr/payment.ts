import { getTelebirrConfig } from './config';
import { applyFabricToken, createOrder } from './services';

interface TelebirrConfig {
  baseUrl: string;
  webBaseUrl: string;
  merchantAppId: string;
  fabricAppId: string;
  appSecret: string;
  privateKey: string;
  shortCode: string;
  notifyUrl: string;
  redirectUrl: string;
}

interface BizContent {
  notify_url: string;
  redirect_url: string;
  appid: string;
  merch_code: string;
  merch_order_id: string;
  trade_type: string;
  title: string;
  total_amount: string;
  trans_currency: string;
  timeout_express: string;
}

interface TelebirrRequest {
  timestamp: string;
  nonce_str: string;
  method: string;
  version: string;
  biz_content: BizContent;
  sign?: string;
  sign_type?: string;
}

export class TelebirrPayment {
  private config: TelebirrConfig;

  constructor(config: TelebirrConfig) {
    this.config = config;
  }

  async createOrder(params: { title: string; amount: string }) {
    const { title, amount } = params;

    // Get fabric token
    const tokenResult = await applyFabricToken({
      baseUrl: this.config.baseUrl,
      fabricAppId: this.config.fabricAppId,
      appSecret: this.config.appSecret,
    });

    // Create order and get payment URL
    const paymentUrl = await createOrder({
      config: this.config,
      fabricToken: tokenResult.token,
      title,
      amount,
    });

    return paymentUrl;
  }
} 