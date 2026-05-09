/**
 * useOffline hook
 * - Tracks online/offline status
 * - Runs syncOutbox automatically when coming back online
 * - Exposes pendingCount so UI can show a badge
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { outbox } from './db';
import { syncOutbox, refreshCache } from './sync';
import toast from 'react-hot-toast';

export const useOffline = () => {
  const [isOnline,     setIsOnline]     = useState(navigator.onLine);
  const [syncing,      setSyncing]      = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const syncLock = useRef(false);

  const refreshPendingCount = useCallback(async () => {
    try { setPendingCount(await outbox.count()); } catch {}
  }, []);

  /* Run sync when back online */
  const runSync = useCallback(async () => {
    if (syncLock.current || syncing) return;
    syncLock.current = true;
    setSyncing(true);
    try {
      const { synced, failed } = await syncOutbox();
      if (synced > 0) {
        toast.success(`Synced ${synced} offline action${synced>1?'s':''}`, { icon: '☁️', duration: 3000 });
      }
      if (failed > 0) {
        toast.error(`${failed} action${failed>1?'s':''} failed to sync`, { duration: 4000 });
      }
      await refreshPendingCount();
    } finally {
      setSyncing(false);
      syncLock.current = false;
    }
  }, [refreshPendingCount]);

  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true);
      toast('Back online!', { icon: '🌐', duration: 2000 });
      runSync();
    };
    const goOffline = () => {
      setIsOnline(false);
      toast('You\'re offline — changes will sync when connected', { icon: '📴', duration: 4000 });
    };
    window.addEventListener('online',  goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online',  goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [runSync]);

  /* Refresh cache on first load when online */
  useEffect(() => {
    if (navigator.onLine) refreshCache().catch(() => {});
    refreshPendingCount();
  }, [refreshPendingCount]);

  return { isOnline, syncing, pendingCount, refreshPendingCount, runSync };
};
