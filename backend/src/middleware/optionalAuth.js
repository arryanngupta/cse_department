// backend/src/middleware/optionalAuth.js
//
// Authentication for endpoints that serve both anonymous visitors and
// logged-in users.
//
// The distinction that matters for security: a *missing* Authorization header
// is an anonymous request, but a *present but invalid* one is an error. The
// obvious implementation — try to verify, fall back to anonymous on failure —
// silently downgrades an expired faculty token to a public session. That is
// wrong twice over: the user is told nothing, and a token that should be
// rejected instead buys access to the public corpus. Expired and tampered
// tokens are rejected with 401 here.

import jwt from 'jsonwebtoken';
import { User, People } from '../db/models/index.js';
import { JWT_SECRET } from '../config/auth.js';

/**
 * Populates `req.user` when a valid bearer token is supplied, leaves it null
 * when no Authorization header is present, and rejects anything in between.
 *
 * Mirrors the shape produced by `authenticate` so downstream code can treat
 * the two identically.
 */
export const optionalAuthenticate = async (req, res, next) => {
  const header = req.headers.authorization;

  // No credentials offered: a legitimate anonymous visitor.
  if (!header) {
    req.user = null;
    return next();
  }

  const [scheme, token] = header.split(' ');

  if (!/^Bearer$/i.test(scheme || '') || !token) {
    return res.status(401).json({ error: 'Invalid authorization header' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await User.findByPk(decoded.id, {
      attributes: { exclude: ['password_hash'] },
    });

    if (!user) {
      // The token verified but the account is gone (deleted or recreated).
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Resolved from the database by user_id, never from the token payload —
    // a token claim naming a person_id would otherwise be trusted.
    const facultyProfile = await People.findOne({
      where: { user_id: user.id },
      attributes: ['id', 'slug', 'name', 'designation', 'department'],
    });

    req.user = {
      ...user.get({ plain: true }),
      facultyProfile: facultyProfile ? facultyProfile.get({ plain: true }) : null,
    };

    return next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

export default optionalAuthenticate;
