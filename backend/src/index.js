import express from 'express';
import path from 'node:path';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import routes from './routes/index.js';
import { errorHandler, ApiError } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { sequelize, describeConnection } from './config/database.js';
import sitemapRoutes from './routes/sitemap.routes.js';
import { startScheduler, stopScheduler } from './services/schedulerService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3022;
const isProduction = process.env.NODE_ENV === 'production';

// Render terminates TLS at its proxy. Without this, express-rate-limit buckets
// every request under the proxy's IP and `req.ip` is useless for limiting.
app.set('trust proxy', 1);

// Do not advertise Express to the world.
app.disable('x-powered-by');

// Helmet Security
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'blob:', '*'],
        mediaSrc: ["'self'", 'data:', 'blob:', '*'],
      },
    },
  }),
);

// CORS
//
// The previous allowlist contained the regex /\.vercel\.app$/, which matches
// *every* site hosted on Vercel — any third party could call this API from
// their own deployment with credentials attached. Origins are now exact
// strings supplied by ORIGIN (comma-separated).
const configuredOrigins = (process.env.ORIGIN || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const allowedOrigins = configuredOrigins.length
  ? configuredOrigins
  : ['http://localhost:3021', 'http://localhost:5173'];

if (isProduction && !configuredOrigins.length) {
  throw new Error(
    'ORIGIN must list the allowed frontend origins in production ' +
      '(comma-separated, e.g. https://cse.lnmiit.ac.in).',
  );
}

app.use(
  cors({
    origin(origin, callback) {
      // Same-origin and non-browser clients (curl, server-to-server, health
      // probes) send no Origin header at all.
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      // Answer 403 rather than letting this surface as an opaque 500.
      return callback(new ApiError(403, 'Origin not allowed'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

app.use(morgan(isProduction ? 'combined' : 'dev'));

// Explicit body limits. Uploads go through multer, so JSON bodies never need
// to be large; an unbounded parser is a cheap denial-of-service vector.
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Liveness: the process is up. Deliberately does not touch the database so a
// database blip cannot cause the platform to kill an otherwise healthy process.
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// Readiness: the process can actually serve traffic, database included.
app.get('/ready', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.json({ status: 'ready', database: 'connected' });
  } catch {
    // No error detail: this endpoint is public and the message would name the
    // database host.
    res.status(503).json({ status: 'not-ready', database: 'unavailable' });
  }
});

/*
 * Locally-stored uploads.
 *
 * New uploads go to Cloudinary, but older records still reference paths like
 * /uploads/pdfs/<file>.pdf — and with no handler mounted, every one of those
 * returned 404 while the UI happily rendered a "Download Curriculum" button
 * next to it. Files that genuinely exist on disk now serve.
 *
 * Options worth naming:
 *   index/redirect false — no directory listing and no implicit index file, so
 *     this cannot be browsed as a file manager.
 *   dotfiles deny — a stray .env or .git inside the upload directory is never
 *     served, whatever else goes wrong.
 *   fallthrough true — a missing file continues to the 404 handler below
 *     rather than ending the request here.
 *
 * express.static resolves within the root and rejects traversal, so a
 * ../../ path cannot escape the upload directory.
 */
const uploadDir = path.resolve(process.env.UPLOAD_DIR || './src/uploads');
app.use(
  '/uploads',
  express.static(uploadDir, {
    index: false,
    redirect: false,
    dotfiles: 'deny',
    fallthrough: true,
    maxAge: isProduction ? '7d' : 0,
  }),
);

// API Routes
app.use('/api', apiLimiter, routes);
app.use('/', sitemapRoutes);

// Unknown API routes should answer as JSON, not fall through to the error
// handler as an opaque 500.
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    await sequelize.authenticate();
    // describeConnection() prints host/port/database but never user or password.
    console.log(`✓ Database connected: ${describeConnection()}`);

    // Durable scheduled publication. State lives in the database, so a
    // restart loses nothing: the first tick catches up on anything that came
    // due while the process was down.
    startScheduler();

    const server = app.listen(PORT, () => {
      console.log(`✓ Server running on port ${PORT}`);
      console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Let in-flight requests finish and close the pool, so a redeploy does not
    // cut off responses mid-write or leak connections on the database side.
    const shutdown = (signal) => {
      console.log(`${signal} received, shutting down`);
      stopScheduler();

      server.close(async () => {
        try {
          await sequelize.close();
        } catch {
          // Already closed or never opened; nothing useful to report.
        }
        process.exit(0);
      });

      // Don't hang forever if a connection refuses to drain.
      setTimeout(() => process.exit(1), 10000).unref();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    // Log only the driver's error code. The full Sequelize error object embeds
    // the connection config, which includes the database password.
    console.error(
      '✗ Unable to connect to the database:',
      error?.parent?.code || error?.message || 'unknown error',
    );
    process.exit(1);
  }
};

startServer();

export default app;
