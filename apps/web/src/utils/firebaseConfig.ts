export function readFirebaseConfig(env: Record<string, string | undefined> = {}) {
  const config = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  };
  return config.apiKey && config.authDomain && config.projectId && config.appId ? config : null;
}
export const firebaseConfig = readFirebaseConfig(import.meta.env);
