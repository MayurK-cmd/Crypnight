import express from 'express';
import { verifyUser } from '../middleware/auth.middleware.js';
import { getTreasuryBalance } from '../services/payoutService.js';

const router = express.Router();

router.get('/treasury', verifyUser, async (req, res) => {
  try {
    const balance = await getTreasuryBalance();
    res.json({ treasuryBalanceSol: balance });
  } catch (err) {
    console.error('Treasury balance fetch failed:', err.message);
    res.status(500).json({ error: 'Failed to fetch treasury balance' });
  }
});

export default router;
