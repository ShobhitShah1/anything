import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { collection, doc, getFirestore, onSnapshot, writeBatch } from 'firebase/firestore';
import { firebaseConfig } from './firebaseConfig';
import type { CloudEntry, CloudStore } from './cloudSync';
import { isCloudEntry } from './cloudSync';

if (!firebaseConfig) throw new Error('Google sign-in is not configured yet. You can continue on this device.');
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export { onAuthStateChanged };
export function login() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return signInWithPopup(auth, provider);
}
export const logout = () => signOut(auth);

export function cloudStore(uid: string): CloudStore {
  const db = getFirestore(app);
  const records = collection(db, 'users', uid, 'collection');
  let receivedServer = false;
  return {
    watch(receive, fail) {
      return onSnapshot(records, { includeMetadataChanges: true }, snapshot => {
        // A stale cache must never be mistaken for an empty server collection.
        if (!receivedServer && snapshot.metadata.fromCache) return;
        receivedServer = true;
        receive(snapshot.docs.map(record => record.data() as CloudEntry));
      }, fail);
    },
    async write(entries) {
      let batch = writeBatch(db);
      let bytes = 0;
      for (const entry of entries) {
        if (!isCloudEntry(entry)) throw new Error('One save has an unsupported format. Your local collection is unchanged; export a backup before editing it.');
        const size = new TextEncoder().encode(JSON.stringify(entry)).length;
        if (size > 900_000) throw new Error('One save is too large for cloud sync. It is still saved on this device. Use an image link instead of a large uploaded image.');
        if (bytes + size > 5_000_000) { await batch.commit(); batch = writeBatch(db); bytes = 0; }
        batch.set(doc(records, `${entry.kind}-${encodeURIComponent(entry.id)}`), entry);
        bytes += size;
      }
      await batch.commit();
    },
  };
}
