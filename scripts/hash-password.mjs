// Prints a VITE_SITE_KEY value for a site-wide password.
//   node scripts/hash-password.mjs "your long password"
// Put the output in .env.local (VITE_SITE_KEY=...) or your host's env settings,
// then rebuild. A fresh browser must enter this password before setup.
import { pbkdf2Sync, randomBytes } from 'node:crypto';

const password = process.argv[2];
if (!password) {
  console.error('Usage: node scripts/hash-password.mjs "your password"');
  process.exit(1);
}
const iterations = 310000;
const salt = randomBytes(16);
const hash = pbkdf2Sync(password, salt, iterations, 32, 'sha256');
console.log(`VITE_SITE_KEY=${salt.toString('base64')}:${hash.toString('base64')}:${iterations}`);
