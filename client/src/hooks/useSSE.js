import { useState, useEffect } from 'react';

export function useSSE(productId, initialStock = 500) {
  const [stock, setStock] = useState(initialStock);

  useEffect(() => {
    if (!productId) return;

    const source = new EventSource(`/api/products/${productId}/stock/sse`);

    source.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (typeof data.stock === 'number') {
          setStock(data.stock);
        }
      } catch (err) {}
    };

    return () => {
      source.close();
    };
  }, [productId]);

  return { stock, setStock };
}
