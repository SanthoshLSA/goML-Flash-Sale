import React from 'react';

export default function StockCounter({ stock, totalInitialStock = 500 }) {
  const percentage = Math.max(0, Math.min(100, (stock / totalInitialStock) * 100));
  const isUrgent = stock > 0 && stock <= 50;
  const isSoldOut = stock <= 0;

  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.03)',
      padding: '16px',
      borderRadius: '10px',
      border: '1px solid var(--border)',
      marginBottom: '20px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          Live Inventory
        </span>
        <span style={{
          fontSize: '14px',
          fontWeight: 700,
          color: isSoldOut ? 'var(--accent-red)' : isUrgent ? 'var(--accent-gold)' : 'var(--text-main)'
        }}>
          {isSoldOut ? 'SOLD OUT' : `${stock} / ${totalInitialStock} left`}
        </span>
      </div>

      <div style={{
        height: '8px',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '4px',
        overflow: 'hidden'
      }}>
        <div style={{
          height: '100%',
          width: `${percentage}%`,
          backgroundColor: isSoldOut ? 'var(--accent-red)' : isUrgent ? 'var(--accent-gold)' : 'var(--accent-blue)',
          transition: 'width 0.3s ease',
        }} />
      </div>

      {isUrgent && (
        <p style={{ fontSize: '12px', color: 'var(--accent-gold)', marginTop: '8px' }}>
          Almost gone! Only {stock} units left.
        </p>
      )}
    </div>
  );
}
