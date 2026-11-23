// backend/src/config/auth.js
//
// Single source of truth for the JWT signing secret.
//
// Previously both authController.js and middleware/auth.js inlined
// `process.env.JWT_SECRET || 'your-secret-key-change-in-production'`. That
// fallback meant a deployment missing JWT_SECRET would still boot and happily
// sign tokens with a value published in the repository, letting anyone mint a
// valid super_admin token. The secret is now required, and absence is a
// startup failure rather than a silent downgrade.

import dotenv from 'dotenv';

dotenv.config();

const MIN_SECRET_LENGTH = 32;

const secret = process.env.JWT_SECRET;

if (!secret) {
  throw new Error(
    'JWT_SECRET is not set. Generate one with `openssl rand -hex 32` and add ' +
      'it to the environment. The server will not start without it.',
  );
}

if (secret.length < MIN_SECRET_LENGTH) {
  throw new Error(
    `JWT_SECRET is too short (${secret.length} chars). Use at least ` +
      `${MIN_SECRET_LENGTH} characters: openssl rand -hex 32`,
  );
}

export const JWT_SECRET = secret;
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
