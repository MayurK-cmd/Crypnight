import { supabase } from '../config/supabase.js';

// PHASE 1 §4 — Read the auth token from the httpOnly cookie first; fall back to
// Authorization: Bearer for compatibility (e.g. server-to-server tools).
const extractToken = (req) => {
  if (req.cookies?.auth_token) return req.cookies.auth_token;
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.slice(7);
  return null;
};

export const verifyUser = async (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized, token missing' });
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    return res.status(401).json({ message: 'Unauthorized, invalid token' });
  }

  req.user = data.user;
  req.authToken = token;
  next();
};

// PHASE 1 §6 — Enforce that the user has confirmed their email.
// Run AFTER verifyUser (so req.user is populated).
export const requireVerified = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!req.user.email_confirmed_at) {
    return res.status(403).json({
      error: 'Please verify your email before continuing.',
    });
  }

  next();
};
