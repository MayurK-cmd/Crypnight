import { v4 as uuidv4 } from 'uuid';
import { Chess } from 'chess.js';
import { supabase } from '../config/supabase.js';
import { getPuzzleById, getPuzzleByRating } from './puzzleLoader.js';

// In-memory duel state: sessionId -> { players, status, timer, disconnects, puzzle }
const activeMatches = new Map();
export const puzzleState = new Map(); // sessionId -> { fen, solution: [moves], playerASolutionIndex, playerBSolutionIndex }

// Queue by tier: tier -> [{ userId, joinedAt, banUntil }]
const matchQueues = {
  beginner: [],
  intermediate: [],
  pro: [],
  gm: [],
};

// Tier constants
const TIERS = {
  beginner: 'beginner',
  intermediate: 'intermediate',
  pro: 'pro',
  gm: 'gm',
};

const STAKE_BY_TIER = {
  beginner: 0.05,
  intermediate: 0.10,
  pro: 0.25,
  gm: 0.50,
};

const DUEL_DURATION_MS = 3 * 60 * 1000; // 3 minutes
const DEPOSIT_TIMEOUT_MS = 30 * 1000; // 30 seconds
const DISCONNECT_TIMEOUT_MS = 30 * 1000; // 30 seconds forfeit
const QUEUE_BAN_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export class DuelManager {
  static addToQueue(userId, tier) {
    // Check queue ban
    const queueEntry = matchQueues[tier]?.find(e => e.userId === userId);
    if (queueEntry?.banUntil && queueEntry.banUntil > Date.now()) {
      throw new Error('Player is queue banned');
    }

    // Add to tier queue
    const entry = {
      userId,
      joinedAt: Date.now(),
      banUntil: null,
    };

    matchQueues[tier].push(entry);

    // Check if we can make a match (need 2 players)
    if (matchQueues[tier].length >= 2) {
      return this.tryMatchmake(tier);
    }

    return null;
  }

  static removeFromQueue(userId, tier) {
    const idx = matchQueues[tier].findIndex(e => e.userId === userId);
    if (idx !== -1) {
      matchQueues[tier].splice(idx, 1);
    }
  }

  static tryMatchmake(tier) {
    if (matchQueues[tier].length < 2) return null;

    const playerA = matchQueues[tier].shift();
    const playerB = matchQueues[tier].shift();

    const stakeSol = STAKE_BY_TIER[tier];
    const potSol = stakeSol * 2;

    // Create duel session in DB
    activeMatches.set(playerA.userId, {
      playerAId: playerA.userId,
      playerBId: playerB.userId,
      tier,
      stakeSol,
      potSol,
      status: 'waiting_deposits',
      depositDeadline: Date.now() + DEPOSIT_TIMEOUT_MS,
      duelStartTime: null,
      duelEndTime: null,
      currentPuzzleIndexA: 0,
      currentPuzzleIndexB: 0,
      disconnectTimers: {},
      socketA: null,
      socketB: null,
    });

    return { playerAId: playerA.userId, playerBId: playerB.userId };
  }

  static getMatch(playerAId) {
    return activeMatches.get(playerAId);
  }

  static async confirmDeposit(sessionId, userId) {
    const { data: session } = await supabase
      .from('duel_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (!session) throw new Error('Session not found');

    let updateData = {};
    if (session.player_a_id === userId) {
      updateData.player_a_deposited = true;
    } else if (session.player_b_id === userId) {
      updateData.player_b_deposited = true;
    } else {
      throw new Error('Player not in this session');
    }

    // Mark this player as deposited
    await supabase
      .from('duel_sessions')
      .update(updateData)
      .eq('id', sessionId);

    // Refetch the session to see current state of both players
    const { data: updatedSession } = await supabase
      .from('duel_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    // Check if both players have now deposited
    const bothDeposited = updatedSession.player_a_deposited && updatedSession.player_b_deposited;

    if (bothDeposited) {
      // Both players confirmed — activate the match
      await supabase
        .from('duel_sessions')
        .update({ status: 'active', started_at: new Date().toISOString() })
        .eq('id', sessionId);
      return 'both_confirmed';
    } else {
      return 'waiting_for_other_player';
    }
  }

  static registerSocket(sessionId, userId, socket) {
    const { data: session } = supabase
      .from('duel_sessions')
      .select('player_a_id, player_b_id')
      .eq('id', sessionId)
      .single();

    // Store socket reference locally if needed for broadcasts
  }

  static handleDisconnect(sessionId, userId) {
    // Set a 30s forfeit timer
    setTimeout(() => {
      this.forfeitDuel(sessionId, userId, 'disconnect');
    }, DISCONNECT_TIMEOUT_MS);
  }

  static async submitMove(sessionId, userId, move) {
    const { data: session } = await supabase
      .from('duel_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (!session || session.status !== 'active') throw new Error('Duel not active');

    // Determine which player
    const isPlayerA = session.player_a_id === userId;

    // Use stored puzzle from duel session (same for both players)
    if (!session.current_puzzle_fen) throw new Error('Puzzle not loaded');

    const chess = new Chess(session.current_puzzle_fen);
    const validMoves = chess.moves({ verbose: true });

    // Parse move — can be SAN notation or from/to
    let moveObj;
    if (typeof move === 'string') {
      moveObj = validMoves.find(m => m.san === move);
    } else {
      moveObj = validMoves.find(m => m.from === move.from && m.to === move.to);
    }

    if (!moveObj) {
      // Invalid move — puzzle failed
      const updateData = isPlayerA
        ? { player_a_puzzles_failed: (session.player_a_puzzles_failed || 0) + 1 }
        : { player_b_puzzles_failed: (session.player_b_puzzles_failed || 0) + 1 };

      await supabase
        .from('duel_sessions')
        .update(updateData)
        .eq('id', sessionId);

      await supabase
        .from('duel_attempts')
        .insert({
          duel_session_id: sessionId,
          user_id: userId,
          puzzle_id: session.current_puzzle_id,
          solved: false,
          time_taken_ms: 0,
        });

      return { result: 'failed' };
    }

    // Correct move — both players validate against same puzzle so both should solve it
    const updateData = isPlayerA
      ? { player_a_puzzles_solved: (session.player_a_puzzles_solved || 0) + 1 }
      : { player_b_puzzles_solved: (session.player_b_puzzles_solved || 0) + 1 };

    await supabase
      .from('duel_sessions')
      .update(updateData)
      .eq('id', sessionId);

    await supabase
      .from('duel_attempts')
      .insert({
        duel_session_id: sessionId,
        user_id: userId,
        puzzle_id: session.current_puzzle_id,
        solved: true,
        time_taken_ms: 0,
      });

    return { result: 'continue' };
  }

  static async endDuel(sessionId) {
    const { data: session } = await supabase
      .from('duel_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (!session) return null;

    let winner = null;
    if (session.player_a_puzzles_solved > session.player_b_puzzles_solved) {
      winner = session.player_a_id;
    } else if (session.player_b_puzzles_solved > session.player_a_puzzles_solved) {
      winner = session.player_b_id;
    } else if (session.player_a_puzzles_failed < session.player_b_puzzles_failed) {
      winner = session.player_a_id;
    } else if (session.player_b_puzzles_failed < session.player_a_puzzles_failed) {
      winner = session.player_b_id;
    }
    // Else draw

    const status = winner ? 'settled' : 'draw';
    await supabase
      .from('duel_sessions')
      .update({
        status,
        winner_id: winner,
        ended_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    return { sessionId, winner };
  }

  static async forfeitDuel(sessionId, userId, reason) {
    const { data: session } = await supabase
      .from('duel_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (!session) return null;

    const winner = session.player_a_id === userId ? session.player_b_id : session.player_a_id;

    await supabase
      .from('duel_sessions')
      .update({
        status: 'forfeited',
        winner_id: winner,
        ended_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    return { sessionId, winner, forfeiter: userId, reason };
  }

  static applyQueueBan(userId, tier) {
    const queueEntry = matchQueues[tier].find(e => e.userId === userId);
    if (queueEntry) {
      queueEntry.banUntil = Date.now() + QUEUE_BAN_DURATION_MS;
    }
  }

  static getQueueStatus(tier) {
    return matchQueues[tier].length;
  }
}

