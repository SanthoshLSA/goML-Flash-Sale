import React, { useState } from 'react';
import StockCounter from './StockCounter';
import BuyButton from './BuyButton';
import OrderTracker from './OrderTracker';
import { useSSE } from '../hooks/useSSE';

export default function ProductCard({ product }) {
  const [activeTrackingId, setActiveTrackingId] = useState(null);
  const { stock, setStock } = useSSE(product.id, product.stock);

  const handleReset = async () => {
    try {
      const res = await fetch(`/api/products/${product.id}/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock: 500 }),
      });
      const data = await res.json();
      setStock(data.stock);
      setActiveTrackingId(null);
    } catch (err) {}
  };

  return (
    <div style={{
      maxWidth: '480px',
      margin: '0 auto',
      background: 'var(--bg-card)',
      borderRadius: '16px',
      border: '1px solid var(--border)',
      overflow: 'hidden',
    }}>
      <div style={{ height: '220px', background: '#090d16' }}>
        <img
          src={product.image_url || 'https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=800&auto=format&fit=crop&q=80'}
          alt={product.name}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>

      <div style={{ padding: '24px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>
          {product.name}
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: 1.5 }}>
          {product.description}
        </p>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '16px' }}>
          <span style={{ fontSize: '28px', fontWeight: 800, color: 'var(--accent-gold)' }}>
            ${product.price}
          </span>
          <span style={{ fontSize: '15px', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
            $1,199
          </span>
        </div>

        <StockCounter
          stock={stock}
          totalInitialStock={product.total_initial_stock || 500}
        />

        <BuyButton
          productId={product.id}
          stock={stock}
          onOrderQueued={(id) => setActiveTrackingId(id)}
        />

        {activeTrackingId && <OrderTracker trackingId={activeTrackingId} />}

        <div style={{ marginTop: '20px', paddingTop: '12px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={handleReset}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '11px',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Reset stock to 500
          </button>
        </div>
      </div>
    </div>
  );
}
