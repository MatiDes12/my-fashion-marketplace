export async function clientLog(message: string, data?: any, level: 'info' | 'warn' | 'error' = 'info') {
  try {
    await fetch('/api/client-log', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message, level, data })
    });
  } catch (err) {
    console.error('Failed to send client log', err);
  }
}
