import React, { useState, useEffect } from 'react';

export default function OrderTracker({ trackingId }) {
  const [status, setStatus] = useState('QUEUED');
  const [orderId, setOrderId] = useState(null);

  useEffect(() => {
    if (!trackingId) return;

    let active = true;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/track/${trackingId}`);
        const data = await res.json();

        if (active) {
          setStatus(data.status);
          if (data.orderId) setOrderId(data.orderId);

          if (data.status === 'CONFIRMED' || data.status === 'SOLD_OUT' || data.status === 'FAILED') {
            clearInterval(interval);
          }
        }
      } catch (err) {}
    }, 1500);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [trackingId]);

  const style = {
    padding: '14px',
    borderRadius: '8px',
    marginTop: '16px',
    border: '1px solid',
    textAlign: 'center',
    fontSize: '14px',
  };

  if (status === 'QUEUED') {
    return (
      <div style={{ ...style, borderColor: 'var(--accent-blue)', background: 'rgba(59, 130, 246, 0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <div className="spinner" />
          <span>Processing order in queue...</span>
        </div>
      </div>
    );
  }

  if (status === 'CONFIRMED') {
    return (
      <div style={{ ...style, borderColor: 'var(--accent-green)', background: 'rgba(16, 185, 129, 0.1)' }}>
        <p style={{ color: 'var(--accent-green)', fontWeight: 600 }}>Order Confirmed!</p>
        {orderId && <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>ID: {orderId}</p>}
      </div>
    );
  }

  if (status === 'SOLD_OUT') {
    return (
      <div style={{ ...style, borderColor: 'var(--accent-red)', background: 'rgba(239, 68, 68, 0.1)' }}>
        <p style={{ color: 'var(--accent-red)', fontWeight: 600 }}>Sold Out</p>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Item went out of stock right as your order arrived.</p>
      </div>
    );
  }

  return null;
}
