import { TelebirrPayment, getTelebirrConfig, type TelebirrPaymentResponse } from './telebirr';
import { getTelebirrBaseUrl, getTelebirrWebUrl } from '@/config/env';

interface TelebirrOrderParams {
  title: string;
  amount: number;
  sellerId: string;
  phoneNumber: string;
}

export async function createTelebirrOrder(params: TelebirrOrderParams): Promise<TelebirrPaymentResponse> {
  try {
    const orderId = `ORD-${Date.now()}`;
    
    // Get config and initialize Telebirr
    const config = await getTelebirrConfig(params.sellerId);
    const telebirr = new TelebirrPayment(config);
    
    const response = await telebirr.requestPaymentOTP({
      phoneNumber: params.phoneNumber,
      amount: params.amount,
      orderId,
      description: params.title,
    });

    if (response.success && response.otpReference) {
      return {
        ...response,
        paymentUrl: `${getTelebirrWebUrl()}/payment?ref=${response.otpReference}`,
      };
    }

    return response;
  } catch (error) {
    console.error('Create Telebirr order error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create order',
    };
  }
}

export async function verifyTelebirrPayment(
  phoneNumber: string,
  otpCode: string,
  otpReference: string,
  amount: number,
  orderId: string,
  sellerId: string
): Promise<TelebirrPaymentResponse> {
  try {
    // Get config and initialize Telebirr
    const config = await getTelebirrConfig(sellerId);
    const telebirr = new TelebirrPayment(config);

    const response = await telebirr.verifyPaymentOTP({
      phoneNumber,
      otpCode,
      otpReference,
      amount,
      orderId,
    });

    return response;
  } catch (error) {
    console.error('Verify payment error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Payment verification failed',
    };
  }
} 