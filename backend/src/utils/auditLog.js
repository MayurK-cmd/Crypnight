import { supabase } from '../config/supabase.js';

// PHASE 1 §7.2 — Canonical action names
export const AuditAction = {
  SIGNUP: 'auth.signup',
  LOGIN: 'auth.login',
  LOGIN_FAILED: 'auth.login_failed',
  LOGOUT: 'auth.logout',
  WALLET_LINKED: 'wallet.linked',
  WALLET_LINK_FAILED: 'wallet.link_failed',
  TIER_SELECTED: 'user.tier_selected',
  USERNAME_SET: 'user.username_set',
  PUZZLE_SOLVED: 'game.puzzle_solved',
  PUZZLE_FAILED: 'game.puzzle_failed',
};

export const getClientIp = (req) =>
  req.headers['x-forwarded-for']?.split(',')[0].trim() ||
  req.socket?.remoteAddress ||
  null;

export const logAction = async ({ userId, action, metadata = {}, ipAddress }) => {
  try {
    await supabase.from('audit_logs').insert({
      user_id: userId || null,
      action,
      metadata,
      ip_address: ipAddress || null,
    });
  } catch (err) {
    // Never let audit logging crash the request
    console.error('[audit_log] Failed to write:', err.message);
  }
};
