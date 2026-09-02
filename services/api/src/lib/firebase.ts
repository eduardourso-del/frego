import {
  initializeApp,
  getApps,
  cert,
  applicationDefault,
} from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';

let initialized = false;

function ensureFirebase() {
  if (initialized || getApps().length > 0) {
    initialized = true;
    return;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID ?? 'voltei-e9d6d';

  if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    initializeApp({
      credential: cert({
        projectId,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
  } else {
    // Local: `gcloud auth application-default login`
    // Cloud Run: runtime service account
    initializeApp({
      credential: applicationDefault(),
      projectId,
    });
  }

  initialized = true;
}

export async function verifyFirebaseIdToken(
  idToken: string,
): Promise<DecodedIdToken> {
  ensureFirebase();
  return getAuth().verifyIdToken(idToken);
}

export function getFirebaseMessaging(): Messaging {
  ensureFirebase();
  return getMessaging();
}

/** Removes the Firebase Auth user. No-op if the uid is already gone. */
export async function deleteFirebaseUser(uid: string): Promise<void> {
  ensureFirebase();
  try {
    await getAuth().deleteUser(uid);
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code === 'auth/user-not-found') return;
    throw err;
  }
}
