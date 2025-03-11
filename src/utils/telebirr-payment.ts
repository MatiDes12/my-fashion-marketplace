interface TelebirrConfig {
  merchant_code: string;
  app_id: string;
  app_key: string;
  public_key: string;
  private_key: string;
  notify_url: string;
  redirect_url: string;
}

interface TransferParams {
  amount: number;
  recipient: string;
  description: string;
}

interface NotificationData {
  outTradeNo: string;
  signature: string;
  // Add other notification fields as needed
}

export class TelebirrPayment {
  private config: TelebirrConfig;

  constructor(config: TelebirrConfig) {
    this.config = config;
  }

  async getToken(): Promise<string> {
    try {
      const response = await fetch('/api/telebirr/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          app_id: this.config.app_id,
          app_key: this.config.app_key,
          merchant_code: this.config.merchant_code,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get token');
      }

      const data = await response.json();
      return data.token;
    } catch (error) {
      console.error('Token request error:', error);
      throw error;
    }
  }

  async transfer(params: TransferParams) {
    try {
      const response = await fetch('/api/telebirr/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...params,
          merchant_code: this.config.merchant_code,
          app_id: this.config.app_id,
          app_key: this.config.app_key,
          notify_url: this.config.notify_url,
          redirect_url: this.config.redirect_url,
        }),
      });

      if (!response.ok) {
        throw new Error('Transfer request failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Telebirr transfer error:', error);
      throw error;
    }
  }

  async verifyNotification(notification: NotificationData): Promise<boolean> {
    try {
      const response = await fetch('/api/telebirr/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...notification,
          merchant_code: this.config.merchant_code,
          app_id: this.config.app_id,
          public_key: this.config.public_key,
        }),
      });

      if (!response.ok) {
        throw new Error('Verification request failed');
      }

      const result = await response.json();
      return result.isValid;
    } catch (error) {
      console.error('Notification verification error:', error);
      return false;
    }
  }
} 