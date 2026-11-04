/**
 * Vault — envelope encryption for OAuth tokens and manual credentials.
 *
 * Uses AES-256-GCM (authenticated encryption) so tampering with the
 * ciphertext is detected at decryption time. The plaintext is never
 * persisted, never logged, and never returned by any API route — only
 * the masked value (e.g. "****x7Kq") is ever shown to a human or to the
 * AI agent.
 *
 * The master key comes from process.env.VAULT_MASTER_KEY (32 bytes,
 * base64). If unset, the vault derives a deterministic dev-only key
 * from JWT_SECRET — this is OK for local SQLite but FAILS CLOSED in
 * production where the env var is mandatory.
 *
 * Key rotation is supported: each ciphertext records its keyVersion.
 * Rotating the master key and re-encrypting all rows with the old
 * version is a separate script (scripts/rotate-vault-keys.ts).
 *
 * Reference patterns:
 *   - envelope encryption (KMS pattern) — AWS KMS / GCP KMS public docs
 *   - AES-256-GCM with random 12-byte IV — NIST SP 800-38D
 *   - masking rule: keep last 4 chars, prefix with 4 asterisks
 */
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

const KEY_VERSION = 1;
const IV_LENGTH = 12; // GCM standard nonce length

let _masterKey: Buffer | null = null;

function getMasterKey(): Buffer {
  if (_masterKey) return _masterKey;
  const fromEnv = process.env.VAULT_MASTER_KEY;
  if (fromEnv) {
    // Accept raw base64 (32 bytes decoded) — preferred
    try {
      const buf = Buffer.from(fromEnv, 'base64');
      if (buf.length === 32) {
        _masterKey = buf;
        return buf;
      }
    } catch {
      /* fall through */
    }
    // Or accept a hex string
    try {
      const buf = Buffer.from(fromEnv, 'hex');
      if (buf.length === 32) {
        _masterKey = buf;
        return buf;
      }
    } catch {
      /* fall through */
    }
    // Or accept a passphrase and derive via SHA-256
    const derived = createHash('sha256').update(fromEnv).digest();
    _masterKey = derived;
    return derived;
  }

  // Production must set VAULT_MASTER_KEY explicitly
  if (process.env.NODE_ENV === 'production') {
    throw new Error('VAULT_MASTER_KEY env var required in production (32 bytes base64)');
  }

  // Dev-only deterministic derivation from JWT_SECRET so the dev DB
  // round-trips across restarts. NOT secure for production.
  const jwtSecret = process.env.JWT_SECRET || 'dev-only-vault-key-do-not-use-in-prod';
  _masterKey = createHash('sha256').update('vault:' + jwtSecret).digest();
  return _masterKey;
}

export interface EncryptedSecret {
  /** Format: "<keyVersion>:<iv-base64>:<ciphertext-base64>:<authTag-base64>" */
  ciphertext: string;
  keyVersion: number;
}

/**
 * Encrypts a plaintext secret. Returns a self-describing envelope string
 * containing the IV, ciphertext, and GCM auth tag — all base64. Never
 * returns the plaintext.
 */
export function encryptSecret(plaintext: string): EncryptedSecret {
  if (typeof plaintext !== 'string' || plaintext.length === 0) {
    throw new Error('encryptSecret: plaintext must be a non-empty string');
  }
  const key = getMasterKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: [KEY_VERSION, iv.toString('base64'), ct.toString('base64'), authTag.toString('base64')].join(':'),
    keyVersion: KEY_VERSION,
  };
}

/**
 * Decrypts an envelope produced by encryptSecret. Throws if the auth tag
 * does not verify (tampering detected) or if the key version is unknown.
 */
export function decryptSecret(envelope: string): string {
  const parts = envelope.split(':');
  if (parts.length !== 4) throw new Error('decryptSecret: malformed envelope (expected 4 parts)');
  const [versionStr, ivB64, ctB64, tagB64] = parts;
  const version = parseInt(versionStr, 10);
  if (version !== KEY_VERSION) {
    throw new Error(`decryptSecret: unknown key version ${version}`);
  }
  const key = getMasterKey();
  const iv = Buffer.from(ivB64, 'base64');
  const ct = Buffer.from(ctB64, 'base64');
  const authTag = Buffer.from(tagB64, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString('utf8');
}

/**
 * Mask a secret for display. Always keeps the last 4 characters, prefixed
 * with 4 asterisks. Short secrets are masked more aggressively.
 *
 *   "sk_live_abcdef1234567890" → "****7890"
 *   "ab"                        → "****"
 *   ""                          → ""
 */
export function maskSecret(plaintext: string): string {
  if (!plaintext) return '';
  if (plaintext.length <= 4) return '****';
  if (plaintext.length <= 8) return '****' + plaintext.slice(-2);
  return '****' + plaintext.slice(-4);
}

/**
 * Read-only view of a stored credential. Returned by every API route.
 * Never includes the plaintext or the ciphertext — only the masked value.
 */
export interface PublicCredentialView {
  kind: string;
  maskedValue: string;
  keyVersion: number;
  rotatedAt: Date | null;
  /** Storage reference for audit logs — vault://integrations/<id>/<kind> */
  credentialReference: string;
}
