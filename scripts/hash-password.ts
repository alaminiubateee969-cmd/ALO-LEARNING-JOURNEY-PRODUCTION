/**
 * Hash a plaintext password for ALO_ADMIN_PASSWORD_HASH.
 * Usage: bun run scripts/hash-password.ts <password>
 */
import { hashPassword } from '../src/lib/auth';
import readline from 'readline';

async function main() {
  const arg = process.argv[2];
  let password: string;
  if (arg) {
    password = arg;
  } else {
    // prompt securely
    const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
    process.stderr.write('Enter admin password: ');
    password = await new Promise<string>((resolve) => {
      rl.question('', (ans) => { rl.close(); resolve(ans); });
    });
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters');
    process.exit(1);
  }
  const hash = await hashPassword(password);
  console.log(hash);
}

main().catch((e) => { console.error(e); process.exit(1); });
