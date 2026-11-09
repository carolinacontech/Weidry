import { useEffect, useState } from 'react';
import { wakeLockSupported } from '../lib/platform';

/** Mantiene la pantalla encendida mientras `active` sea true (donde se soporte). */
export function useWakeLock(active: boolean): { supported: boolean; locked: boolean } {
  const [locked, setLocked] = useState(false);
  const supported = wakeLockSupported();

  useEffect(() => {
    if (!active || !supported) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      try {
        sentinel = await navigator.wakeLock.request('screen');
        if (cancelled) {
          await sentinel.release();
          return;
        }
        setLocked(true);
        sentinel.addEventListener('release', () => setLocked(false));
      } catch {
        setLocked(false);
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible' && (!sentinel || sentinel.released)) void acquire();
    };
    void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel?.release().catch(() => undefined);
      setLocked(false);
    };
  }, [active, supported]);

  return { supported, locked };
}
