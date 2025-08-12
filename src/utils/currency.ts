export function formatETB(amount: number): string {
  return new Intl.NumberFormat('en-ET', {
    style: 'currency',
    currency: 'ETB',
    currencyDisplay: 'code',
    minimumFractionDigits: 2
  }).format(amount);
}

export function convertUSDtoETB(usdAmount: number): number {
  // Current rate is approximately 1 USD = 55 ETB (you should update this regularly)
  const rate = 55;
  return Math.round(usdAmount * rate);
}

/**
 * Format a number as Ethiopian Birr (ETB) currency
 */
export const formatCurrency = (amount: number | null | undefined): string => {
  const value = amount ?? 0;
  return value.toLocaleString('en-ET', {
    style: 'currency',
    currency: 'ETB',
    currencyDisplay: 'code',
    minimumFractionDigits: 2
  });
}; 