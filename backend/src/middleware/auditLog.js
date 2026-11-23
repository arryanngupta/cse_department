// backend/src/middleware/auditLog.js
//
// Records administrative mutations.
//
// Implemented as middleware rather than per-controller calls so coverage does
// not depend on remembering to add a line to each of the ~60 admin handlers,
// and so a new admin route is audited by default.
//
// Only state-changing methods are logged. GETs would bury real changes in
// page-view noise.

import { AuditLog } from '../db/models/index.js';

/** Keys whose VALUES must never be written to the log. */
const SENSITIVE_KEYS = new Set([
  'password',
  'password_hash',
  'passwordhash',
  'confirmpassword',
  'newpassword',
  'currentpassword',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'apikey',
  'api_key',
  'secret',
  'jwt',
]);

const METHOD_TO_ACTION = {
  POST: 'create',
  PUT: 'update',
  PATCH: 'update',
  DELETE: 'delete',
};

/**
 * Derive a resource name and id from the path.
 *
 *   /api/admin/news/12                -> { resource: 'news', id: '12' }
 *   /api/admin/programs/3/sections    -> { resource: 'programs/sections', id: '3' }
 *   /api/admin/events/registrations/8 -> { resource: 'events/registrations', id: '8' }
 */
const describeResource = (path) => {
  const parts = path
    .replace(/^\/+|\/+$/g, '')
    .split('/')
    .filter((p) => p && p !== 'api' && p !== 'admin');

  if (!parts.length) return { resource: 'unknown', resourceId: null };

  const numericIndex = parts.findIndex((p) => /^\d+$/.test(p));

  if (numericIndex === -1) {
    return { resource: parts.join('/'), resourceId: null };
  }

  const resource = [
    ...parts.slice(0, numericIndex),
    ...parts.slice(numericIndex + 1),
  ]
    .filter(Boolean)
    .join('/');

  return { resource: resource || parts[0], resourceId: parts[numericIndex] };
};

/**
 * Field names present in the request body, excluding sensitive ones.
 *
 * Names only — never values. A bio edit should not duplicate the bio into the
 * log, and a password change must leave no trace of the password.
 */
const changedFieldNames = (body) => {
  if (!body || typeof body !== 'object') return null;

  const names = Object.keys(body).filter(
    (key) => !SENSITIVE_KEYS.has(key.toLowerCase()),
  );

  return names.length ? names.join(', ').slice(0, 2000) : null;
};

/** Short human-readable summary. Uses a title/name if the payload carries one. */
const buildSummary = (action, resource, body) => {
  const label =
    body && typeof body === 'object'
      ? body.title || body.name || body.key || null
      : null;

  const base = `${action} ${resource}`;
  return (label ? `${base} "${String(label).slice(0, 120)}"` : base).slice(0, 255);
};

/**
 * Audit middleware.
 *
 * Mount after `authenticate` so `req.user` is populated. The row is written
 * after the response finishes, and only for a 2xx — a rejected or failed
 * request did not change anything, so logging it as a change would be wrong.
 */
export const auditLog = (req, res, next) => {
  const action = METHOD_TO_ACTION[req.method];
  if (!action) return next();

  // Captured now: body-parsing middleware or the handler may mutate req.body.
  const body = req.body;

  res.on('finish', () => {
    if (res.statusCode < 200 || res.statusCode >= 300) return;

    const { resource, resourceId } = describeResource(req.originalUrl.split('?')[0]);

    // Writing the log must never break the request that succeeded, so this is
    // fire-and-forget with its own error handling.
    AuditLog.create({
      user_id: req.user?.id ?? null,
      actor_email: req.user?.email ?? null,
      actor_role: req.user?.role ?? null,
      action,
      resource,
      resource_id: resourceId,
      summary: buildSummary(action, resource, body),
      changed_fields: changedFieldNames(body),
      method: req.method,
      path: req.originalUrl.split('?')[0].slice(0, 255),
      status_code: res.statusCode,
      ip: (req.ip || '').slice(0, 45),
      user_agent: (req.get('user-agent') || '').slice(0, 255),
    }).catch((error) => {
      console.error('Failed to write audit log:', error?.message);
    });
  });

  next();
};

/**
 * Record an authentication event explicitly.
 *
 * Login is not an admin mutation, so it does not pass through the middleware
 * above, but "who signed in and when" is exactly what an audit trail is for.
 */
export const recordAuthEvent = async ({ req, user, action, success }) => {
  try {
    await AuditLog.create({
      user_id: user?.id ?? null,
      actor_email: user?.email ?? (req.body?.email ? String(req.body.email).slice(0, 160) : null),
      actor_role: user?.role ?? null,
      action,
      resource: 'auth',
      resource_id: null,
      summary: `${action}${success ? '' : ' (failed)'}`,
      changed_fields: null,
      method: req.method,
      path: req.originalUrl.split('?')[0].slice(0, 255),
      status_code: success ? 200 : 401,
      ip: (req.ip || '').slice(0, 45),
      user_agent: (req.get('user-agent') || '').slice(0, 255),
    });
  } catch (error) {
    console.error('Failed to write auth audit log:', error?.message);
  }
};
