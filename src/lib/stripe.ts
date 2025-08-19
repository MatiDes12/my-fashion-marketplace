import Stripe from 'stripe';

// Server-side Stripe instance (only for API routes)
export const stripe = typeof window === 'undefined' 
  ? new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2025-07-30.basil',
    })
  : null;

// Client-side Stripe instance
export const getStripePromise = () => {
  if (typeof window !== 'undefined') {
    const { loadStripe } = require('@stripe/stripe-js');
    return loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
  }
  return null;
};

// Currency conversion rates (you might want to fetch these from an API)
const CURRENCY_RATES = {
  ETB_TO_USD: 0.0071, // 1 ETB = 0.0071 USD (current rate)
  USD_TO_ETB: 140.85, // 1 USD = 140.85 ETB (current rate)
};

// Convert ETB to USD for Stripe payments
export const convertETBToUSD = (amountInETB: number): number => {
  return amountInETB * CURRENCY_RATES.ETB_TO_USD; // Don't round here, let Stripe handle precision
};

// Convert USD back to ETB for display purposes
export const convertUSDToETB = (amountInUSD: number): number => {
  return Math.round(amountInUSD * CURRENCY_RATES.USD_TO_ETB * 100) / 100;
};

// Format amount for Stripe (in cents)
export const formatAmountForStripe = (amountInUSD: number): number => {
  return Math.round(amountInUSD * 100); // Stripe expects amounts in cents
};

// Format amount from Stripe (from cents to dollars)
export const formatAmountFromStripe = (amountInCents: number): number => {
  return amountInCents / 100;
};

export default stripe;
