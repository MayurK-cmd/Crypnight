import { supabase } from '../config/supabase.js';
import { DuelManager } from '../services/duelManager.js';
import { settleDuel, refundDuel } from '../services/duelPayoutService.js';

export const getDuelSession = async (req, res) => {
  try {
    const { matchId } = req.params;

    const { data: session } = await supabase
      .from('duel_sessions')
      .select('*')
      .eq('match_id', matchId)
      .single();

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json(session);
  } catch (error) {
    console.error('Error fetching duel session:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getQueueStatus = async (req, res) => {
  try {
    const { tier } = req.params;

    const queueLength = DuelManager.getQueueStatus(tier);

    res.json({
      tier,
      queueLength,
      estimatedWaitSeconds: queueLength >= 2 ? 0 : 30,
    });
  } catch (error) {
    console.error('Error fetching queue status:', error);
    res.status(500).json({ error: error.message });
  }
};

export const settleDuelMatch = async (req, res) => {
  try {
    const { matchId, playerASolved, playerBSolved } = req.body;

    if (!matchId || playerASolved === undefined || playerBSolved === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { data: session } = await supabase
      .from('duel_sessions')
      .select('*')
      .eq('id', matchId)
      .single();

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status === 'settled' || session.status === 'refunded') {
      return res.status(400).json({ error: 'Match already settled' });
    }

    const isDraw = playerASolved === playerBSolved;

    if (isDraw) {
      // Draw: refund both players their stakes
      await refundDuel({
        matchId,
        playerAWallet: session.player_a_wallet,
        playerBWallet: session.player_b_wallet,
        session,
      });

      res.json({
        status: 'refunded',
        reason: 'draw',
        message: 'Match was a draw. Both players refunded their stakes.',
      });
    } else {
      // Winner determined by puzzle count
      const winnerId = playerASolved > playerBSolved ? session.player_a_id : session.player_b_id;
      const winnerWallet = playerASolved > playerBSolved ? session.player_a_wallet : session.player_b_wallet;

      await settleDuel({
        matchId,
        winnerWallet,
        session,
      });

      res.json({
        status: 'settled',
        winnerId,
        playerASolved,
        playerBSolved,
        message: `Player ${winnerId === session.player_a_id ? 'A' : 'B'} wins. Pot distributed.`,
      });
    }
  } catch (error) {
    console.error('Error settling duel:', error);
    res.status(500).json({ error: error.message });
  }
};
