import * as FirebaseAuth from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { firebaseApp } from './firebase-app';

function createAuth() {
  if (!firebaseApp) return null;
  const persistence = (
    FirebaseAuth as typeof FirebaseAuth & {
      getReactNativePersistence: (storage: typeof AsyncStorage) => FirebaseAuth.Persistence;
    }
  ).getReactNativePersistence;
  try {
    return FirebaseAuth.initializeAuth(firebaseApp, { persistence: persistence(AsyncStorage) });
  } catch (error) {
    if ((error as { code?: string }).code === 'auth/already-initialized')
      return FirebaseAuth.getAuth(firebaseApp);
    throw error;
  }
}
export const auth = createAuth();

async function googleClient() {
  const client = await import('@react-native-google-signin/google-signin');
  // Firebase can restore a session before Google Sign-In has been configured in this process.
  client.GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  });
  return client;
}
export async function login() {
  if (!auth) throw new Error('Add your Firebase configuration to .env and restart Expo.');
  if (Constants.appOwnership === 'expo')
    throw new Error(
      'Google login needs a development build. Local saves work in Expo Go. See the mobile README.',
    );
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (Platform.OS === 'ios' && !process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID) {
    throw new Error(
      'Set the iOS OAuth client ID and GOOGLE_IOS_URL_SCHEME, then rebuild the iOS app.',
    );
  }
  if (!webClientId)
    throw new Error(
      'Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID and register this app in the Firebase project.',
    );
  const { GoogleSignin, isSuccessResponse } = await googleClient();
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const result = await GoogleSignin.signIn();
  if (!isSuccessResponse(result)) return;
  if (!result.data.idToken)
    throw new Error(
      'Google returned no ID token. Check the OAuth client and Android SHA-1 fingerprint.',
    );
  await FirebaseAuth.signInWithCredential(
    auth,
    FirebaseAuth.GoogleAuthProvider.credential(result.data.idToken),
  );
}
export async function logout() {
  if (auth) await FirebaseAuth.signOut(auth);
  if (Constants.appOwnership !== 'expo') {
    const { GoogleSignin } = await googleClient();
    if (GoogleSignin.hasPreviousSignIn()) await GoogleSignin.signOut();
  }
}
