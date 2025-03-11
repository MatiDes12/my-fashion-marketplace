export async function createTelebirrOrder(params: {
  title: string;
  amount: number;
  sellerId: string;
}) {
  const response = await fetch('/api/telebirr/create-order', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create order');
  }

  const data = await response.json();
  return data.url;
} 