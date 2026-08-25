import { supabase } from "../config/supabase.js";
import { verifySignature } from "../utils/verifySignature.js";
import { AuditAction, getClientIp, logAction } from "../utils/auditLog.js";
import { isValidTier, normalizeTier, TIER_DEFAULT_RATINGS } from "../utils/tiers.js";

export const linkWallet = async (req, res) => {
  try {
    const { walletAddress, signature, message } = req.body;
    const userId = req.user.id;

    if (!walletAddress || !signature || !message) {
      return res.status(400).json({
        error: "Missing walletAddress, signature, or message",
      });
    }

    const isValid = verifySignature(message, signature, walletAddress);

    // TEMP DIAGNOSTIC — strip after fix confirmed
    console.log('[link-wallet diag]', {
      pk: walletAddress,
      msg: message,
      msgBytesHex: Buffer.from(message, 'utf8').toString('hex'),
      msgLen: message.length,
      sigPreview: typeof signature === 'string' ? signature.slice(0, 40) + (signature.length > 40 ? '...' : '') : signature,
      sigLen: typeof signature === 'string' ? signature.length : null,
      isValid,
    });

    if (!isValid) {
      await logAction({
        userId,
        action: AuditAction.WALLET_LINK_FAILED,
        metadata: { walletAddress, reason: 'invalid_signature' },
        ipAddress: getClientIp(req),
      });
      return res.status(400).json({
        error: "Invalid wallet signature",
      });
    }

    // Make sure this wallet isn't already linked to someone else (cheap extra check).
    const { data: existingUser } = await supabase
      .from("game_profiles")
      .select("wallet_address, user_id")
      .eq("user_id", userId)
      .single();

    if (existingUser?.wallet_address) {
      await logAction({
        userId,
        action: AuditAction.WALLET_LINK_FAILED,
        metadata: { walletAddress, reason: 'already_linked' },
        ipAddress: getClientIp(req),
      });
      return res.status(403).json({
        error: "Wallet already linked",
      });
    }

    await supabase
      .from("game_profiles")
      .update({ wallet_address: walletAddress })
      .eq("user_id", userId);

    await logAction({
      userId,
      action: AuditAction.WALLET_LINKED,
      metadata: { walletAddress },
      ipAddress: getClientIp(req),
    });

    return res.json({ message: "Wallet linked successfully" });
  } catch (err) {
    console.error("Wallet link error:", err);
    return res.status(500).json({
      error: "Internal server error",
    });
  }
};

const allowedTiers = ['beginner', 'intermediate', 'professional', 'grandmaster'];

export const setTier = async (req, res) => {
  const { tier } = req.body;
  const userId = req.user.id;

  if (!isValidTier(tier)) {
    return res.status(400).json({ error: 'Invalid tier' });
  }

  // Normalize so users.tier always stores the canonical short form.
  const canonical = normalizeTier(tier);

  const { data: existingUser } = await supabase
    .from('game_profiles')
    .select('tier')
    .eq('user_id', userId)
    .single();

  if (existingUser?.tier) {
    return res.status(403).json({
      error: 'Tier already set. Cannot change.',
    });
  }

  await supabase
    .from('game_profiles')
    .update({
      tier: canonical,
      rating: TIER_DEFAULT_RATINGS[canonical],
      is_setup_complete: true,
    })
    .eq('user_id', userId);

  await logAction({
    userId,
    action: AuditAction.TIER_SELECTED,
    metadata: { tier: canonical },
    ipAddress: getClientIp(req),
  });

  return res.json({ message: 'Tier set successfully' });
};

export const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('game_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    if (!data) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    return res.status(200).json({ profile: data });
  } catch (err) {
    console.error('Get profile error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
