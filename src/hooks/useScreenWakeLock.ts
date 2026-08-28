import { useState, useEffect, useCallback } from 'react';

export function useScreenWakeLock() {
  const [isSupported] = useState<boolean>(
    typeof window !== 'undefined' && 'wakeLock' in navigator
  );
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [wakeLockSentinel, setWakeLockSentinel] = useState<any>(null);

  const requestWakeLock = useCallback(async () => {
    if (!isSupported) return false;
    try {
      const sentinel = await (navigator as any).wakeLock.request('screen');
      setWakeLockSentinel(sentinel);
      setIsLocked(true);
      console.log('[WakeLock] Screen Wake Lock acquired.');

      sentinel.addEventListener('release', () => {
        setIsLocked(false);
        setWakeLockSentinel(null);
        console.log('[WakeLock] Screen Wake Lock released.');
      });
      return true;
    } catch (err) {
      console.warn('[WakeLock] Request failed:', err);
      setIsLocked(false);
      return false;
    }
  }, [isSupported]);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockSentinel) {
      await wakeLockSentinel.release();
      setWakeLockSentinel(null);
      setIsLocked(false);
    }
  }, [wakeLockSentinel]);

  // Re-acquire lock if tab regains visibility
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && isLocked && !wakeLockSentinel) {
        await requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isLocked, wakeLockSentinel, requestWakeLock]);

  return {
    isSupported,
    isLocked,
    requestWakeLock,
    releaseWakeLock,
  };
}
