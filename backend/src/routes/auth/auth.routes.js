import express from 'express';
import { login, getMe,changePassword  } from '../../controllers/authController.js';
import {
  requestPasswordReset,
  resetPassword,
  checkResetToken,
} from '../../controllers/passwordResetController.js';
import { authenticate } from '../../middleware/auth.js';
import { authLimiter } from '../../middleware/rateLimiter.js';

const router = express.Router();

router.post('/login', authLimiter, login);
router.get('/me', authenticate, getMe);
router.post('/change-password', authenticate, changePassword);

/* ---- Password reset (public, rate limited) ---- */
router.post('/forgot-password', authLimiter, requestPasswordReset);
router.get('/reset-password/:token', checkResetToken);
router.post('/reset-password', authLimiter, resetPassword);

export default router;