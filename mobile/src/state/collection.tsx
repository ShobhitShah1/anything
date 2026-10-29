import {
  createContext,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged, type User } from 'firebase/auth';
import * as Clipboard from 'expo-clipboard';
import { randomUUID } from 'expo-crypto';
import type { SavedItem } from '../shared/types';
import { startCollectionSync } from '../shared/utils/cloudSync';
import { createQuickCaptures } from '../shared/utils/quickCapture';
import { applyLinkPreview, fetchLinkPreview } from '../shared/utils/fetchPreview';
import { auth, login, logout } from '../services/auth';
import { cloudStore } from '../services/cloud-store';
import { palettes } from '../theme';
import { itemUrl } from '../utils/item';
import { loadText, saveText } from '../utils/device-storage';
import { guestLimitReached, GuestLimitError } from '../utils/guest-limit';

import {
  emptyCollection as empty,
  validateCollection,
  mergeQueuedCollection,
  removeCollectionItems,
  type CollectionData,
} from '../utils/collection-data';
const KEY = 'anything_native_v2';
function useCollectionState() {
  const system = useColorScheme();
  const [data, setData] = useState<CollectionData>(empty);
  const current = useRef(data);
  const writes = useRef(Promise.resolve());
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!auth);
  const [busy, setBusy] = useState(false);
  const [signInPrompt, setSignInPrompt] = useState<'saves' | 'pro' | null>(null);
  const [membership, setMembership] = useState<{ uid: string; active: boolean } | null>(null);
  const [devProUid, setDevProUid] = useState<string | null>(null);
  const [status, setStatus] = useState('local');
  const [attempt, setAttempt] = useState(0);
  const sync = useRef<ReturnType<typeof startCollectionSync> | null>(null);
  const uid = user?.uid || '';
  const enabled = !!uid && data.syncUid === uid;
  const dark = data.theme === 'dark' || (data.theme === 'system' && system === 'dark');
  const colors = palettes[dark ? 'dark' : 'light'];
  const commit = useCallback(
    (update: (value: CollectionData) => CollectionData, beforePublish?: () => void) => {
      const task = writes.current
        .catch(() => {})
        .then(async () => {
          const previous = current.current;
          const next = update(previous);
          if (next === previous && !beforePublish) return;
          if (guestLimitReached(previous.items, next.items, !!auth?.currentUser)) {
            setNotice('');
            setSignInPrompt('saves');
            throw new GuestLimitError();
          }
          await saveText(AsyncStorage, KEY, JSON.stringify(next));
          try {
            beforePublish?.();
          } catch {
            // Animation preparation must not prevent publishing an already persisted collection.
          }
          current.current = next;
          setData(next);
          if (next.items !== previous.items || next.folders !== previous.folders) {
            sync.current?.update(next);
          }
        });
      writes.current = task;
      void task.catch((error) => {
        if (error instanceof GuestLimitError) return;
        setError(
          `Could not save on this device: ${error.message}. Your previous collection is unchanged.`,
        );
      });
      return task;
    },
    [],
  );
  const reload = useCallback(async () => {
    try {
      const raw = await loadText(AsyncStorage, KEY);
      setError('');
      const next = raw ? validateCollection(JSON.parse(raw)) : { ...empty };
      current.current = next;
      setData(next);
      setReady(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not read this collection.');
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Hydrate device storage before exposing the collection.
    void reload();
  }, [reload]);
  useEffect(
    () =>
      auth
        ? onAuthStateChanged(
            auth,
            (user) => {
              setUser(user);
              setDevProUid(null);
              if (user) setSignInPrompt(null);
              setAuthReady(true);
            },
            (error) => {
              setError(error.message);
              setAuthReady(true);
            },
          )
        : undefined,
    [],
  );
  useEffect(() => {
    if (!ready || !enabled) {
      return;
    }
    let disposed = false;
    let controller: ReturnType<typeof startCollectionSync> | null = null;
    const journal = current.current.journals[uid] || { pending: [] };
    const persistJournal = (patch: Partial<typeof journal>) => {
      void commit((value) => ({
        ...value,
        journals: {
          ...value.journals,
          [uid]: { ...(value.journals[uid] || { pending: [] }), ...patch },
        },
      }));
    };
    try {
      controller = startCollectionSync({
        initial: current.current,
        ...journal,
        store: cloudStore(uid, () => writes.current),
        persistPending: (pending) => persistJournal({ pending }),
        persistBaseline: (baseline) => persistJournal({ baseline }),
        apply: (collection) => {
          const before = current.current;
          if (!disposed)
            void commit((value) =>
              disposed ? value : { ...value, ...mergeQueuedCollection(before, value, collection) },
            );
        },
        status: (status, error) => {
          if (!disposed) {
            setStatus(status);
            if (error)
              setError(
                error instanceof Error
                  ? error.message
                  : 'Cloud sync failed. Check the database and rules, then retry.',
              );
          }
        },
      });
      sync.current = controller;
    } catch (error) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Report synchronous Firebase subscription setup failures.
      setStatus('error');
      setError(error instanceof Error ? error.message : 'Could not start sync.');
    }
    return () => {
      disposed = true;
      controller?.stop();
      sync.current = null;
    };
  }, [ready, uid, enabled, attempt, commit]);
  const previewQueue = useRef<{ item: SavedItem; forceFresh: boolean }[]>([]);
  const previewWorkers = useRef(0);
  const enrich = useCallback(
    (items: SavedItem[], forceFresh = false) => {
      previewQueue.current.push(
        ...items
          .filter((item) => 'url' in item || 'postUrl' in item)
          .map((item) => ({ item, forceFresh })),
      );
      const work = async () => {
        if (previewWorkers.current >= 2) return;
        previewWorkers.current++;
        try {
          while (previewQueue.current.length) {
            const { item, forceFresh } = previewQueue.current.shift()!;
            const url = 'url' in item ? item.url : 'postUrl' in item ? item.postUrl : undefined;
            if (!url) continue;
            const preview = await fetchLinkPreview(url, forceFresh);
            if (forceFresh && preview.error)
              setNotice('Preview unavailable. Your save is unchanged.');
            if (!preview.error)
              await commit((value) => ({
                ...value,
                items: value.items.map((existing) =>
                  existing.id === item.id && itemUrl(existing) === url
                    ? applyLinkPreview(existing, preview)
                    : existing,
                ),
              }));
          }
        } catch (error) {
          setError(error instanceof Error ? error.message : 'Could not update a preview.');
        } finally {
          previewWorkers.current--;
        }
      };
      void work();
      void work();
    },
    [commit],
  );
  const capture = useCallback(
    async (text: string, linksOnly = false, folderId?: string, quiet = false) => {
      let created: SavedItem[] = [];
      await commit((value) => {
        const result = createQuickCaptures(text, value.items, linksOnly, folderId);
        created = result.items;
        if (!quiet)
          setNotice(
            result.items.length
              ? `Saved ${result.items.length === 1 ? 'to your collection' : `${result.items.length} finds`}`
              : 'Already in your collection',
          );
        return created.length ? { ...value, items: [...created, ...value.items] } : value;
      });
      enrich(created);
    },
    [commit, enrich],
  );
  const save = useCallback(
    async (item: SavedItem) => {
      await commit((value) => ({
        ...value,
        items: value.items.some((existing) => existing.id === item.id)
          ? value.items.map((existing) => (existing.id === item.id ? item : existing))
          : [item, ...value.items],
      }));
      enrich([item]);
    },
    [commit, enrich],
  );
  const lastClipboard = useRef('');
  useEffect(() => {
    if (!ready || !data.autoClipboard) return;
    let checking = false;
    const check = async () => {
      if (AppState.currentState !== 'active' || checking) return;
      checking = true;
      try {
        const text = (await Clipboard.getStringAsync()).trim();
        if (text && text !== lastClipboard.current) {
          lastClipboard.current = text;
          await capture(text, false, undefined, true);
        }
      } catch {
        // Automatic clipboard checks stay quiet; persistence errors are reported by commit.
      } finally {
        checking = false;
      }
    };
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
    });
    const timer = setInterval(() => void check(), 4000);
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [ready, data.autoClipboard, capture]);
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(''), 1800);
      return () => clearTimeout(timer);
    }
  }, [notice]);
  const accountAction = async (action: () => Promise<void>) => {
    if (busy || !authReady) return;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not connect your account.');
    } finally {
      setBusy(false);
    }
  };
  return {
    data,
    ready,
    error,
    setError,
    notice,
    setNotice,
    user,
    signInPrompt,
    setSignInPrompt,
    pro:
      !!uid && ((membership?.uid === uid && membership.active) || (__DEV__ && devProUid === uid)),
    devPro: __DEV__ && !!uid && devProUid === uid,
    setDevPro: (value: boolean) => setDevProUid(__DEV__ && value && uid ? uid : null),
    setMembership,
    busy: busy || !authReady,
    status: enabled ? status : 'local',
    enabled,
    dark,
    colors,
    commit,
    reload,
    capture,
    save,
    enrich,
    signIn: () =>
      accountAction(async () => {
        await login();
        const signedIn = auth?.currentUser;
        if (signedIn) await commit((value) => ({ ...value, syncUid: signedIn.uid }));
      }),
    signOut: () =>
      accountAction(async () => {
        await commit((value) => ({ ...value, syncUid: '' }));
        await logout();
      }),
    toggleSync: () => commit((value) => ({ ...value, syncUid: value.syncUid === uid ? '' : uid })),
    retrySync: () => {
      setError('');
      setAttempt((value) => value + 1);
    },
    remove: (ids: string | readonly string[], beforePublish?: () => void) =>
      commit(
        (value) => removeCollectionItems(value, typeof ids === 'string' ? [ids] : ids),
        beforePublish,
      ),
    pin: (id: string) =>
      commit((value) => ({
        ...value,
        items: value.items.map((item) =>
          item.id === id ? { ...item, isPinned: !item.isPinned } : item,
        ),
      })),
    addFolder: (name: string) =>
      commit((value) => ({
        ...value,
        folders: [...value.folders, { id: randomUUID(), name: name.trim(), createdAt: Date.now() }],
      })),
  };
}
const CollectionContext = createContext<ReturnType<typeof useCollectionState> | null>(null);
export function CollectionProvider({ children }: { children: ReactNode }) {
  return <CollectionContext value={useCollectionState()}>{children}</CollectionContext>;
}
export function useCollection() {
  const context = use(CollectionContext);
  if (!context) throw new Error('Missing collection provider');
  return context;
}
