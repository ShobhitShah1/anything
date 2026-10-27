import { collection, doc, getFirestore, onSnapshot, writeBatch } from 'firebase/firestore';
import { firebaseApp } from './firebase-app';
import { isCloudEntry, type CloudStore } from '../shared/utils/cloudSync';
export function cloudStore(uid: string, durable: () => Promise<void>): CloudStore {
  if (!firebaseApp) throw new Error('Firebase is not configured.');
  const db = getFirestore(firebaseApp);
  const records = collection(db, 'users', uid, 'collection');
  return {
    watch(receive, fail) {
      return onSnapshot(
        records,
        { includeMetadataChanges: true },
        (snapshot) => {
          if (!snapshot.metadata.fromCache)
            receive(snapshot.docs.map((record) => record.data() as never));
        },
        fail,
      );
    },
    async write(entries) {
      await durable();
      let batch = writeBatch(db);
      let bytes = 0;
      for (const entry of entries) {
        if (!isCloudEntry(entry))
          throw new Error('An unsupported save cannot be synced. Local saves are safe.');
        const size = new TextEncoder().encode(JSON.stringify(entry)).length;
        if (size > 900_000)
          throw new Error(
            'An image is too large for Firestore. It remains on your device. Use an image link to sync it.',
          );
        if (bytes + size > 5_000_000) {
          await batch.commit();
          batch = writeBatch(db);
          bytes = 0;
        }
        batch.set(doc(records, `${entry.kind}-${encodeURIComponent(entry.id)}`), entry);
        bytes += size;
      }
      await batch.commit();
    },
  };
}
