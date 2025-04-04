import { createClientComponent } from '@/lib/supabase';

// No need to define these here since we're using the API route
interface MpesaTokenResponse {
  access_token: string;
  expires_in: string;
}

interface MpesaPaymentResponse {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}

export class MpesaService {
  static async initiateSTKPush(
    phoneNumber: string,
    amount: number,
    orderId: string
  ): Promise<MpesaPaymentResponse> {
    try {
      const response = await fetch('/api/mpesa/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber,
          amount,
          orderId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to initiate payment');
      }

      return response.json();
    } catch (error) {
      console.error('Error initiating M-PESA payment:', error);
      throw error;
    }
  }

  static async checkTransactionStatus(transactionId: string): Promise<any> {
    try {
      const response = await fetch('/api/mpesa/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactionId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to check transaction status');
      }

      return response.json();
    } catch (error) {
      console.error('Error checking M-PESA transaction status:', error);
      throw error;
    }
  }
} 