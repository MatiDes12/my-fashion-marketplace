// Mock implementation - replace with actual Telebirr API integration
export async function transferToSeller(
  amount: number,
  sellerId: string,
  transactionId: string
) {
  // TODO: Implement actual Telebirr API call
  console.log(`Transferring ${amount} to seller ${sellerId} for transaction ${transactionId}`);
}

export async function transferToAdmin(
  amount: number,
  transactionId: string
) {
  // TODO: Implement actual Telebirr API call
  console.log(`Transferring ${amount} to admin for transaction ${transactionId}`);
} 