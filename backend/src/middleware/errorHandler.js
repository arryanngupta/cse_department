// backend/src/middleware/errorHandler.js
//
// Previously this returned `err.message` verbatim for every unhandled error,
// so database failures surfaced to API clients as e.g.
//   {"error":"Unknown column 'content_json' in 'field list'"}
// which hands an attacker the live schema one request at a time.
//
// Errors are now split into two classes:
//   - Deliberate, client-safe errors (validation, conflicts, bad uploads, and
//     anything thrown with `statusCode` + `expose`) keep their message.
//   - Everything else is logged server-side with a correlation id and answered
//     with a generic message carrying that id, so a report can be traced back
//     to the log line without exposing internals.

import { randomUUID } from 'crypto';

const isProduction = process.env.NODE_ENV === 'production';

/** Errors a route deliberately raised for the client to read. */
export class ApiError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.expose = true;
  }
}

export const errorHandler = (err, req, res, _next) => {
  // Sequelize validation failures describe the caller's own payload.
  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({
      error: 'Validation error',
      details: err.errors.map((e) => ({ field: e.path, message: e.message })),
    });
  }

  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({
      error: 'Duplicate entry',
      details: err.errors.map((e) => ({ field: e.path, message: e.message })),
    });
  }

  if (err.name === 'SequelizeForeignKeyConstraintError') {
    return res.status(409).json({
      error: 'This record is referenced by other content and cannot be changed',
    });
  }

  // Multer rejects oversized or wrong-typed uploads before the route runs.
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File is too large' });
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ error: 'Unexpected file field' });
  }
  if (
    err.message ===
    'Invalid file type. Only JPEG, PNG, WEBP, and PDF are allowed.'
  ) {
    return res.status(400).json({ error: err.message });
  }

  // Malformed JSON bodies.
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed JSON body' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body is too large' });
  }

  // Errors a route raised on purpose for the client.
  if (err.expose && err.statusCode) {
    return res.status(err.statusCode).json({
      error: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
  }

  // Anything else is unexpected. Log it in full, tell the client nothing.
  const errorId = randomUUID();
  console.error(
    `[${errorId}] ${req.method} ${req.originalUrl} ->`,
    err?.stack || err,
  );

  const statusCode = err.statusCode || 500;
  return res.status(statusCode).json({
    error:
      statusCode >= 500
        ? 'Internal server error'
        : err.message || 'Request failed',
    errorId,
    // The real message is still useful while developing locally.
    ...(isProduction ? {} : { debug: err?.message }),
  });
};
