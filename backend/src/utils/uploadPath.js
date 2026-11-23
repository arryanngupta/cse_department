// backend/src/utils/uploadPath.js
//
// Whether a stored file path can actually be served.
//
// Records predating the move to Cloudinary still hold paths like
// /uploads/pdfs/btech-cse-curriculum.pdf. Four of those files are simply not
// on disk any more, but the API went on returning the path and the UI went on
// rendering a "Download Curriculum" button beside it — a link that 404s is
// worse than an absent one, because the visitor concludes the site is broken
// rather than that the file was never published.
//
// Absolute URLs (Cloudinary) are returned untouched: this process cannot and
// should not probe a remote host on every request.

import fs from 'node:fs';
import path from 'node:path';

const uploadRoot = () => path.resolve(process.env.UPLOAD_DIR || './src/uploads');

/** True for a remote URL, which is assumed good and never probed. */
const isRemote = (value) => /^https?:\/\//i.test(String(value || ''));

/**
 * Resolve a stored path to a file on disk, or null.
 *
 * Returns null for anything that escapes the upload root, so a stored value of
 * `/uploads/../../etc/passwd` can never be reported as servable.
 */
const resolveLocal = (value) => {
  const raw = String(value || '').trim();
  if (!raw.startsWith('/uploads/')) return null;

  const root = uploadRoot();
  const resolved = path.resolve(root, '.' + raw.slice('/uploads'.length));

  // path.resolve collapses traversal; confirm the result is still inside root.
  if (resolved !== root && !resolved.startsWith(root + path.sep)) return null;

  return resolved;
};

/**
 * Is this stored path servable right now?
 *
 * Remote URLs: yes. Local paths: only if the file exists.
 *
 * The existence check is a synchronous `statSync` on a handful of files per
 * request. That is a cached inode lookup, not I/O worth optimising, and it
 * runs only on endpoints that return file paths.
 */
export const isServableFile = (value) => {
  if (!value) return false;
  if (isRemote(value)) return true;

  const resolved = resolveLocal(value);
  if (!resolved) return false;

  try {
    return fs.statSync(resolved).isFile();
  } catch {
    return false;
  }
};

/**
 * The path if it can be served, otherwise null.
 *
 * Returning null rather than the dead path lets the frontend hide the download
 * control with its existing `{path && ...}` guard — no UI change needed, and
 * any future consumer gets the same correct answer.
 */
export const servableFileOrNull = (value) => (isServableFile(value) ? value : null);
