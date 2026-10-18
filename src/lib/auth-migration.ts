import { scryptSync, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";

export async function verifyAdminCredentialsMigration(
  email: string,
  password: string
): Promise<{ ok: boolean; needsMigration?: boolean }> {
  const configuredEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const legacyHash = process.env.ADMIN_PASSWORD_HASH;
  const newHash = process.env.ALO_ADMIN_PASSWORD_HASH;

  if (!configuredEmail || (!legacyHash && !newHash)) return { ok: false };
  if (email.trim().toLowerCase() !== configuredEmail) return { ok: false };

  if (newHash) {
    const ok = await bcrypt.compare(password, newHash);
    if (ok) return { ok: true };
  }

  if (legacyHash && legacyHash.startsWith("scrypt$")) {
    const [, encodedSalt, encodedExpected] = legacyHash.split("$");
    try {
      const salt = Buffer.from(encodedSalt, "base64url");
      const expected = Buffer.from(encodedExpected, "base64url");
      const actual = scryptSync(password, salt, expected.length);
      if (timingSafeEqual(actual, expected)) {
        return { ok: true, needsMigration: true };
      }
    } catch {
      return { ok: false };
    }
  }

  return { ok: false };
}
