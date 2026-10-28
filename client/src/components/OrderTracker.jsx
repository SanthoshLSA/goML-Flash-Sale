import React, { useState, useEffect } from 'react';

export default function OrderTracker({ trackingId, onComplete }) {
  const [statusData, setStatusData] = useState({ status: 'QUEUED' });
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!trackingId) return;

    let isSubscribed = true;
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/track/${trackingId}`);
        if (!res.ok) throw new Error('Status polling check failed');
        const data = await res.json();

        if (isSubscribed) {
          setStatusData(data);

          if (data.status === 'CONFIRMED' || data.status === 'SOLD_OUT' || data.status === 'FAILED') {
            clearInterval(pollInterval);
            if (onComplete) onComplete(data);
          }
        }
      } catch (err) {
        if (isSubscribed) {
          setError(err.message);
        }
      }
    }, 1500);

    return () => {
      isSubscribed = false;
      clearInterval(pollInterval);
    };
  }, [trackingId, onComplete]);

  const { status, orderId } = statusData;

  const cardStyles = {
    padding: '16px',
    borderRadius: '12px',
    marginTop: '16px',
    border: '1px solid',
    textAlign: 'center',
    transition: 'all 0.3s ease',
  };

  if (status === 'QUEUED') {
    return (
      <div style={{ ...cardStyles, borderColor: 'var(--accent-blue)', background: 'rgba(59, 130, 246, 0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
          <div className="spinner" />
          <strong style={{ color: 'var(--accent-blue)', fontSize: '15px' }}>
            Queue Status: Processing Reservation...
          </strong>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px' }}>
          Your request is in the asynchronous checkout pipeline. Securing physical device in MongoDB...
        </p>
      </div>
    );
  }

  if (status === 'CONFIRMED') {
    return (
      <div style={{ ...cardStyles, borderColor: 'var(--accent-green)', background: 'rgba(16, 185, 129, 0.1)' }}>
        <h4 style={{ color: 'var(--accent-green)', fontSize: '16px', marginBottom: '4px' }}>
          🎉 Order Confirmed!
        </h4>
        <p style={{ fontSize: '13px', color: 'var(--text-main)' }}>
          Physical device guaranteed. Zero overselling ensured.
        </p>
        {orderId && (
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
            Order ID: <code>{orderId}</code>
          </p>
        )}
      </div>
    );
  }

  if (status === 'SOLD_OUT') {
    return (
      <div style={{ ...cardStyles, borderColor: 'var(--accent-red)', background: 'rgba(239, 68, 68, 0.1)' }}>
        <h4 style={{ color: 'var(--accent-red)', fontSize: '16px', marginBottom: '4px' }}>
          ❌ Sale Concluded
        </h4>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          Inventory exhausted right as your request reached the worker. No charges were made.
        </p>
      </div>
    );
  }

  return (
    <div style={{ ...cardStyles, borderColor: 'var(--border)', background: 'rgba(255, 255, 255, 0.05)' }}>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
        Status: {status} {error && `(${error})`}
      </p>
    </div>
  );
}
