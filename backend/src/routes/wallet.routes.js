import express from 'express';
import { getNonce, verifySignature } from '../controllers/wallet.controller.js';
import { validate, schemas } from '../middleware/validate.js';

const router = express.Router();

// Get nonce for wallet signing
router.post('/nonce', async (req, res) => {
  const { walletAddress } = req.body;

  if (!walletAddress) {
    return res.status(400).json({ error: 'Wallet address required' });
  }

  await getNonce(req, res);
});

// Verify signed nonce and authenticate
router.post('/verify', async (req, res) => {
  const { walletAddress, signedMessage, username } = req.body;

  if (!walletAddress || !signedMessage) {
    return res.status(400).json({ error: 'Wallet address and signed message required' });
  }

  await verifySignature(req, res);
});

// Logout
router.post('/logout', (req, res) => {
  res.clearCookie('auth_token', { path: '/' });
  return res.status(200).json({ success: true });
});

export default router;
