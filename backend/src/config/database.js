// backend/src/config/database.js
//
// Environment-aware Sequelize setup.
//
//   - Local development talks to a local MySQL, normally without TLS.
//   - Production talks to a managed cloud MySQL, with TLS required.
//
// TLS is driven by DB_SSL rather than being hardcoded, so the same code works
// against both. Credentials come only from the environment: there are no
// in-source fallbacks, because a fallback password in a tracked file is a
// credential leak and silently lets production boot against the wrong database.

import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

// DB_PASS is the name this project has always used. DB_PASSWORD is accepted as
// an alias because several managed providers emit that name in their copy-paste
// connection details.
const dbPassword = process.env.DB_PASS ?? process.env.DB_PASSWORD;

const required = { DB_HOST: process.env.DB_HOST, DB_NAME: process.env.DB_NAME, DB_USER: process.env.DB_USER };
const missing = Object.entries(required)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (dbPassword === undefined) missing.push('DB_PASS');

if (missing.length) {
  // Fail loudly at boot rather than emitting confusing auth errors later.
  throw new Error(
    `Missing required database environment variable(s): ${missing.join(', ')}. ` +
      'Copy .env.sample to .env and fill these in.',
  );
}

// Managed MySQL providers (Aiven, RDS, DigitalOcean, Railway) terminate TLS
// with their own CA, which is not in Node's trust store. Verification is
// therefore disabled unless a CA certificate is supplied via DB_SSL_CA.
//
// Set DB_SSL=true in production. Opting out there requires DB_SSL=false
// explicitly, so an unset variable can never silently downgrade production to
// an unencrypted connection.
const sslEnabled = process.env.DB_SSL
  ? process.env.DB_SSL === 'true'
  : isProduction;

const dialectOptions = {
  // Keep DATE/DATETIME handling identical to the previous configuration.
  dateStrings: false,
  ...(sslEnabled
    ? {
        ssl: process.env.DB_SSL_CA
          ? { ca: process.env.DB_SSL_CA, rejectUnauthorized: true }
          : { rejectUnauthorized: false },
      }
    : {}),
};

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  dbPassword,
  {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    dialect: 'mysql',

    // Query logging echoes row data and is extremely noisy in production.
    // It stays available locally via DB_LOGGING=true.
    logging:
      process.env.DB_LOGGING === 'true'
        ? console.log
        : !isProduction && process.env.DB_LOGGING !== 'false'
          ? console.log
          : false,

    dialectOptions,

    pool: {
      // Managed free/entry tiers cap total connections (Aiven's smallest plans
      // allow ~20). Render can run several instances against the same database,
      // so this stays conservative.
      max: Number(process.env.DB_POOL_MAX) || (isProduction ? 10 : 5),
      min: Number(process.env.DB_POOL_MIN) || 0,
      acquire: Number(process.env.DB_POOL_ACQUIRE) || 30000,
      // Release idle connections before a managed provider's idle timeout
      // closes them underneath the pool.
      idle: Number(process.env.DB_POOL_IDLE) || 10000,
      evict: 1000,
    },

    // Reconnect instead of failing permanently on transient network blips,
    // which matter more once the database is a network hop away.
    retry: {
      max: 3,
      match: [
        /ETIMEDOUT/,
        /EHOSTUNREACH/,
        /ECONNRESET/,
        /ECONNREFUSED/,
        /PROTOCOL_CONNECTION_LOST/,
        /SequelizeConnectionError/,
      ],
    },

    define: {
      charset: 'utf8mb4',
      collate: 'utf8mb4_0900_ai_ci',
    },

    timezone: process.env.DB_TIMEZONE || '+05:30',
  },
);

/**
 * Connection summary safe to log: host, port and database only, never the
 * user or password.
 */
export const describeConnection = () =>
  `${process.env.DB_HOST}:${process.env.DB_PORT || 3306}/${process.env.DB_NAME}` +
  ` (tls=${sslEnabled ? 'on' : 'off'})`;

export { sequelize };
export default sequelize;
