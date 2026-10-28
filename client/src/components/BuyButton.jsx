import React, { useState } from 'react';
import { useThrottle } from '../hooks/useThrottle';

export default function BuyButton({ productId, stock, onOrderQueued }) {
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const handleClick = async () => {
    setSubmitting(true);
    setErrorMessage(null);

    const idempotencyKey = `user_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          productId,
          userId: `usr_${Math.random().toString(36).substring(2, 8)}`,
        }),
      });

      const data = await response.json();

      if (response.status === 202) {
        if (onOrderQueued) onOrderQueued(data.trackingId);
      } else if (response.status === 409 || data.status === 'SOLD_OUT') {
        setErrorMessage('Item is sold out.');
      } else if (response.status === 429) {
        setErrorMessage('Too many clicks. Please wait a moment.');
      } else {
        setErrorMessage(data.message || 'Checkout failed.');
      }
    } catch (err) {
      setErrorMessage('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const { execute, locked } = useThrottle(handleClick, 3000);

  const isSoldOut = stock <= 0;
  const isDisabled = isSoldOut || locked || submitting;

  let label = 'Buy Now';
  if (isSoldOut) label = 'Sold Out';
  else if (submitting) label = 'Reserving...';
  else if (locked) label = 'Please wait...';

  return (
    <div>
      <button
        onClick={execute}
        disabled={isDisabled}
        style={{
          width: '100%',
          padding: '14px',
          fontSize: '16px',
          fontWeight: 600,
          borderRadius: '8px',
          border: 'none',
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          backgroundColor: isSoldOut ? '#334155' : locked ? '#475569' : 'var(--accent-gold)',
          color: isSoldOut ? '#94a3b8' : '#000000',
          transition: 'background 0.2s',
        }}
      >
        {submitting && <span className="spinner" style={{ marginRight: '8px' }} />}
        {label}
      </button>

      {errorMessage && (
        <p style={{ color: 'var(--accent-red)', fontSize: '13px', marginTop: '10px', textAlign: 'center' }}>
          {errorMessage}
        </p>
      )}
    </div>
  );
}
