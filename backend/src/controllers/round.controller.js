import { supabase } from "../config/supabase.js";

// ===============================
// ELO CALCULATION
// ===============================
function calculateElo(userRating, puzzleRating, wrongMoves) {
  // If 3 wrong moves (failed), always -10
  if (wrongMoves >= 3) return -10;

  // Standard Elo expected score
  const expected = 1 / (1 + Math.pow(10, (puzzleRating - userRating) / 400));

  // Base gain: K=20, harder puzzle = bigger reward
  const baseGain = Math.round(20 * (1 - expected));

  // Multiplier based on wrong moves
  const multipliers = { 0: 1.0, 1: 0.7, 2: 0.4 };
  const multiplier = multipliers[wrongMoves] ?? 0.4;

  return Math.max(1, Math.round(baseGain * multiplier)); // minimum +1 if solved
}

// ===============================
// START ROUND SESSION
// ===============================
export const startRoundSession = async (req, res) => {
  try {
    const userId = req.user.id;

    // Check if user already has an active incomplete round
    const { data: existingRound } = await supabase
      .from("round_sessions")
      .select("*")
      .eq("user_id", userId)
      .eq("is_complete", false)
      .single();

    if (existingRound) {
      // Resume existing round
      return res.json({
        round_session_id: existingRound.id,
        puzzle_count: existingRound.puzzle_count,
        resumed: true,
      });
    }

    // Create new round session
    const { data, error } = await supabase
      .from("round_sessions")
      .insert({ user_id: userId })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({
      round_session_id: data.id,
      puzzle_count: 0,
      resumed: false,
    });
  } catch (err) {
    console.error("Start round error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ===============================
// COMPLETE A PUZZLE IN A ROUND
// Called after each puzzle solve/fail
// ===============================
export const completePuzzleInRound = async (req, res) => {
  try {
    const userId = req.user.id;
    const { round_session_id, puzzle_id, puzzle_rating, solved, wrong_moves, time_taken } = req.body;

    if (!round_session_id || !puzzle_id || puzzle_rating == null) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Verify round belongs to user and is not complete
    const { data: round, error: roundError } = await supabase
      .from("round_sessions")
      .select("*")
      .eq("id", round_session_id)
      .eq("user_id", userId)
      .eq("is_complete", false)
      .single();

    if (roundError || !round) {
      return res.status(400).json({ error: "Invalid or completed round session" });
    }

    // Get current user rating
    const { data: user } = await supabase
      .from("game_profiles")
      .select("rating")
      .eq("user_id", userId)
      .single();

    const userRating = user.rating || 1000;

    // Calculate elo change
    const eloChange = calculateElo(userRating, puzzle_rating, wrong_moves);
    const newRating = Math.max(100, userRating + eloChange); // floor at 100

    // Log puzzle result
    await supabase.from("round_puzzle_results").insert({
      round_session_id,
      user_id: userId,
      puzzle_id,
      puzzle_rating,
      solved: solved ?? false,
      wrong_moves: wrong_moves ?? 0,
      elo_change: eloChange,
      time_taken: time_taken ?? 0,
    });

    // Update user rating
    await supabase
      .from("game_profiles")
      .update({ rating: newRating })
      .eq("user_id", userId);

    // Increment puzzle count on round
    const newCount = round.puzzle_count + 1;
    const isComplete = newCount >= 10;

    await supabase
      .from("round_sessions")
      .update({
        puzzle_count: newCount,
        is_complete: isComplete,
        completed_at: isComplete ? new Date().toISOString() : null,
      })
      .eq("id", round_session_id);

    res.json({
      elo_change: eloChange,
      new_rating: newRating,
      puzzle_count: newCount,
      round_complete: isComplete,
    });
  } catch (err) {
    console.error("Complete puzzle in round error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ===============================
// GET ROUND SUMMARY
// Called when round_complete = true
// ===============================
export const getRoundSummary = async (req, res) => {
  try {
    const userId = req.user.id;
    const { round_session_id } = req.params;

    // Verify round belongs to user
    const { data: round } = await supabase
      .from("round_sessions")
      .select("*")
      .eq("id", round_session_id)
      .eq("user_id", userId)
      .single();

    if (!round) {
      return res.status(404).json({ error: "Round session not found" });
    }

    // Get all puzzle results for this round
    const { data: results } = await supabase
      .from("round_puzzle_results")
      .select("*")
      .eq("round_session_id", round_session_id)
      .order("created_at", { ascending: true });

    // Calculate summary stats
    const totalPuzzles = results.length;
    const solved = results.filter((r) => r.solved).length;
    const failed = totalPuzzles - solved;
    const accuracy = totalPuzzles > 0 ? Math.round((solved / totalPuzzles) * 100) : 0;
    const totalEloChange = results.reduce((sum, r) => sum + r.elo_change, 0);
    const avgTime = totalPuzzles > 0
      ? Math.round(results.reduce((sum, r) => sum + r.time_taken, 0) / totalPuzzles)
      : 0;

    // Get current rating
    const { data: user } = await supabase
      .from("game_profiles")
      .select("rating")
      .eq("user_id", userId)
      .single();

    res.json({
      summary: {
        total_puzzles: totalPuzzles,
        solved,
        failed,
        accuracy,
        total_elo_change: totalEloChange,
        avg_time_per_puzzle: avgTime,
        current_rating: user.rating,
        puzzles: results,
      },
    });
  } catch (err) {
    console.error("Get round summary error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};