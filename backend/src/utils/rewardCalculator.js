// PHASE 2 §2.1 — Reward formula
//
// All values are in SOL. The payout is computed server-side at submit time and
// never trusts the frontend. The frontend never sends solve time.
//
// tier difficulty rating       formula multiplier
// beginner   800–1200   0.001 SOL    1.0x at rating 1500
// intermediate 1200–1600 0.003 SOL
// pro        1600–1900  0.008 SOL
// gm         1900–2500  0.020 SOL
//
// Final reward is rounded to 6 decimal places (lamport-friendly on Solana).

import { TIER_BASE_REWARD, normalizeTier } from './tiers.js';

// Same 3% as Solo Mode spec
export const SOLO_PLATFORM_FEE = 0.03;

// Max session age (also enforced at the controller level so a hung frontend
// can never claim rewards after the cap).
export const MAX_SOLO_SESSION_MS = 10 * 60 * 1000;

/**
 * Calculate the reward for a solved puzzle.
 *
 *   base = TIER_BASE_REWARD[tier]
 *   difficultyMultiplier = puzzleRating / 1500       (1.0 at rating 1500)
 *   speedMultiplier      = clamp(60000 / solveTimeMs, 0.5, 3.0)
 *   accuracyMultiplier   = 1.0 - strikes * 0.25      (0=1.0, 1=0.75, 2=0.5)
 *   gross                = base * diff * speed * acc
 *   net                  = gross * (1 - SOLO_PLATFORM_FEE)
 *
 * @param {Object} args
 * @param {number} args.solveTimeMs
 * @param {number} args.puzzleRating
 * @param {string} args.tier
 * @param {number} args.wrongMoves
 * @returns {number} reward in SOL, rounded to 6 decimal places
 */
export const calculateReward = ({ solveTimeMs, puzzleRating, tier, wrongMoves }) => {
  const tierKey = normalizeTier(tier) || 'beginner';
  const base = TIER_BASE_REWARD[tierKey] ?? TIER_BASE_REWARD.beginner;

  const difficulty = Math.max(0.25, puzzleRating / 1500);

  const speed = Math.min(3.0, Math.max(0.5, 60000 / Math.max(solveTimeMs, 1000)));

  const accuracy = Math.max(0, 1 - (wrongMoves ?? 0) * 0.25);

  const gross = base * difficulty * speed * accuracy;
  const net = gross * (1 - SOLO_PLATFORM_FEE);

  // Round to 6 decimal places so the value can be safely sent to a Solana tx
  // without floating-point noise at the lamport scale.
  return Math.round(net * 1_000_000) / 1_000_000;
};

/**
 * PHASE 5 — per-puzzle ELO contribution.
 *
 * Each puzzle in a 10-puzzle session contributes a delta to the user's
 * rating. Failed puzzles (3 wrong moves) short-circuit to a small negative
 * contribution. Solved puzzles blend difficulty match, speed, and accuracy
 * into a 0..1 performance score and feed it through a K-factor formula.
 *
 *   difficultyFit = clamp(1 - |puzzleRating - userRating| / 600, 0, 1)
 *   speedFit      = clamp(1 - solveTimeMs / 90000, 0, 1)   (0 at 90s+)
 *   accuracyFit   = max(0, 1 - wrongMoves * 0.33)
 *   perf          = 0.4*difficultyFit + 0.4*speedFit + 0.2*accuracyFit
 *   delta         = round(32 * (perf - 0.5))               (range ±16)
 *
 * Failed puzzles return -5. Weights: difficulty and speed matter most
 * because they best distinguish a real rating change from a lucky solve.
 *
 * The session-level rating update happens in `endSoloSession` after
 * summing per-puzzle deltas; the floor of 100 is enforced there.
 */
export const puzzleEloDelta = ({
  userRating,
  puzzleRating,
  solveTimeMs,
  wrongMoves,
  failed,
}) => {
  if (failed) return -5;

  const clamp01 = (n) => Math.max(0, Math.min(1, n));

  const difficultyFit = clamp01(1 - Math.abs(puzzleRating - userRating) / 600);
  const speedFit = clamp01(1 - Math.max(solveTimeMs, 0) / 90000);
  const accuracyFit = Math.max(0, 1 - (wrongMoves ?? 0) * 0.33);

  const perf =
    0.4 * difficultyFit + 0.4 * speedFit + 0.2 * accuracyFit;

  return Math.round(32 * (perf - 0.5));
};
