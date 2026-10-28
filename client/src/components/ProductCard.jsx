import React, { useState } from 'react';
import StockCounter from './StockCounter';
import BuyButton from './BuyButton';
import OrderTracker from './OrderTracker';
import { useSSE } from '../hooks/useSSE';

export default function ProductCard({ product }) {
  const [activeTrackingId, setActiveTrackingId] = useState(null);
  const { stock, isConnected, setStock } = useSSE(product._id, product.stock);

  const handleReset = async () => {
    try {
      const res = await fetch(`/api/products/${product._id}/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock: 500 }),
      });
      const data = await res.json();
      setStock(data.stock);
      setActiveTrackingId(null);
    } catch (err) {
      console.error('Failed to reset inventory', err);
    }
  };

  return (
    <div style={{
      maxWidth: '520px',
      margin: '0 auto',
      background: 'var(--bg-card)',
      borderRadius: '20px',
      border: '1px solid var(--border)',
      overflow: 'hidden',
      boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
    }}>
      {/* Product Image Banner */}
      <div style={{ position: 'relative', height: '240px', background: '#0e1422' }}>
        <img
          src={product.imageUrl || 'https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=800&auto=format&fit=crop&q=80'}
          alt={product.name}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <div style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          backgroundColor: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(8px)',
          padding: '6px 12px',
          borderRadius: '20px',
          fontSize: '12px',
          fontWeight: 700,
          color: 'var(--accent-gold)',
          border: '1px solid var(--accent-gold)',
        }}>
          🔥 FESTIVAL FLASH DROP • 8:00 PM
        </div>
      </div>

      <div style={{ padding: '24px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '8px' }}>
          {product.name}
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: 1.5 }}>
          {product.description}
        </p>

        {/* Pricing */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '20px' }}>
          <span style={{ fontSize: '32px', fontWeight: 900, color: 'var(--accent-gold)' }}>
            ${product.price}
          </span>
          <span style={{ fontSize: '16px', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
            $1,199
          </span>
          <span style={{
            fontSize: '12px',
            background: 'rgba(239, 68, 68, 0.2)',
            color: 'var(--accent-red)',
            padding: '2px 8px',
            borderRadius: '6px',
            fontWeight: 700
          }}>
            SAVE 42%
          </span>
        </div>

        {/* Real-time SSE Stock Counter */}
        <StockCounter
          stock={stock}
          totalInitialStock={product.totalInitialStock || 500}
          isConnected={isConnected}
        />

        {/* Throttled Buy Button */}
        <BuyButton
          productId={product._id}
          stock={stock}
          onOrderQueued={(trackingId) => setActiveTrackingId(trackingId)}
        />

        {/* Polling Order Tracker */}
        {activeTrackingId && (
          <OrderTracker
            trackingId={activeTrackingId}
            onComplete={(res) => {
              console.log('Order finalized:', res);
            }}
          />
        )}

        {/* Developer / Interview Demo Controls */}
        <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Demo Control:</span>
          <button
            onClick={handleReset}
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--text-muted)',
              fontSize: '11px',
              padding: '4px 10px',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            🔄 Reset Inventory to 500
          </button>
        </div>
      </div>
    </div>
  );
}
