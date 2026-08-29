import { WebSocketServer } from 'ws';
import { DuelManager, puzzleState } from './duelManager.js';
import { supabase } from '../config/supabase.js';
import { settleDuel, refundDuel } from './duelPayoutService.js';
import { getPuzzleByRating } from './puzzleLoader.js';
import {
  invokeCreateDuelEscrow,
  invokeJoinDuelEscrow,
} from './sorobanService.js';

// Store active WebSocket connections by user ID for broadcasting
const userSockets = new Map();

// Tier to rating band mapping
const TIER_RATING_BANDS = {
  beginner: [100, 1200],
  intermediate: [1000, 1800],
  pro: [1500, 2200],
  gm: [2000, 2800],
};

const messageHandlers = {
  'queue:join': handleQueueJoin,
  'queue:leave': handleQueueLeave,
  'deposit:confirm': handleDepositConfirm,
  'duel:start': handleStartDuel,
  'move:submit': handleMoveSubmit,
  'reconnect': handleReconnect,
};

async function handleQueueJoin(ws, data) {
  const { tier } = data;
  const userId = ws.userId; // Use authenticated user ID from JWT

  try {
    const match = DuelManager.addToQueue(userId, tier);

    if (match) {
      // Match found
      ws.playerAId = match.playerAId;
      ws.playerBId = match.playerBId;

      // Create duel session in DB
      const STAKE_BY_TIER = {
        beginner: 0.05,
        intermediate: 0.10,
        pro: 0.25,
        gm: 0.50,
      };
      const stakeSol = STAKE_BY_TIER[tier] || 0.05;

      const { data: sessionData, error: insertError } = await supabase
        .from('duel_sessions')
        .insert({
          tier,
          stake_sol: stakeSol,
          pot_sol: stakeSol * 2,
          status: 'waiting_deposits',
          player_a_id: match.playerAId,
          player_b_id: match.playerBId,
          player_a_wallet: data.playerAWallet || '',
          player_b_wallet: data.playerBWallet || '',
        })
        .select()
        .single();

      if (insertError) {
        console.error('[duelSocket] Insert error:', insertError);
        throw new Error(`Failed to create duel session: ${insertError.message}`);
      }

      if (!sessionData) {
        console.error('[duelSocket] No session data returned after insert');
        throw new Error('Failed to create duel session: no data returned');
      }

      ws.sessionId = sessionData.id;

      // Mirror the new match on-chain in the Soroban duel contract.
      // create_duel_escrow has no require_auth — just records initial state.
      // Fire-and-await so the contract ledger is up-to-date before either
      // player deposits; failure is logged but does not block the match
      // from being announced to the players.
      try {
        await invokeCreateDuelEscrow({
          matchId: sessionData.id,
          playerA: data.playerAWallet,
          playerB: data.playerBWallet,
          tier,
        });
      } catch (err) {
        console.error(
          `[duelSocket] Soroban create_duel_escrow failed for match ${sessionData.id}:`,
          err.message
        );
      }

      // Fetch opponent details
      const otherPlayerId = userId === match.playerAId ? match.playerBId : match.playerAId;
      const { data: opponentData } = await supabase
        .from('users')
        .select('id, username, rating')
        .eq('id', otherPlayerId)
        .single();

      const playerRole = userId === match.playerAId ? 'player_a' : 'player_b';

      // Notify both players that match was found
      const matchMessage = {
        type: 'match:found',
        matchId: sessionData.id,
        tier,
        stakeSol: sessionData.stake_sol,
        opponent: opponentData || { username: 'Opponent', rating: 1500 },
        opponentWallet:
          userId === match.playerAId ? data.playerBWallet : data.playerAWallet,
        yourWallet: data.yourWallet || '',
        role: playerRole,
      };

      // Send to current player
      ws.send(JSON.stringify(matchMessage));

      // Send to other player
      const otherPlayerWs = userSockets.get(otherPlayerId);
      if (otherPlayerWs && otherPlayerWs.readyState === WebSocket.OPEN) {
        otherPlayerWs.sessionId = sessionData.id;
        otherPlayerWs.playerAId = match.playerAId;
        otherPlayerWs.playerBId = match.playerBId;

        const otherPlayerRole = otherPlayerId === match.playerAId ? 'player_a' : 'player_b';
        const { data: currentPlayerData } = await supabase
          .from('users')
          .select('id, username, rating')
          .eq('id', userId)
          .single();

        const otherMatchMessage = {
          type: 'match:found',
          matchId: sessionData.id,
          tier,
          stakeSol: sessionData.stake_sol,
          opponent: currentPlayerData || { username: 'Opponent', rating: 1500 },
          opponentWallet:
            otherPlayerId === match.playerAId ? data.playerBWallet : data.playerAWallet,
          yourWallet: data.yourWallet || '',
          role: otherPlayerRole,
        };
        otherPlayerWs.send(JSON.stringify(otherMatchMessage));
      }
    } else {
      ws.send(JSON.stringify({
        type: 'queue:waiting',
        tier,
        queuePosition: DuelManager.getQueueStatus(tier),
      }));
    }
  } catch (error) {
    ws.send(JSON.stringify({ type: 'error', message: error.message }));
  }
}

async function handleQueueLeave(ws, data) {
  const { tier } = data;
  DuelManager.removeFromQueue(ws.userId, tier);
  ws.send(JSON.stringify({ type: 'queue:left' }));
}

async function handleDepositConfirm(ws, data) {
  const { matchId, txSignature } = data;

  try {
    const { data: session } = await supabase
      .from('duel_sessions')
      .select('*')
      .eq('id', matchId)
      .single();

    if (!session) throw new Error('Session not found');

    const otherPlayerId = session.player_a_id === ws.userId ? session.player_b_id : session.player_a_id;
    const playerColumn = session.player_a_id === ws.userId ? 'player_a_deposited' : 'player_b_deposited';

    // Mark this player as deposited
    await supabase
      .from('duel_sessions')
      .update({ [playerColumn]: true })
      .eq('id', matchId);

    // Check if both players have deposited
    const { data: updatedSession } = await supabase
      .from('duel_sessions')
      .select('player_a_deposited, player_b_deposited, player_b_wallet')
      .eq('id', matchId)
      .single();

    // Mirror the join on-chain. join_duel_escrow has no require_auth — it
    // just flips status to ACTIVE in the contract ledger. Triggered on the
    // SECOND deposit of the session (i.e. whenever this handler detects
    // both deposited are now true), which is the moment pB has joined.
    if (updatedSession.player_a_deposited && updatedSession.player_b_deposited) {
      try {
        await invokeJoinDuelEscrow({
          matchId,
          playerB: updatedSession.player_b_wallet,
        });
      } catch (err) {
        console.error(
          `[duelSocket] Soroban join_duel_escrow failed for match ${matchId}:`,
          err.message
        );
      }

      // Both deposited — notify both players they can start the game
      const readyMessage = JSON.stringify({
        type: 'both:deposited',
        matchId,
        message: 'Both players have confirmed. Click "Start Duel" to begin.',
      });

      ws.send(readyMessage);

      const otherPlayerWs = userSockets.get(otherPlayerId);
      if (otherPlayerWs && otherPlayerWs.readyState === WebSocket.OPEN) {
        otherPlayerWs.send(readyMessage);
      }
    } else {
      // Still waiting for other player
      ws.send(JSON.stringify({
        type: 'deposit:confirmed',
        matchId,
        message: 'Your deposit confirmed. Waiting for opponent...',
      }));

      const otherPlayerWs = userSockets.get(otherPlayerId);
      if (otherPlayerWs && otherPlayerWs.readyState === WebSocket.OPEN) {
        otherPlayerWs.send(JSON.stringify({
          type: 'opponent:deposited',
          matchId,
          message: 'Opponent has confirmed their deposit.',
        }));
      }
    }
  } catch (error) {
    console.error('[duelSocket] Deposit confirm error:', error);
    ws.send(JSON.stringify({ type: 'error', message: error.message }));
  }
}

async function handleStartDuel(ws, data) {
  const { matchId } = data;

  try {
    console.log('[handleStartDuel] Starting duel for matchId:', matchId);

    const { data: session } = await supabase
      .from('duel_sessions')
      .select('*')
      .eq('id', matchId)
      .single();

    console.log('[handleStartDuel] Session found:', session?.id, 'status:', session?.status);

    if (!session) throw new Error('Session not found');
    if (!session.player_a_deposited || !session.player_b_deposited) throw new Error('Both players must deposit first');

    // Load puzzle
    console.log('[handleStartDuel] Loading puzzle for tier:', session.tier);
    const [minRating, maxRating] = TIER_RATING_BANDS[session.tier];
    console.log('[handleStartDuel] Rating range:', minRating, '-', maxRating);

    const puzzle = await getPuzzleByRating(minRating, maxRating);

    if (!puzzle) throw new Error('Failed to load puzzle');
    console.log('[handleStartDuel] Puzzle loaded:', puzzle.puzzle_id || puzzle.PuzzleId);

    // Extract solution moves
    const solutionMoves = puzzle.Moves ? puzzle.Moves.split(' ') : [];
    console.log('[handleStartDuel] Solution has', solutionMoves.length, 'moves');

    // Determine if even/odd move count and calculate initial state
    const moveCount = solutionMoves.length;
    const isEvenMoveCount = moveCount % 2 === 0;
    let puzzleFen = puzzle.fen || puzzle.FEN;
    let autoPlayedMove = null;
    let initialProgressIndex = 0;

    // For even-move puzzles, auto-play the first move
    if (isEvenMoveCount && moveCount > 0) {
      const { Chess } = await import('chess.js');
      const game = new Chess(puzzleFen);
      autoPlayedMove = solutionMoves[0];
      game.move(autoPlayedMove, { sloppy: true });
      puzzleFen = game.fen();
      initialProgressIndex = 1;
    }

    // Calculate player color: if even moves, player gets opposite color of FEN
    const fenTurnChar = puzzleFen.split(' ')[1];
    const playerColorChar = isEvenMoveCount ? (fenTurnChar === 'w' ? 'b' : 'w') : fenTurnChar;

    console.log('[handleStartDuel] Even moves:', isEvenMoveCount, 'Auto-played:', autoPlayedMove, 'Player color:', playerColorChar);

    // Store puzzle state in memory with per-player tracking
    puzzleState.set(matchId, {
      playerAPuzzle: {
        fen: puzzleFen,
        solution: solutionMoves,
        solutionIndex: initialProgressIndex,
      },
      playerBPuzzle: {
        fen: puzzleFen,
        solution: solutionMoves,
        solutionIndex: initialProgressIndex,
      },
      playerALives: 3,
      playerBLives: 3,
    });

    // Store puzzle and update status in session
    console.log('[handleStartDuel] Updating session status to active');
    const { error: updateError } = await supabase
      .from('duel_sessions')
      .update({
        status: 'active',
        current_puzzle_id: puzzle.puzzle_id || puzzle.PuzzleId,
        current_puzzle_fen: puzzleFen,
        started_at: new Date().toISOString(),
      })
      .eq('id', matchId);

    if (updateError) {
      console.error('[handleStartDuel] Update error:', updateError);
      throw new Error('Failed to update session: ' + updateError.message);
    }

    console.log('[handleStartDuel] Session updated successfully, sending puzzle to players');

    // Send puzzle to both players
    const startPayload = JSON.stringify({
      type: 'duel:start',
      matchId,
      puzzle: {
        puzzle_id: puzzle.puzzle_id || puzzle.PuzzleId,
        fen: puzzleFen,
        rating: puzzle.rating || puzzle.Rating,
      },
      autoPlayedMove,
      durationMs: 180000,
      startedAt: Date.now(),
    });

    ws.send(startPayload);

    const otherPlayerId = session.player_a_id === ws.userId ? session.player_b_id : session.player_a_id;
    const otherPlayerWs = userSockets.get(otherPlayerId);
    if (otherPlayerWs && otherPlayerWs.readyState === WebSocket.OPEN) {
      otherPlayerWs.send(startPayload);
    }
    console.log('[handleStartDuel] Duel started successfully');
  } catch (error) {
    console.error('[handleStartDuel] Error:', error.message);
    ws.send(JSON.stringify({ type: 'error', message: error.message }));
  }
}

async function handleMoveSubmit(ws, data) {
  const { matchId, move } = data;

  try {
    const { data: session } = await supabase
      .from('duel_sessions')
      .select('*')
      .eq('id', matchId)
      .single();

    if (!session || session.status !== 'active') throw new Error('Duel not active');

    const puzState = puzzleState.get(matchId);
    if (!puzState) throw new Error('Puzzle state not found');

    const isPlayerA = session.player_a_id === ws.userId;
    const playerPuzzle = isPlayerA ? puzState.playerAPuzzle : puzState.playerBPuzzle;
    const expectedMove = playerPuzzle.solution[playerPuzzle.solutionIndex];

    // Wrong move
    if (!expectedMove || move !== expectedMove) {
      const playerColumn = isPlayerA ? 'player_a_puzzles_failed' : 'player_b_puzzles_failed';
      const failedCount = session[playerColumn] || 0;
      const newFailedCount = failedCount + 1;

      // Decrement lives
      if (isPlayerA) {
        puzState.playerALives -= 1;
      } else {
        puzState.playerBLives -= 1;
      }

      const livesRemaining = isPlayerA ? puzState.playerALives : puzState.playerBLives;

      await supabase
        .from('duel_sessions')
        .update({ [playerColumn]: newFailedCount })
        .eq('id', matchId);

      ws.send(JSON.stringify({
        type: 'puzzle:failed',
        matchId,
        livesRemaining,
      }));

      const otherPlayerId = isPlayerA ? session.player_b_id : session.player_a_id;
      const otherPlayerWs = userSockets.get(otherPlayerId);
      if (otherPlayerWs && otherPlayerWs.readyState === WebSocket.OPEN) {
        otherPlayerWs.send(JSON.stringify({
          type: 'opponent:failed_puzzle',
          matchId,
          opponentLivesRemaining: livesRemaining,
        }));
      }

      // If lives exhausted, end match for this player
      if (livesRemaining <= 0) {
        ws.send(JSON.stringify({
          type: 'duel:out_of_lives',
          matchId,
        }));

        const otherPlayerId = isPlayerA ? session.player_b_id : session.player_a_id;
        const otherPlayerWs = userSockets.get(otherPlayerId);
        if (otherPlayerWs && otherPlayerWs.readyState === WebSocket.OPEN) {
          otherPlayerWs.send(JSON.stringify({
            type: 'opponent:out_of_lives',
            matchId,
          }));
        }
        return;
      }

      // Load next puzzle for this player only
      const [minRating, maxRating] = TIER_RATING_BANDS[session.tier];
      const nextPuzzle = await getPuzzleByRating(minRating, maxRating);

      if (nextPuzzle) {
        const nextSolution = nextPuzzle.Moves ? nextPuzzle.Moves.split(' ') : [];
        const moveCount = nextSolution.length;
        const isEvenMoveCount = moveCount % 2 === 0;
        let nextFen = nextPuzzle.fen || nextPuzzle.FEN;
        let autoPlayedMove = null;
        let initialProgressIndex = 0;

        // For even-move puzzles, auto-play the first move
        if (isEvenMoveCount && moveCount > 0) {
          const { Chess } = await import('chess.js');
          const game = new Chess(nextFen);
          autoPlayedMove = nextSolution[0];
          game.move(autoPlayedMove, { sloppy: true });
          nextFen = game.fen();
          initialProgressIndex = 1;
        }

        if (isPlayerA) {
          puzState.playerAPuzzle = {
            fen: nextFen,
            solution: nextSolution,
            solutionIndex: initialProgressIndex,
          };
        } else {
          puzState.playerBPuzzle = {
            fen: nextFen,
            solution: nextSolution,
            solutionIndex: initialProgressIndex,
          };
        }

        ws.send(JSON.stringify({
          type: 'duel:new_puzzle',
          matchId,
          puzzle: {
            puzzle_id: nextPuzzle.puzzle_id || nextPuzzle.PuzzleId,
            fen: nextFen,
            rating: nextPuzzle.rating || nextPuzzle.Rating,
          },
          autoPlayedMove,
        }));
      }
      return;
    }

    // Correct move
    const nextIndex = playerPuzzle.solutionIndex + 1;
    const puzzleSolved = nextIndex >= playerPuzzle.solution.length;

    if (puzzleSolved) {
      // Puzzle solved
      const playerColumn = isPlayerA ? 'player_a_puzzles_solved' : 'player_b_puzzles_solved';
      const solvedCount = session[playerColumn] || 0;

      await supabase
        .from('duel_sessions')
        .update({ [playerColumn]: solvedCount + 1 })
        .eq('id', matchId);

      ws.send(JSON.stringify({
        type: 'puzzle:solved',
        matchId,
      }));

      const otherPlayerId = isPlayerA ? session.player_b_id : session.player_a_id;
      const otherPlayerWs = userSockets.get(otherPlayerId);
      if (otherPlayerWs && otherPlayerWs.readyState === WebSocket.OPEN) {
        otherPlayerWs.send(JSON.stringify({
          type: 'opponent:solved_puzzle',
          matchId,
        }));
      }

      // Load next puzzle for this player
      const [minRating, maxRating] = TIER_RATING_BANDS[session.tier];
      const nextPuzzle = await getPuzzleByRating(minRating, maxRating);

      if (nextPuzzle) {
        const nextSolution = nextPuzzle.Moves ? nextPuzzle.Moves.split(' ') : [];
        const moveCount = nextSolution.length;
        const isEvenMoveCount = moveCount % 2 === 0;
        let nextFen = nextPuzzle.fen || nextPuzzle.FEN;
        let autoPlayedMove = null;
        let initialProgressIndex = 0;

        // For even-move puzzles, auto-play the first move
        if (isEvenMoveCount && moveCount > 0) {
          const { Chess } = await import('chess.js');
          const game = new Chess(nextFen);
          autoPlayedMove = nextSolution[0];
          game.move(autoPlayedMove, { sloppy: true });
          nextFen = game.fen();
          initialProgressIndex = 1;
        }

        if (isPlayerA) {
          puzState.playerAPuzzle = {
            fen: nextFen,
            solution: nextSolution,
            solutionIndex: initialProgressIndex,
          };
        } else {
          puzState.playerBPuzzle = {
            fen: nextFen,
            solution: nextSolution,
            solutionIndex: initialProgressIndex,
          };
        }

        ws.send(JSON.stringify({
          type: 'duel:new_puzzle',
          matchId,
          puzzle: {
            puzzle_id: nextPuzzle.puzzle_id || nextPuzzle.PuzzleId,
            fen: nextFen,
            rating: nextPuzzle.rating || nextPuzzle.Rating,
          },
          autoPlayedMove,
        }));
      }
    } else {
      // Valid move, puzzle continues
      playerPuzzle.solutionIndex = nextIndex;
      const nextMove = playerPuzzle.solution[nextIndex];

      ws.send(JSON.stringify({
        type: 'move:valid',
        matchId,
        opponentMove: nextMove,
      }));

      const otherPlayerId = isPlayerA ? session.player_b_id : session.player_a_id;
      const otherPlayerWs = userSockets.get(otherPlayerId);
      if (otherPlayerWs && otherPlayerWs.readyState === WebSocket.OPEN) {
        otherPlayerWs.send(JSON.stringify({
          type: 'opponent:moved',
          matchId,
          move,
          opponentMove: nextMove,
        }));
      }
    }
  } catch (error) {
    console.error('[duelSocket] Move submit error:', error);
    ws.send(JSON.stringify({ type: 'error', message: error.message }));
  }
}

async function handleReconnect(ws, data) {
  const { sessionId } = data;

  const { data: session } = await supabase
    .from('duel_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (!session) {
    ws.send(JSON.stringify({ type: 'error', message: 'Session not found' }));
    return;
  }

  ws.sessionId = sessionId;
  ws.userId = ws.userId;

  ws.send(JSON.stringify({
    type: 'reconnect:success',
    sessionId,
  }));
}

export function setupDuelWebSocket(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', async (request, socket, head) => {
    if (request.url === '/ws/duel') {
      // Extract JWT from cookies or headers
      const cookies = request.headers.cookie || '';
      const authToken = cookies
        .split(';')
        .find(c => c.trim().startsWith('auth_token='))
        ?.split('=')[1];

      if (!authToken) {
        socket.destroy();
        return;
      }

      // Verify token and get user ID
      try {
        const { data } = await supabase.auth.getUser(authToken);
        if (!data?.user?.id) {
          socket.destroy();
          return;
        }
        request.userId = data.user.id;
      } catch (err) {
        console.error('[duelSocket] Auth error:', err.message);
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', (ws, request) => {
    const userId = request.userId;
    console.log('Client connected to duel WebSocket:', userId);

    // Attach userId to WebSocket connection
    ws.userId = userId;

    // Store this user's WebSocket connection
    userSockets.set(userId, ws);

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message);
        const handler = messageHandlers[data.type];

        if (handler) {
          await handler(ws, data);
        } else {
          ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
        ws.send(JSON.stringify({ type: 'error', message: error.message }));
      }
    });

    ws.on('close', () => {
      userSockets.delete(userId);
      if (ws.sessionId && ws.userId) {
        DuelManager.handleDisconnect(ws.sessionId, ws.userId);
      }
      console.log('Client disconnected from duel WebSocket:', userId);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  return wss;
}

