import { useState, useEffect } from 'react';

/**
 * useSSE Hook
 * Connects to Server-Sent Events stream for live stock updates
 */
export function useSSE(productId, initialStock = 500) {
  const [stock, setStock] = useState(initialStock);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!productId) return;

    const eventSource = new EventSource(`/api/products/${productId}/stock/sse`);

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (typeof data.stock === 'number') {
          setStock(data.stock);
        }
      } catch (err) {
        console.error('Failed to parse SSE event data', err);
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      // Auto-reconnect is handled natively by EventSource
    };

    return () => {
      eventSource.close();
    };
  }, [productId]);

  return { stock, setStock, isConnected };
}
