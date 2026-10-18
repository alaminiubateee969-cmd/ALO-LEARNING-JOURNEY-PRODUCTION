/**
 * Generate the out-of-band scrypt hash for ADMIN_PASSWORD_HASH.
 * Usage: node --experimental-strip-types scripts/hash-password.ts
 * The password is read with terminal echo disabled; it is never accepted as an
 * argv value, written to a file, or logged. Store the printed hash in the
 * approved secret manager, not in the repository.
 */
import { randomBytes, scryptSync } from 'node:crypto';
import process from 'node:process';

function readHiddenPassword(): Promise<string> {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    throw new Error('Run this command in an interactive terminal; password input is not accepted via argv or piped stdin.');
  }
  return new Promise((resolve, reject) => {
    const chunks: string[] = [];
    process.stderr.write('Enter administrator password (8+ characters): ');
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    const onData = (chunk: string) => {
      for (const character of chunk) {
        if (character === '\u0003') {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stderr.write('\nCancelled.\n');
          reject(new Error('Cancelled'));
          return;
        }
        if (character === '\r' || character === '\n') {
          process.stdin.off('data', onData);
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stderr.write('\n');
          resolve(chunks.join(''));
          return;
        }
        if (character === '\u007f' || character === '\b') chunks.pop();
        else chunks.push(character);
      }
    };
    process.stdin.on('data', onData);
  });
}

async function main() {
  const password = await readHiddenPassword();
  if (password.length < 8) throw new Error('Password must be at least 8 characters.');
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  const encoded = `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;
  process.stdout.write(`${encoded}\n`);
}

main().catch((error) => {
  if (error instanceof Error && error.message !== 'Cancelled') process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
