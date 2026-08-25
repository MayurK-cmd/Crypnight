import Joi from 'joi';
import { TIER_NAMES_ALL } from '../utils/tiers.js';

// Reusable validator middleware factory (PHASE 1 §3.2)
export const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({
      error: 'Validation failed',
      details: error.details.map((d) => d.message),
    });
  }
  next();
};

// PHASE 1 §3.2 — Auth schemas
export const signupSchema = Joi.object({
  email: Joi.string().email().max(254).required(),
  // PHASE 6 §A — unique username. Lowercased + normalized server-side;
  // 3–20 chars, lowercase a-z + digits + underscore only.
  username: Joi.string()
    .min(3)
    .max(20)
    .pattern(/^[a-z0-9_]+$/, 'lowercase letters, digits, underscore')
    .lowercase()
    .required()
    .messages({
      'string.pattern.name': 'Username must contain only {#name}',
      'string.min': 'Username must be at least 3 characters',
      'string.max': 'Username must be at most 20 characters',
    }),
  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(/[A-Z]/, 'uppercase')
    .pattern(/[a-z]/, 'lowercase')
    .pattern(/[0-9]/, 'number')
    .pattern(/[^A-Za-z0-9]/, 'special character')
    .required()
    .messages({
      'string.pattern.name': 'Password must contain at least one {#name}',
      'string.min': 'Password must be at least 8 characters',
    }),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().max(254).required(),
  password: Joi.string().max(128).required(),
});

// PHASE 1 §3.2 — Wallet schema (Stellar G-account, 56 chars, base32 with checksum)
export const walletLinkSchema = Joi.object({
  walletAddress: Joi.string()
    .pattern(/^G[A-Z2-7]{55}$/)
    .required()
    .messages({ 'string.pattern.base': 'Invalid Stellar wallet address' }),
  signature: Joi.string().max(4096).required(),
  message: Joi.string().max(256).required(),
});

// Tier selection — accepts the canonical short names plus the long-form aliases
// that the existing setTier controller maps to the same buckets.
export const tierSchema = Joi.object({
  tier: Joi.string()
    .valid(...TIER_NAMES_ALL)
    .required(),
});

// Puzzle move submission — keeps `session_id` snake_case to match Solo.jsx
// (PHASE 1 §3.2 lists `sessionId`; the live frontend uses `session_id` so
// we accept both via the alternate name.)
export const soloMoveSchema = Joi.object({
  session_id: Joi.string().required(),
  sessionId: Joi.string().optional(),
  move: Joi.string()
    .pattern(/^[a-h][1-8][a-h][1-8][qrbn]?$/)
    .required()
    .messages({ 'string.pattern.base': 'Invalid move format. Use UCI notation (e.g. e2e4)' }),
});

// Solo start — PHASE 5: puzzle_id is optional. The backend now picks
// the next puzzle via the adaptive rating band on /puzzle, and the
// start endpoint just creates (or resumes) the session row.
export const soloStartSchema = Joi.object({
  puzzle_id: Joi.string().optional(),
});

// Solo finalize
export const soloSubmitSchema = Joi.object({
  session_id: Joi.string().required(),
});

// Solo fail — back-compat shim for older clients. New flow handles
// 3-strike detection inline in /solo/move.
export const soloFailSchema = Joi.object({
  session_id: Joi.string().required(),
});

// PHASE 5 — explicit session-end endpoint. The frontend uses auto-end
// only; this route exists for tests and the cron path.
export const soloEndSchema = Joi.object({
  session_id: Joi.string().required(),
});

// Round-puzzle-complete
export const roundCompleteSchema = Joi.object({
  round_session_id: Joi.string().required(),
  puzzle_id: Joi.string().required(),
  puzzle_rating: Joi.number().integer().required(),
  solved: Joi.boolean().optional(),
  wrong_moves: Joi.number().integer().min(0).max(10).optional(),
  time_taken: Joi.number().integer().min(0).optional(),
});

export const schemas = {
  signupSchema,
  loginSchema,
  walletLinkSchema,
  tierSchema,
  soloMoveSchema,
  soloStartSchema,
  soloSubmitSchema,
  soloFailSchema,
  soloEndSchema,
  roundCompleteSchema,
};
