import { useState, useRef, useCallback } from 'react';

/**
 * useThrottle Hook
 * Locks execution immediately upon the first trigger to prevent API spamming,
 * duplicate payloads, and multiple click events.
 */
export function useThrottle(callback, delay = 3000) {
  const [isLocked, setIsLocked] = useState(false);
  const lastExecutedRef = useRef(0);

  const execute = useCallback(
    async (...args) => {
      const now = Date.now();

      if (now - lastExecutedRef.current < delay) {
        return; // Throttled: Ignore repetitive clicks
      }

      lastExecutedRef.current = now;
      setIsLocked(true);

      try {
        await callback(...args);
      } finally {
        setTimeout(() => {
          setIsLocked(false);
        }, delay);
      }
    },
    [callback, delay]
  );

  return { execute, isLocked };
}
