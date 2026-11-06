import { readFileSync } from 'node:fs';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const [uid, mode] = process.argv.slice(2);
if (!uid || !['grant', 'revoke'].includes(mode)) {
  console.error('Usage: npm run admin:claim -- <FIREBASE_UID> grant|revoke');
  process.exit(2);
}
let credential = applicationDefault();
if (process.env.FIREBASE_SERVICE_ACCOUNT_FILE) {
  const account = JSON.parse(readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_FILE, 'utf8'));
  credential = cert(account);
}
const app = getApps()[0] || initializeApp({ credential });
const auth = getAuth(app);
const user = await auth.getUser(uid);
const claims = { ...user.customClaims };
if (mode === 'grant') claims.admin = true;
else delete claims.admin;
await auth.setCustomUserClaims(uid, claims);
console.log(
  `${mode === 'grant' ? 'Granted' : 'Revoked'} admin claim for ${uid}. Sign out and sign in again to refresh the token.`,
);
