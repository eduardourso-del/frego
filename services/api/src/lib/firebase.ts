import {
  initializeApp,
  getApps,
  cert,
  applicationDefault,
} from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';

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
