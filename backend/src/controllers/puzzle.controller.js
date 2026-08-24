import { supabase } from "../config/supabase.js";
import { loadPuzzles, getPuzzleById, getPuzzleByRating } from "../services/puzzleLoader.js";
import { TIER_RATING_BANDS, normalizeTier } from "../utils/tiers.js";
import { MAX_SOLO_SESSION_MS } from "../utils/rewardCalculator.js";

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

// Half-width of the adaptive rating band in ELO points.
const ADAPTIVE_HALF_WIDTH = 200;

/**
 * PHASE 5 — adaptive rating band picker.
 *
 * Centers the next puzzle on the higher of the user's current rating or
 * the rating of their last solved puzzle, with a small downward bias
 * after a fail. Returns [min, max] in ELO points, clamped to [100, 2500].
 */
export const getRatingBand = (userRating, lastAttempt) => {
  const base = Math.max(userRating || 1000, lastAttempt?.rating ?? 0);
  const bias = lastAttempt?.failed ? -25 : 0;
  const center = clamp(base + bias, 100, 2500);
  return [center - ADAPTIVE_HALF_WIDTH, center + ADAPTIVE_HALF_WIDTH];
};

const isStale = (session) =>
  Date.now() - new Date(session.started_at).getTime() > MAX_SOLO_SESSION_MS;

/**
 * Pick the next puzzle. Tries the adaptive band first; falls back to the
 * tier band if the band returns zero matches.
 */
const pickNextPuzzle = (tier, userRating, lastAttempt) => {
  const tierKey = normalizeTier(tier) || 'intermediate';
  const [min, max] = lastAttempt?.rating
    ? getRatingBand(userRating, lastAttempt)
    : (TIER_RATING_BANDS[tierKey] || TIER_RATING_BANDS.intermediate);

  try {
    return getPuzzleByRating(min, max);
  } catch (err) {
    // Empty adaptive band — fall back to the tier band.
    const [fallbackMin, fallbackMax] = TIER_RATING_BANDS[tierKey] || TIER_RATING_BANDS.intermediate;
    return getPuzzleByRating(fallbackMin, fallbackMax);
  }
};

// GET /api/puzzle
//
// PHASE 5 changes:
//   1. Strips the SAN solution (`moves` / `Moves` / `solution`) so the
//      client never sees the answer in the network tab.
//   2. Resumes the user's active 10-puzzle session if one exists, or
//      sets a `current_puzzle_id` for a fresh session the frontend will
//      create via /solo/start. Returns the session_id either way so the
//      frontend can resume across page refreshes.
export const getPuzzleForUser = async (req, res) => {
  try {
    const userId = req.user.id;

    await loadPuzzles();

    const { data: user, error: userError } = await supabase
      .from("game_profiles")
      .select("tier, rating")
      .eq("user_id", userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: "User not found" });
    }
    if (!user.tier) {
      return res.status(400).json({ error: "User tier not set" });
    }

    // Look for an in-flight session (status='active', ended_at is null,
    // not stale, not yet at 10 puzzles).
    const { data: active } = await supabase
      .from("solo_sessions")
      .select(
        "id, current_puzzle_id, current_puzzle_solve_started_at, "
        + "puzzles_in_session, puzzles_solved, puzzles_failed, "
        + "total_session_reward, last_solved_rating, last_puzzle_elo_delta, "
        + "started_at"
      )
      .eq("user_id", userId)
      .eq("status", "active")
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let sessionRow = null;
    let sessionResumed = false;
    let puzzle = null;

    if (active && active.puzzles_in_session < 10 && !isStale(active)) {
      sessionRow = active;
      sessionResumed = true;
      console.log(`[/puzzle] Found active session: ${active.id}`);

      if (active.current_puzzle_id) {
        puzzle = getPuzzleById(active.current_puzzle_id);
      }
    }

    // If no active session, create one
    if (!sessionRow) {
      console.log(`[/puzzle] No active session found, creating new one`);
      const { data: newSession, error: createError } = await supabase
        .from('solo_sessions')
        .insert({
          user_id: userId,
          tier: user.tier,
          status: 'active',
          puzzles_in_session: 0,
          puzzles_solved: 0,
          puzzles_failed: 0,
          total_session_reward: 0,
          last_puzzle_elo_delta: 0,
          current_puzzle_id: null,
          current_puzzle_solve_started_at: null,
          current_puzzle_wrong_moves: 0,
          progress_index: 0,
          wrong_moves: 0,
          player_color: null,
        })
        .select()
        .single();

      if (createError) {
        console.error(`[/puzzle] Failed to create session: ${createError.message}`);
        return res.status(500).json({ error: 'Failed to create session' });
      }

      sessionRow = newSession;
      console.log(`[/puzzle] Created new session: ${newSession.id}`);
    }

    if (!puzzle) {
      // Either no active session, or the active one had no puzzle set
      // (3-strike path cleared it). Pick a fresh one against the
      // adaptive band.
      const lastAttempt = active && active.last_solved_rating
        ? { rating: active.last_solved_rating, failed: false }
        : null;
      puzzle = pickNextPuzzle(user.tier, user.rating, lastAttempt);
    }

    if (!puzzle) {
      return res.status(404).json({ error: "No puzzle available in band" });
    }

    // PHASE 5 fix — persist the picked puzzle back into the session row
    // so /solo/move can resolve current_puzzle_id on the next request.
    // Without this, after the 3-strike path nulls current_puzzle_id,
    // /puzzle serves a new puzzle but the row stays empty and the very
    // next /move returns 404 "Puzzle missing from cache".
    //
    // STRICT MODE — also bump puzzles_in_session to at least 1 here for
    // sessions that were created with the migration default of 0 (e.g.
    // an existing row from before Phase 5).
    //
    // Also extract and store player_color from the puzzle FEN so server-side
    // move validation knows which color the player controls.
    const pickedPuzzleId =
      puzzle.puzzle_id || puzzle.PuzzleId || puzzle.id;
    const pickedFen = puzzle.fen || puzzle.FEN;
    const pickedPlayerColorChar = pickedFen.split(' ')[1];

    console.log(`[/puzzle] Picked puzzle: ${pickedPuzzleId}, sessionRow exists: ${!!sessionRow}`);

    if (sessionRow && sessionRow.current_puzzle_id !== pickedPuzzleId) {
      const inSession = sessionRow.puzzles_in_session || 0;
      const moveCount = (puzzle.moves || puzzle.Moves || '').split(' ').filter(m => m).length;
      const isEvenMoveCount = moveCount % 2 === 0;
      const initialProgressIndex = isEvenMoveCount ? 1 : 0;

      const fenTurnChar = pickedFen.split(' ')[1];
      const pickedPlayerColorChar = isEvenMoveCount ? (fenTurnChar === 'w' ? 'b' : 'w') : fenTurnChar;

      console.log(`[/puzzle] Updating session ${sessionRow.id} with puzzle ${pickedPuzzleId}`);

      const { error: updateError } = await supabase
        .from("solo_sessions")
        .update({
          current_puzzle_id: pickedPuzzleId,
          current_puzzle_solve_started_at: new Date().toISOString(),
          current_puzzle_wrong_moves: 0,
          progress_index: initialProgressIndex,
          player_color: pickedPlayerColorChar,
        })
        .eq("id", sessionRow.id);

      if (updateError) {
        console.error(`[/puzzle] Update error: ${updateError.message}`);
      } else {
        console.log(`[/puzzle] Session updated successfully`);
      }

      sessionRow.current_puzzle_id = pickedPuzzleId;
      if (inSession < 1) sessionRow.puzzles_in_session = 1;
    } else if (!sessionRow) {
      console.log(`[/puzzle] No sessionRow found - cannot persist puzzle ID`);
    }

    // CRITICAL — strip the SAN solution. Destructure out so it cannot
    // accidentally end up in the JSON response.
    const {
      moves: _m,
      Moves: _M,
      solution: _s,
      Solution: _S,
      ...safePuzzle
    } = puzzle;

    // Get correct moves and determine if we need to auto-play the first move
    const correctMoves = (puzzle.moves || puzzle.Moves || '').split(' ').filter(m => m);
    const moveCount = correctMoves.length;
    const isEvenMoveCount = moveCount % 2 === 0;
    let autoPlayedMove = null;

    // For even-move puzzles, auto-play the first move (opponent's opening move)
    // so the player sees the board after the opponent's move, ready to play move index 1
    if (isEvenMoveCount && moveCount > 0) {
      const { Chess } = await import('chess.js');
      const game = new Chess(puzzle.fen || puzzle.FEN);
      autoPlayedMove = correctMoves[0];
      game.move(autoPlayedMove, { sloppy: true });
      safePuzzle.fen = game.fen();
      safePuzzle.FEN = game.fen();
    }

    // DEBUG: Log correct moves to console for testing
    console.log(`\n🎯 PUZZLE LOADED - ID: ${pickedPuzzleId}`);
    console.log(`   Rating: ${puzzle.rating || puzzle.Rating}`);
    console.log(`   Correct moves (in order): ${correctMoves.join(' → ')}`);
    console.log(`   Move count: ${moveCount} (${isEvenMoveCount ? 'even' : 'odd'})`);
    if (autoPlayedMove) console.log(`   Auto-played move: ${autoPlayedMove}`);
    console.log(`   Next move to make: ${isEvenMoveCount ? correctMoves[1] : correctMoves[0]}\n`);

    return res.json({
      puzzle: safePuzzle,
      session_id: sessionRow?.id ?? null,
      session_resumed: sessionResumed,
      puzzles_in_session: sessionRow?.puzzles_in_session ?? 0,
      puzzles_solved: sessionRow?.puzzles_solved ?? 0,
      puzzles_failed: sessionRow?.puzzles_failed ?? 0,
      auto_played_move: autoPlayedMove,
    });
  } catch (err) {
    console.error("Puzzle fetch error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
};
