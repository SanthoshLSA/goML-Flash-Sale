import React, { useState } from 'react';
import { useThrottle } from '../hooks/useThrottle';

export default function BuyButton({ productId, stock, onOrderQueued }) {
  const [btnState, setBtnState] = useState('idle'); // idle | submitting | queued | sold_out
  const [errorMessage, setErrorMessage] = useState(null);

  const handleCheckoutClick = async () => {
    setBtnState('submitting');
    setErrorMessage(null);

    // Client-side idempotency key to prevent accidental duplicate charges
    const idempotencyKey = `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

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
        // Successful reservation! Decoupled write in queue
        setBtnState('queued');
        if (onOrderQueued) {
          onOrderQueued(data.trackingId);
        }
      } else if (response.status === 409 || data.status === 'SOLD_OUT') {
        // Sold out
        setBtnState('sold_out');
      } else if (response.status === 429) {
        setErrorMessage('Rate limit reached: Please do not spam the button.');
        setBtnState('idle');
      } else {
        setErrorMessage(data.message || 'Checkout failed. Please retry.');
        setBtnState('idle');
      }
    } catch (err) {
      setErrorMessage('Network connection error. You may try again.');
      setBtnState('idle');
    }
  };

  const { execute: throttledBuy, isLocked } = useThrottle(handleCheckoutClick, 3000);

  const isSoldOut = stock <= 0 || btnState === 'sold_out';
  const isDisabled = isSoldOut || isLocked || btnState === 'submitting' || btnState === 'queued';

  let buttonText = '⚡ FLASH BUY NOW';
  if (isSoldOut) buttonText = '❌ ALL 500 UNITS SOLD OUT';
  else if (btnState === 'submitting') buttonText = '🔒 Reserving Token...';
  else if (btnState === 'queued') buttonText = '📋 In Order Queue';
  else if (isLocked) buttonText = '⏳ Cooldown Active (1 Click Only)';

  return (
    <div>
      <button
        onClick={throttledBuy}
        disabled={isDisabled}
        style={{
          width: '100%',
          padding: '16px 24px',
          fontSize: '16px',
          fontWeight: 700,
          borderRadius: '10px',
          border: 'none',
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          backgroundColor: isSoldOut
            ? '#374151'
            : isLocked
            ? '#4b5563'
            : 'var(--accent-gold)',
          color: isSoldOut ? '#9ca3af' : '#000000',
          transition: 'all 0.2s ease',
          boxShadow: isDisabled ? 'none' : '0 4px 14px rgba(251, 191, 36, 0.4)',
        }}
      >
        {btnState === 'submitting' && <span className="spinner" style={{ marginRight: '8px' }} />}
        {buttonText}
      </button>

      {errorMessage && (
        <p style={{ color: 'var(--accent-red)', fontSize: '13px', marginTop: '10px', textAlign: 'center' }}>
          {errorMessage}
        </p>
      )}
    </div>
  );
}
