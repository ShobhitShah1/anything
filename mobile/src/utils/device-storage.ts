interface Storage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  multiSet(entries: [string, string][]): Promise<void>;
  multiRemove(keys: string[]): Promise<void>;
}
interface Manifest {
  revision: string;
  count: number;
}
const chunkSize = 128_000;
function manifest(raw: string | null): Manifest | null {
  if (!raw) return null;
  const value = JSON.parse(raw) as Manifest;
  if (
    !value ||
    typeof value.revision !== 'string' ||
    !/^[a-z0-9-]+$/.test(value.revision) ||
    !Number.isInteger(value.count) ||
    value.count < 1 ||
    value.count > 1000
  )
    throw new Error('The device storage index could not be read.');
  return value;
}
const keys = (key: string, value: Manifest) =>
  Array.from({ length: value.count }, (_, index) => `${key}:${value.revision}:${index}`);
export async function loadText(storage: Storage, key: string) {
  const current = manifest(await storage.getItem(`${key}:index`));
  if (!current) return storage.getItem(key);
  const chunks = await Promise.all(keys(key, current).map((key) => storage.getItem(key)));
  if (chunks.some((chunk) => chunk === null))
    throw new Error(
      'Part of the device collection is missing. Existing data has not been replaced.',
    );
  return chunks.join('');
}
// Small chunks avoid Android's per-row storage limit; publish the index only after every chunk is safe.
export async function saveText(storage: Storage, key: string, text: string) {
  const previous = manifest(await storage.getItem(`${key}:index`));
  const next = {
    revision: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
    count: Math.max(1, Math.ceil(text.length / chunkSize)),
  };
  if (next.count > 1000)
    throw new Error('The collection is too large for device storage. Export a backup.');
  await storage.multiSet(
    keys(key, next).map((key, index) => [
      key,
      text.slice(index * chunkSize, (index + 1) * chunkSize),
    ]),
  );
  await storage.setItem(`${key}:index`, JSON.stringify(next));
  await storage.multiRemove([key, ...(previous ? keys(key, previous) : [])]).catch(() => {});
}
