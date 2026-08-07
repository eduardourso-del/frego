import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGO = 'aes-256-gcm';
const KEY_VERSION = 1;

function loadKey(): Buffer {
  const raw = process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new Error('WHATSAPP_TOKEN_ENCRYPTION_KEY is required');
  }
  // Accept base64 (32 bytes) or 64-char hex
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error(
      'WHATSAPP_TOKEN_ENCRYPTION_KEY must be 32-byte base64 or 64-char hex',
    );
  }
  return key;
}

export function currentTokenKeyVersion(): number {
  return KEY_VERSION;
}

/** Encrypt access token → base64(iv|tag|ciphertext). */
export function encryptToken(plaintext: string): {
  ciphertext: string;
  keyVersion: number;
} {
  const key = loadKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: Buffer.concat([iv, tag, enc]).toString('base64'),
    keyVersion: KEY_VERSION,
  };
}

export function decryptToken(ciphertext: string, _keyVersion = KEY_VERSION): string {
  const key = loadKey();
  const buf = Buffer.from(ciphertext, 'base64');
  if (buf.length < 12 + 16) {
    throw new Error('invalid_token_ciphertext');
  }
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    'utf8',
  );
}
