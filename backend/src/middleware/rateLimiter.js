import rateLimit from 'express-rate-limit';

const DEV_MODE = process.env.NODE_ENV === 'development';

// Auth endpoints: key on `email || IP` so a single user's typo-loop is
// isolated from other users on the same IP (corporate NAT, dev localhost, etc).
// The IP fallback still protects against an attacker who rotates emails.
const authKey = (req) => {
  const email = req.body?.email?.toLowerCase().trim();
  return email ? `email:${email}` : `ip:${req.ip}`;
};

const retryAfter = (req, res) => {
  const secs = Math.ceil(req.rateLimit.resetTime?.getTime() - Date.now() / 1000) || 60;
  res.set('Retry-After', String(secs));
};

// PHASE 1 §1 — Tight limit for auth endpoints (brute force protection)
// Development mode: very generous limits (1000 attempts per hour)
// Production: 10 attempts per 15 minutes
export const authLimiter = DEV_MODE ? rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 1000, // 1000 attempts per hour in dev
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: authKey,
  handler: (req, res) => {
    retryAfter(req, res);
    res.status(429).json({
      error: 'Too many attempts. Please try again later.',
    });
  },
}) : rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: authKey,
  handler: (req, res) => {
    retryAfter(req, res);
    res.status(429).json({
      error: 'Too many attempts. Please try again in 15 minutes.',
    });
  },
});

// PHASE 1 §1 — General API limit (prevents scraping / DoS)
// Development: very generous (10000 per minute)
// Production: 60 per minute
export const apiLimiter = DEV_MODE ? rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10000, // 10000 attempts per minute in dev
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  handler: (req, res) => res.status(429).json({ error: 'Rate limit exceeded. Slow down.' }),
}) : rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  handler: (req, res) => res.status(429).json({ error: 'Rate limit exceeded. Slow down.' }),
});

// PHASE 1 §1 — Wallet linking: sensitive, keep very tight
// Development: generous (100 per hour)
// Production: 5 per hour
export const walletLimiter = DEV_MODE ? rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  handler: (req, res) => {
    retryAfter(req, res);
    res.status(429).json({ error: 'Too many wallet link attempts. Try again later.' });
  },
}) : rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  handler: (req, res) => {
    retryAfter(req, res);
    res.status(429).json({ error: 'Too many wallet link attempts. Try again in an hour.' });
  },
});
