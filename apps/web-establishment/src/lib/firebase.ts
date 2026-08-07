import {
  initializeApp,
  getApps,
  type FirebaseApp,
} from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  type Auth,
} from 'firebase/auth';
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  type FirebaseStorage,
} from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '',
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? '',
};

export function isFirebaseConfigured() {
  return Boolean(
    firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId,
  );
}

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let storage: FirebaseStorage | undefined;

export function getFirebaseApp() {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase não configurado — confira NEXT_PUBLIC_FIREBASE_*');
  }
  if (!app) {
    app = getApps()[0] ?? initializeApp(firebaseConfig);
  }
  return app;
}

export function getFirebaseAuth() {
  if (!auth) {
    auth = getAuth(getFirebaseApp());
  }
  return auth;
}

export function getFirebaseStorage() {
  if (!storage) {
    const bucket = firebaseConfig.storageBucket;
    storage = bucket
      ? getStorage(getFirebaseApp(), `gs://${bucket}`)
      : getStorage(getFirebaseApp());
  }
  return storage;
}

/** Staff do estabelecimento: e-mail + senha. */
export async function signInStaff(email: string, password: string) {
  return signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
}

export async function registerStaff(email: string, password: string) {
  return createUserWithEmailAndPassword(
    getFirebaseAuth(),
    email.trim(),
    password,
  );
}

export async function getIdToken(forceRefresh = false): Promise<string | null> {
  const user = getFirebaseAuth().currentUser;
  if (!user) return null;
  return user.getIdToken(forceRefresh);
}

function assertImageFile(file: File) {
  if (!file.type.startsWith('image/')) {
    throw new Error('Envie uma imagem (JPG, PNG ou WebP)');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Imagem até 5 MB');
  }
}

function storageExt(file: File) {
  const fromName = file.name.split('.').pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]+$/.test(fromName)) return fromName;
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  return 'jpg';
}

async function uploadBusinessImage(
  businessId: string,
  folder: 'rewards' | 'logos' | 'heroes',
  file: File,
): Promise<string> {
  assertImageFile(file);
  if (!getFirebaseAuth().currentUser) {
    throw new Error('Faça login para enviar imagens');
  }
  const path = `businesses/${businessId}/${folder}/${Date.now()}.${storageExt(file)}`;
  try {
    const storageRef = ref(getFirebaseStorage(), path);
    await uploadBytes(storageRef, file, { contentType: file.type });
    return getDownloadURL(storageRef);
  } catch (err) {
    const code =
      err && typeof err === 'object' && 'code' in err
        ? String((err as { code: string }).code)
        : '';
    if (code.includes('unauthorized') || code.includes('permission')) {
      throw new Error(
        'Sem permissão no Storage. Publique as regras em infra/storage.rules.',
      );
    }
    if (code.includes('unauthenticated')) {
      throw new Error('Sessão expirada — entre de novo e tente o upload');
    }
    throw err instanceof Error ? err : new Error('Falha no upload');
  }
}

/** Foto do prêmio da campanha → Firebase Storage. */
export async function uploadCampaignRewardImage(
  businessId: string,
  file: File,
): Promise<string> {
  return uploadBusinessImage(businessId, 'rewards', file);
}

/** Logo do estabelecimento → Firebase Storage. */
export async function uploadBusinessLogo(
  businessId: string,
  file: File,
): Promise<string> {
  return uploadBusinessImage(businessId, 'logos', file);
}

/** Imagem de capa (hero) → Firebase Storage. */
export async function uploadBusinessHero(
  businessId: string,
  file: File,
): Promise<string> {
  return uploadBusinessImage(businessId, 'heroes', file);
}

export { firebaseConfig };
