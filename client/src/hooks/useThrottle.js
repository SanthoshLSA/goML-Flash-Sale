import { useState, useRef, useCallback } from 'react';

export function useThrottle(fn, delay = 3000) {
  const [locked, setLocked] = useState(false);
  const lastTime = useRef(0);

  const execute = useCallback(
    async (...args) => {
      const now = Date.now();
      if (now - lastTime.current < delay) {
        return;
      }

      lastTime.current = now;
      setLocked(true);

      try {
        await fn(...args);
      } finally {
        setTimeout(() => {
          setLocked(false);
        }, delay);
      }
    },
    [fn, delay]
  );

  return { execute, locked };
}
