import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import type { Folder, SavedItem } from '../types';
import { firebaseConfig } from '../utils/firebaseConfig';
import { startCollectionSync, type CloudEntry } from '../utils/cloudSync';

function accountError(error: unknown): string {
  const code = (error as { code?: string })?.code;
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return '';
  if (code === 'auth/popup-blocked') return 'Your browser blocked Google sign-in. Allow the popup and try again.';
  if (code === 'auth/unauthorized-domain') return 'Add this website to Firebase Authentication’s authorized domains.';
  if (code === 'permission-denied') return 'Cloud access was denied. Check the Firestore rules and try again. Local saves are safe.';
  if (code === 'not-found' || code === 'failed-precondition') return 'Cloud Firestore is not ready. Create a Standard edition (default) database in this Firebase project and publish the private access rules, then retry.';
  if (code === 'unavailable' || code === 'auth/network-request-failed') return 'Unable to connect. Your local saves are safe; try again when online.';
  return error instanceof Error ? error.message : 'Could not connect. Your local saves are safe.';
}
function savedSyncUser() {
  try { return localStorage.getItem('anything_cloud_uid') || ''; } catch { return ''; }
}

export function useCloudAccount(items: SavedItem[], folders: Folder[], setItems: (items: SavedItem[]) => void, setFolders: (folders: Folder[]) => void) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!!firebaseConfig);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [enabledUid, setEnabledUid] = useState(savedSyncUser);
  const [status, setStatus] = useState<'local' | 'connecting' | 'syncing' | 'synced' | 'error'>('local');
  const [attempt, setAttempt] = useState(0);
  const latest = useRef({ items, folders });
  const sync = useRef<ReturnType<typeof startCollectionSync> | null>(null);
  const uid = user?.uid || '';
  const enabled = !!uid && uid === enabledUid;

  useEffect(() => {
    if (!firebaseConfig) return;
    let disposed = false;
    let unsubscribe: (() => void) | undefined;
    import('../utils/firebaseClient').then(client => {
      if (disposed) return;
      unsubscribe = client.onAuthStateChanged(client.auth, next => { setUser(next); setLoading(false); }, error => { setError(accountError(error)); setLoading(false); });
    }).catch(error => { if (!disposed) { setError(accountError(error)); setLoading(false); } });
    return () => { disposed = true; unsubscribe?.(); };
  }, []);

  useEffect(() => {
    if (!uid || !enabled) return;
    let disposed = false;
    const journalKey = `anything_cloud_pending_${uid}`;
    const baselineKey = `anything_cloud_baseline_${uid}`;
    import('../utils/firebaseClient').then(client => {
      if (disposed) return;
      setError('');
      const saved = localStorage.getItem(journalKey);
      const pending: CloudEntry[] = saved ? JSON.parse(saved) : [];
      const savedBaseline = localStorage.getItem(baselineKey);
      const baseline = savedBaseline ? JSON.parse(savedBaseline) : undefined;
      if (baseline && (!Array.isArray(baseline.items) || !Array.isArray(baseline.folders))) throw new Error('The local sync history could not be read. Export a backup before resetting sync.');
      if (!Array.isArray(pending)) throw new Error('The pending sync data could not be read. Export a local backup before resetting sync.');
      sync.current = startCollectionSync({
        initial: latest.current, baseline, pending, store: client.cloudStore(uid),
        persistPending: entries => localStorage.setItem(journalKey, JSON.stringify(entries)),
        persistBaseline: value => localStorage.setItem(baselineKey, JSON.stringify(value)),
        apply: next => { if (!disposed) { setItems(next.items); setFolders(next.folders); } },
        status: (next, error) => { if (!disposed) { setStatus(next); setError(error ? accountError(error) : ''); } },
      });
    }).catch(error => { if (!disposed) { setStatus('error'); setError(accountError(error)); } });
    return () => { disposed = true; sync.current?.stop(); sync.current = null; };
  }, [uid, enabled, attempt, setItems, setFolders]);

  useLayoutEffect(() => {
    latest.current = { items, folders };
    sync.current?.update({ items, folders });
  }, [items, folders]);

  const signIn = useCallback(async () => {
    if (!firebaseConfig) { setError('Google sign-in will be available once Firebase is configured. You can keep saving on this device.'); return; }
    if (busy || loading) return;
    setBusy(true);
    setError('');
    try { const client = await import('../utils/firebaseClient'); await client.login(); }
    catch (error) { setError(accountError(error)); }
    finally { setBusy(false); }
  }, [busy, loading]);

  const toggleSync = useCallback(() => {
    if (!user) return;
    try {
      const next = enabled ? '' : user.uid;
      localStorage.setItem('anything_cloud_uid', next);
      setEnabledUid(next);
      setError('');
    } catch { setError('Browser storage is unavailable. Cloud sync stayed unchanged.'); }
  }, [user, enabled]);

  const signOut = useCallback(async () => {
    setBusy(true);
    try {
      sync.current?.stop();
      sync.current = null;
      localStorage.removeItem('anything_cloud_uid');
      setEnabledUid('');
      const client = await import('../utils/firebaseClient');
      await client.logout();
      setError('');
    } catch (error) { setError(accountError(error)); }
    finally { setBusy(false); }
  }, []);

  return { user, loading, busy, error, enabled, status: enabled ? status : 'local' as const, configured: !!firebaseConfig, signIn, signOut, toggleSync, retry: () => setAttempt(value => value + 1) };
}
export type CloudAccount = ReturnType<typeof useCloudAccount>;
