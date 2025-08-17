// Centralized currency conversion utilities
// Update the exchange rate here for application-wide changes

export const EXCHANGE_RATES = {
  ETB_TO_USD: 0.0071, // 1 ETB = 0.0071 USD (current rate as of request)
  USD_TO_ETB: 140.85, // 1 USD = 140.85 ETB (inverse rate)
} as const;

/**
 * Format amount as Ethiopian Birr currency
 * @param amount Amount to format
 * @returns Formatted currency string (e.g., "ETB 1,234.56")
 */
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'ETB',
  }).format(amount);
};

/**
 * Format amount as Ethiopian Birr currency (alias for formatCurrency)
 * @param amount Amount to format
 * @returns Formatted currency string (e.g., "ETB 1,234.56")
 */
export const formatETB = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'ETB',
  }).format(amount);
};

/**
 * Convert Ethiopian Birr to US Dollars
 * @param amountETB Amount in Ethiopian Birr
 * @returns Amount in US Dollars (rounded to 2 decimal places)
 */
export const convertETBToUSD = (amountETB: number): number => {
  return parseFloat((amountETB * EXCHANGE_RATES.ETB_TO_USD).toFixed(2));
};

/**
 * Convert US Dollars to Ethiopian Birr
 * @param amountUSD Amount in US Dollars
 * @returns Amount in Ethiopian Birr (rounded to 2 decimal places)
 */
export const convertUSDToETB = (amountUSD: number): number => {
  return parseFloat((amountUSD * EXCHANGE_RATES.USD_TO_ETB).toFixed(2));
};

/**
 * Format currency display for dual currency scenarios
 * @param amountETB Amount in ETB
 * @param showUSD Whether to show USD equivalent
 * @param formatETB Function to format ETB amount (optional)
 * @returns Formatted currency string
 */
export const formatDualCurrency = (
  amountETB: number, 
  showUSD: boolean = false,
  formatETB?: (amount: number) => string
): string => {
  const etbFormatted = formatETB ? formatETB(amountETB) : `ETB ${amountETB.toFixed(2)}`;
  
  if (showUSD) {
    const usdAmount = convertETBToUSD(amountETB);
    return `${etbFormatted} ($${usdAmount} USD)`;
  }
  
  return etbFormatted;
};

/**
 * Get current exchange rate information
 * @returns Object containing current rates and metadata
 */
export const getExchangeRateInfo = () => ({
  etbToUsd: EXCHANGE_RATES.ETB_TO_USD,
  usdToEtb: EXCHANGE_RATES.USD_TO_ETB,
  displayRate: `1 ETB = $${EXCHANGE_RATES.ETB_TO_USD}`,
  lastUpdated: new Date().toISOString(), // In a real app, this would be the actual last update time
});

export default {
  convertETBToUSD,
  convertUSDToETB,
  formatCurrency,
  formatETB,
  formatDualCurrency,
  getExchangeRateInfo,
  EXCHANGE_RATES,
};