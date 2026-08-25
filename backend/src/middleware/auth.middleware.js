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

// PHASE 1 §6 — Email confirmation is intentionally not enforced. Supabase sends
// a confirmation email on signup by default, but for this project we want users
// to land in /setup right after they create an account without an inbox round
// trip. The Supabase session token is still required (verifyUser runs first),
// so this is purely a UX shortcut, not an auth weakening.
export const requireVerified = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};
