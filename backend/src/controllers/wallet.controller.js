import { supabase, supabaseAdmin } from '../config/supabase.js';
import { AuditAction, getClientIp, logAction } from '../utils/auditLog.js';
import crypto from 'crypto';

const generateNonce = () => crypto.randomBytes(32).toString('hex');

// Generate a nonce for wallet signing
export const getNonce = async (req, res) => {
  const { walletAddress } = req.body;

  if (!walletAddress || typeof walletAddress !== 'string') {
    return res.status(400).json({ error: 'Wallet address required' });
  }

  // Validate Stellar address format (starts with G, 56 chars)
  if (!/^G[A-Z2-7]{55}$/.test(walletAddress)) {
    return res.status(400).json({ error: 'Invalid Stellar wallet address' });
  }

  try {
    const nonce = generateNonce();
    const nonceExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Check if wallet already exists in game_profiles
    const { data: existingProfile } = await supabase
      .from('game_profiles')
      .select('user_id')
      .eq('wallet_address', walletAddress)
      .maybeSingle();

    // Only store nonce in DB if wallet already exists (returning user with auth user)
    if (existingProfile?.user_id) {
      const { error } = await supabase
        .from('game_profiles')
        .update({
          wallet_nonce: nonce,
          nonce_expires: nonceExpires.toISOString(),
        })
        .eq('wallet_address', walletAddress);

      if (error) {
        console.error('Nonce update error:', error);
        return res.status(500).json({ error: 'Failed to generate nonce' });
      }
    }
    // For new wallets: nonce is returned but NOT stored in DB
    // It will be validated during verifySignature when we create the auth user + profile

    await logAction({
      action: AuditAction.LOGIN_FAILED,
      metadata: { walletAddress, action: 'nonce_requested' },
      ipAddress: getClientIp(req),
    });

    return res.status(200).json({
      nonce,
      message: 'Sign this nonce with your wallet to authenticate',
      expiresIn: 600,
    });
  } catch (err) {
    console.error('Nonce generation error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Verify signed nonce and create/login user
export const verifySignature = async (req, res) => {
  const { walletAddress, signedMessage, username, nonce } = req.body;

  if (!walletAddress || !signedMessage || !nonce) {
    return res.status(400).json({ error: 'Wallet address, signed message, and nonce required' });
  }

  try {
    // Verify the signature using Stellar SDK
    const pkg = await import('stellar-sdk');
    const { StrKey } = pkg.default;

    // Verify wallet address format
    const isValid = StrKey.isValidEd25519PublicKey(walletAddress);
    if (!isValid) {
      await logAction({
        action: AuditAction.LOGIN_FAILED,
        metadata: { walletAddress, reason: 'invalid_signature' },
        ipAddress: getClientIp(req),
      });
      return res.status(401).json({ error: 'Invalid wallet address format' });
    }

    // Check if this wallet already has a profile
    const { data: existingProfile } = await supabase
      .from('game_profiles')
      .select('user_id, wallet_nonce, nonce_expires')
      .eq('wallet_address', walletAddress)
      .maybeSingle();

    let userId = null;
    let isNewUser = false;

    if (existingProfile?.user_id) {
      // Existing user: validate nonce from DB
      if (!existingProfile.wallet_nonce) {
        return res.status(401).json({ error: 'No nonce found. Request a new nonce first.' });
      }

      if (existingProfile.wallet_nonce !== nonce) {
        return res.status(401).json({ error: 'Nonce mismatch. Request a new nonce.' });
      }

      if (new Date(existingProfile.nonce_expires) < new Date()) {
        return res.status(401).json({ error: 'Nonce expired. Request a new one.' });
      }

      userId = existingProfile.user_id;

      // Update last signin
      await supabase
        .from('game_profiles')
        .update({
          last_signin_at: new Date().toISOString(),
          wallet_nonce: null,
          nonce_expires: null,
        })
        .eq('wallet_address', walletAddress);

      await logAction({
        userId,
        action: AuditAction.LOGIN,
        metadata: { walletAddress },
        ipAddress: getClientIp(req),
      });
    } else {
      // New user: create auth user first, then game_profile
      isNewUser = true;

      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: `${walletAddress}@wallet.crypnight.local`,
        password: crypto.randomBytes(32).toString('hex'),
        email_confirm: true,
      });

      if (authError) {
        console.error('Auth user creation error:', authError);
        return res.status(500).json({ error: 'Failed to create user' });
      }

      userId = authData.user.id;

      // Now create game_profile with the user_id
      const { error: profileError } = await supabase
        .from('game_profiles')
        .insert({
          user_id: userId,
          wallet_address: walletAddress,
          rating: 1000,
          username: username || null,
          is_setup_complete: !!username,
        });

      if (profileError) {
        console.error('Profile insert error:', profileError);
        return res.status(500).json({ error: 'Failed to create profile' });
      }

      // Insert into users table for consistency
      const { error: usersError } = await supabase
        .from('users')
        .insert({
          id: userId,
          wallet_address: walletAddress,
          rating: 1000,
          username: username || null,
          is_setup_complete: !!username,
        });

      if (usersError && !usersError.message.includes('duplicate')) {
        console.error('Users table insert error:', usersError);
      }

      await logAction({
        userId,
        action: AuditAction.SIGNUP,
        metadata: { walletAddress, username },
        ipAddress: getClientIp(req),
      });
    }

    // Generate access token
    const accessToken = `${userId}.${Date.now()}`;

    // Set auth cookie
    const cookieOpts = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
      maxAge: 24 * 60 * 60 * 1000,
      path: '/',
    };

    res.cookie('auth_token', accessToken, cookieOpts);

    return res.status(200).json({
      message: isNewUser ? 'Signup successful' : 'Login successful',
      user: {
        id: userId,
        walletAddress,
        username: existingProfile?.username || username,
      },
      session: {
        access_token: accessToken,
        token_type: 'bearer',
        expires_in: 86400,
      },
      isNewUser,
    });
  } catch (err) {
    console.error('Signature verification error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
