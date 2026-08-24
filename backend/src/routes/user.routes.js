import express from 'express';
import { verifyUser, requireVerified } from '../middleware/auth.middleware.js';
import { linkWallet, setTier, getProfile } from '../controllers/user.controller.js';
import { walletLimiter } from '../middleware/rateLimiter.js';
import { validate, schemas } from '../middleware/validate.js';

const router = express.Router();

// PHASE 1 §1: tight wallet-link limiter BEFORE auth so spammers get 429 fast
router.post(
  '/link-wallet',
  walletLimiter,
  verifyUser,
  requireVerified,
  validate(schemas.walletLinkSchema),
  linkWallet
);

router.post(
  '/set-tier',
  verifyUser,
  requireVerified,
  validate(schemas.tierSchema),
  setTier
);

// /profile is intentionally NOT behind requireVerified so that the front-end's
// /redirect handler can still read is_setup_complete even if the user hasn't
// confirmed their email yet. The 403 'verify your email' response banner comes
// from the response interceptor.
router.get('/profile', verifyUser, getProfile);

export default router;
