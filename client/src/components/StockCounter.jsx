import React from 'react';

export default function StockCounter({ stock, totalInitialStock = 500, isConnected }) {
  const percentage = Math.max(0, Math.min(100, (stock / totalInitialStock) * 100));
  const isUrgent = stock > 0 && stock <= 50;
  const isSoldOut = stock <= 0;

  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.03)',
      padding: '16px',
      borderRadius: '12px',
      border: '1px solid var(--border)',
      marginBottom: '20px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            display: 'inline-block',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: isConnected ? 'var(--accent-green)' : 'var(--accent-gold)',
          }} className={isConnected ? 'pulse' : ''} />
          <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>
            {isConnected ? 'LIVE INVENTORY' : 'SYNCING...'}
          </span>
        </div>
        <span style={{
          fontSize: '14px',
          fontWeight: 700,
          color: isSoldOut ? 'var(--accent-red)' : isUrgent ? 'var(--accent-gold)' : 'var(--text-main)'
        }}>
          {isSoldOut ? 'SOLD OUT' : `${stock} / ${totalInitialStock} REMAINING`}
        </span>
      </div>

      {/* Progress Bar */}
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
          transition: 'width 0.4s ease-out, background-color 0.4s ease',
        }} />
      </div>

      {isUrgent && (
        <p style={{ fontSize: '12px', color: 'var(--accent-gold)', marginTop: '8px', fontWeight: 600 }}>
          🔥 High demand! Only a few units left.
        </p>
      )}
    </div>
  );
}
