// backend/src/controllers/passwordResetController.js

import crypto from 'crypto';
import { Op } from 'sequelize';
import { User, PasswordReset } from '../db/models/index.js';
import { ApiError } from '../middleware/errorHandler.js';
import { sendTemplate } from '../services/emailService.js';
import { recordAuthEvent } from '../middleware/auditLog.js';

const TOKEN_TTL_MINUTES = Number(process.env.PASSWORD_RESET_TTL_MINUTES) || 60;
const MIN_PASSWORD_LENGTH = 8;

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

/**
 * POST /api/auth/forgot-password  { email }
 *
 * Always answers 200 with the same message, whether or not the address exists.
 * A different response for an unknown address turns this endpoint into an
 * account-enumeration oracle.
 */
export const requestPasswordReset = async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();

    const genericResponse = {
      data: {
        message:
          'If that email address has an account, a reset link has been sent to it.',
      },
    };

    if (!email || !email.includes('@')) {
      // Still generic — a validation error would also leak which inputs are
      // plausible addresses.
      return res.json(genericResponse);
    }

    const user = await User.findOne({ where: { email } });

    if (!user) {
      await recordAuthEvent({
        req,
        user: null,
        action: 'password_reset_request',
        success: false,
      });
      return res.json(genericResponse);
    }

    // Invalidate any outstanding tokens, so only the newest link works.
    await PasswordReset.update(
      { used_at: new Date() },
      { where: { user_id: user.id, used_at: null } },
    );

    // 32 random bytes: the token is the only secret protecting the account.
    const token = crypto.randomBytes(32).toString('hex');

    await PasswordReset.create({
      user_id: user.id,
      token_hash: hashToken(token),
      expires_at: new Date(Date.now() + TOKEN_TTL_MINUTES * 60_000),
      requested_ip: (req.ip || '').slice(0, 45),
    });

    const base = (process.env.SITE_DOMAIN || 'http://localhost:3021').replace(/\/$/, '');
    const resetUrl = `${base}/admin/reset-password?token=${token}`;

    const result = await sendTemplate('passwordReset', {
      to: user.email,
      name: user.name,
      resetUrl,
      expiresInMinutes: TOKEN_TTL_MINUTES,
    });

    await recordAuthEvent({
      req,
      user,
      action: 'password_reset_request',
      success: true,
    });

    // With no mailer configured the link cannot reach the user. Surfacing it
    // in the response is acceptable in development but would be a severe hole
    // in production, so it is gated on NODE_ENV.
    if (result.skipped && process.env.NODE_ENV !== 'production') {
      return res.json({
        data: {
          ...genericResponse.data,
          devNote:
            'No email provider is configured, so the link is returned here for development only.',
          devResetUrl: resetUrl,
        },
      });
    }

    return res.json(genericResponse);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/reset-password  { token, password }
 */
export const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body || {};

    if (!token || typeof token !== 'string') {
      throw new ApiError(400, 'A reset token is required');
    }

    if (!password || String(password).trim().length < MIN_PASSWORD_LENGTH) {
      throw new ApiError(
        400,
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`,
      );
    }

    const record = await PasswordReset.findOne({
      where: {
        token_hash: hashToken(token),
        used_at: null,
        expires_at: { [Op.gt]: new Date() },
      },
    });

    if (!record) {
      // One message for expired, already-used and non-existent: distinguishing
      // them tells an attacker which tokens were real.
      throw new ApiError(400, 'This reset link is invalid or has expired');
    }

    const user = await User.findByPk(record.user_id);
    if (!user) throw new ApiError(400, 'This reset link is invalid or has expired');

    // The model hashes on save, so the plain value is assigned here.
    await user.update({ password_hash: password, must_change_password: false });

    // Single use.
    await record.update({ used_at: new Date() });

    await recordAuthEvent({ req, user, action: 'password_reset', success: true });

    res.json({
      data: { message: 'Your password has been updated. You can now sign in.' },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/auth/reset-password/:token — check a link before showing the form.
 *
 * Returns only whether the token is usable, never who it belongs to.
 */
export const checkResetToken = async (req, res, next) => {
  try {
    const record = await PasswordReset.findOne({
      where: {
        token_hash: hashToken(String(req.params.token || '')),
        used_at: null,
        expires_at: { [Op.gt]: new Date() },
      },
      attributes: ['id', 'expires_at'],
    });

    res.json({
      data: {
        valid: Boolean(record),
        expiresAt: record?.expires_at ?? null,
      },
    });
  } catch (error) {
    next(error);
  }
};

/** Remove expired and consumed tokens. Called by the scheduler sweep. */
export const purgeExpiredResets = async () => {
  try {
    const removed = await PasswordReset.destroy({
      where: {
        [Op.or]: [
          { expires_at: { [Op.lt]: new Date() } },
          { used_at: { [Op.ne]: null } },
        ],
      },
    });
    return removed;
  } catch (error) {
    console.error('Failed to purge password resets:', error?.message);
    return 0;
  }
};
