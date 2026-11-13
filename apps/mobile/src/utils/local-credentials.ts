import AsyncStorage from '@react-native-async-storage/async-storage';

export interface LocalCredential {
  website: string;
  username: string;
  password: string;
  notes: string;
}

const key = (id: string) => `anything_local_credential_${id}`;
export async function readLocalCredential(id: string): Promise<LocalCredential | null> {
  const raw = await AsyncStorage.getItem(key(id));

  if (!raw) return null;
  const value = JSON.parse(raw) as Partial<LocalCredential>;
  if (typeof value.website !== 'string' || typeof value.password !== 'string') return null;

  return {
    website: value.website,
    username: typeof value.username === 'string' ? value.username : '',
    password: value.password,
    notes: typeof value.notes === 'string' ? value.notes : '',
  };
}

export async function saveLocalCredential(id: string, record: LocalCredential) {
  await AsyncStorage.setItem(key(id), JSON.stringify(record));
}

export async function deleteLocalCredential(id: string) {
  await AsyncStorage.removeItem(key(id));
}
