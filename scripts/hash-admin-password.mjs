import { randomBytes, scryptSync } from "node:crypto";

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const password = Buffer.concat(chunks).toString("utf8").replace(/\r?\n$/, "");
if (password.length < 14) {
  console.error(
    "Password must be at least 14 characters.\n" +
      "Usage (password is read from stdin, never from argv, to keep it out of process listings):\n" +
      "  printf '%s' 'your-long-password' | node scripts/hash-admin-password.mjs"
  );
  process.exit(1);
}

const salt = randomBytes(16);
const hash = scryptSync(password, salt, 64);
console.log(`scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`);
