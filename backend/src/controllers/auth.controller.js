import { supabase } from '../config/supabase.js';
import { AuditAction, getClientIp, logAction } from '../utils/auditLog.js';

const isProd = process.env.NODE_ENV === 'production';

const cookieOpts = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? 'none' : 'strict',
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  path: '/',
};

// PHASE 1 §4 — Set the httpOnly cookie on every successful signup/login response.
// The JSON body still returns session.access_token so the live frontend keeps
// working through the deploy; new frontends should rely on the cookie alone.
const setAuthCookie = (res, token) => {
  if (token) res.cookie('auth_token', token, cookieOpts);
};

export const signup = async (req, res) => {
  const { email, password, username } = req.body;

  // Joi schema already enforced email + password + username — no need
  // to re-validate here. username is already lowercased server-side.

  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    await logAction({
      action: AuditAction.LOGIN_FAILED, // closest existing event for signup errors
      metadata: { email, reason: 'signup_failed', message: error.message },
      ipAddress: getClientIp(req),
    });
    return res.status(400).json({ error: error.message });
  }

  // PHASE 6 §A — pre-flight username uniqueness check. The DB has a
  // unique partial index on lower(username), but a friendly 409 here
  // reads better than surfacing a Postgres 23505. Skip when the auth
  // signup itself failed (no user to attach a username to).
  const { data: existing } = await supabase
    .from('game_profiles')
    .select('user_id')
    .ilike('username', username)
    .maybeSingle();
  if (existing) {
    return res.status(409).json({ error: 'Username already taken' });
  }

  // Insert into public.users (required for foreign key references in solo_sessions, duel_sessions, etc.)
  const { error: usersInsertError } = await supabase
    .from('users')
    .insert({
      id: data.user.id,
      wallet_address: null,
      tier: null,
      rating: 1000,
      username,
    });

  if (usersInsertError) {
    console.error('Users table insert error:', usersInsertError);
    return res.status(500).json({
      error: 'User created but profile creation failed',
    });
  }

  // Create the game profile row
  const { error: insertError } = await supabase
    .from('game_profiles')
    .insert({
      user_id: data.user.id,
      wallet_address: null,
      tier: null,
      rating: 1000,
      username,
    });

  if (insertError) {
    console.error('Insert error:', insertError);
    return res.status(500).json({
      error: 'User created but profile creation failed',
    });
  }

  // PHASE 1 §4 — issue the cookie if signup also returned a session
  if (data.session?.access_token) {
    setAuthCookie(res, data.session.access_token);
  }

  await logAction({
    userId: data.user.id,
    action: AuditAction.SIGNUP,
    metadata: { email, username },
    ipAddress: getClientIp(req),
  });

  await logAction({
    userId: data.user.id,
    action: AuditAction.USERNAME_SET,
    metadata: { username, initial: true },
    ipAddress: getClientIp(req),
  });

  return res.status(201).json({
    message: 'User registered successfully',
    user: data.user,
    session: data.session,
  });
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.message.includes('Invalid login credentials')) {
      await logAction({
        action: AuditAction.LOGIN_FAILED,
        metadata: { email, reason: 'invalid_credentials' },
        ipAddress: getClientIp(req),
      });
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    if (error.message.includes('Email not confirmed')) {
      await logAction({
        action: AuditAction.LOGIN_FAILED,
        metadata: { email, reason: 'email_not_confirmed' },
        ipAddress: getClientIp(req),
      });
      return res.status(403).json({ error: 'Email not confirmed. Please check your inbox.' });
    }

    await logAction({
      action: AuditAction.LOGIN_FAILED,
      metadata: { email, reason: 'other', message: error.message },
      ipAddress: getClientIp(req),
    });
    return res.status(400).json({ error: error.message });
  }

  // PHASE 1 §4 — set the httpOnly cookie
  if (data.session?.access_token) {
    setAuthCookie(res, data.session.access_token);
  }

  await logAction({
    userId: data.user.id,
    action: AuditAction.LOGIN,
    metadata: { email },
    ipAddress: getClientIp(req),
  });

  return res.status(200).json({
    message: 'User logged in successfully',
    user: data.user,
    session: data.session,
  });
};

// PHASE 1 §4.5 — Logout endpoint clears the cookie
export const logout = async (req, res) => {
  res.clearCookie('auth_token', { path: '/' });

  // Try to surface a userId for audit when we can. The token is optional here —
  // logout should always succeed at clearing the cookie.
  let userId = null;
  const token = req.cookies?.auth_token
    || req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    const { data } = await supabase.auth.getUser(token);
    userId = data?.user?.id || null;
  }

  await logAction({
    userId,
    action: AuditAction.LOGOUT,
    metadata: {},
    ipAddress: getClientIp(req),
  });

  return res.status(200).json({ success: true });
};
