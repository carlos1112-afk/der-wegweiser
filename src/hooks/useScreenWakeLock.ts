import { useState, useEffect, useCallback } from 'react';

export function useScreenWakeLock(enabled: boolean = false) {
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

      sentinel.addEventListener('release', () => {
        setIsLocked(false);
        setWakeLockSentinel(null);
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
      try {
        await wakeLockSentinel.release();
      } catch (e) {
        console.warn('[WakeLock] Release error:', e);
      }
      setWakeLockSentinel(null);
      setIsLocked(false);
    }
  }, [wakeLockSentinel]);

  // Automatically acquire or release based on enabled state
  useEffect(() => {
    if (enabled) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }
  }, [enabled, requestWakeLock, releaseWakeLock]);

  // Re-acquire lock if tab regains visibility
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && enabled && !wakeLockSentinel) {
        await requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, wakeLockSentinel, requestWakeLock]);

  return {
    isSupported,
    isLocked,
    requestWakeLock,
    releaseWakeLock,
  };
}
