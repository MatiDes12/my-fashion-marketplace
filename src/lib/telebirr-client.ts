export async function createTelebirrOrder(params: {
  title: string;
  amount: number;
  sellerId: string;
}) {
  try {
    const response = await fetch('/api/telebirr/create-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.url) {
      throw new Error('Invalid response: missing payment URL');
    }

    return data.url;
  } catch (error) {
    console.error('Telebirr payment error:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to create order');
  }
} 