import express from 'express';
import { signup, login, logout } from '../controllers/auth.controller.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { validate, schemas } from '../middleware/validate.js';

const router = express.Router();

// PHASE 1 §1 + §3 — rate limit THEN validate (so 429 fires before parsing)
router.post('/signup', authLimiter, validate(schemas.signupSchema), signup);
router.post('/login', authLimiter, validate(schemas.loginSchema), login);
router.post('/logout', logout);

export default router;
