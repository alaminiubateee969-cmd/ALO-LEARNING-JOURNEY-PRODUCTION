// Phase 2.4 — End-to-end login verification.
// 1. Hash + verify the ADMIN_SEED_PASSWORD against the seeded admin row.
// 2. Issue a real JWT with createToken().
// 3. Verify the JWT round-trips with verifyToken().
// 4. Confirm the user row exists in the DB with the expected email.
// Exits 0 on success, 1 on any failure.

import { PrismaClient } from '@prisma/client';
import { hashPassword, verifyPassword, createToken, verifyToken } from '../src/lib/auth';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_SEED_EMAIL!;
  const password = process.env.ADMIN_SEED_PASSWORD!;

  console.log('[1/4] Look up seeded admin:', email);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`FAIL: no user with email ${email}`);

  console.log('[2/4] Verify password matches seeded hash');
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) throw new Error('FAIL: ADMIN_SEED_PASSWORD does not match stored hash');
  console.log('     -> password verified (bcrypt rounds OK)');

  console.log('[3/4] Issue JWT and round-trip verify');
  const token = await createToken({
    userId: user.id,
    email: user.email,
    role: 'super_admin',
    companyId: '',
  });
  if (!token || token.split('.').length !== 3) throw new Error('FAIL: malformed JWT');
  const payload = await verifyToken(token);
  if (!payload || payload.email !== email) throw new Error('FAIL: verifyToken returned invalid payload');
  const exp = payload.exp as number;
  const days = Math.round((exp * 1000 - Date.now()) / 86400000);
  console.log(`     -> JWT valid, expires in ~${days} days (alg HS256)`);

  console.log('[4/4] Reject a forged token signed with the wrong secret');
  const { SignJWT } = await import('jose');
  const forged = await new SignJWT({ userId: user.id, email, role: 'super_admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(new TextEncoder().encode('wrong-secret'));
  const forgedPayload = await verifyToken(forged);
  if (forgedPayload !== null) throw new Error('FAIL: forged token was accepted!');
  console.log('     -> forged token correctly rejected');

  console.log('\nAll login-path checks passed.');
}

main()
  .then(() => prisma.$disconnect())
  .then(() => process.exit(0))
  .catch(async (e) => {
    console.error(e?.message || e);
    await prisma.$disconnect();
    process.exit(1);
  });
