// PHASE 5 §C — central tier configuration.
//
// Single source of truth for tier names, rating bands, default ELOs, and
// reward bases. The frontend has its own copy in `Leaderboard.jsx` and
// `Setup.jsx` (we don't share JS code with the browser), but every
// backend file MUST import from here.

// Canonical short names. `pro` and `gm` are the values persisted in
// `users.tier`; the long forms (`professional`, `grandmaster`) are kept
// for back-compat with older clients and the leaderboard alias map.
export const TIER_NAMES = ['beginner', 'intermediate', 'pro', 'gm'];

// Long-form alias → short-form canonical.
export const TIER_ALIASES = {
  professional: 'pro',
  grandmaster: 'gm',
};

// Accepts short or long form. Returns the canonical short form.
export const normalizeTier = (t) => {
  if (!t) return null;
  const lower = String(t).toLowerCase();
  return TIER_ALIASES[lower] || lower;
};

export const isValidTier = (t) => {
  if (!t) return false;
  const lower = String(t).toLowerCase();
  return TIER_NAMES.includes(lower) || TIER_ALIASES[lower] !== undefined;
};

// Puzzle rating bands keyed by canonical short form. Used by the
// adaptive band picker as a fallback when the dynamic band returns zero
// matches.
export const TIER_RATING_BANDS = {
  beginner: [800, 1200],
  intermediate: [1200, 1600],
  pro: [1600, 1900],
  gm: [1900, 2500],
};

// Initial ELO applied when the user picks a tier. Keys are the
// *canonical* short forms — the controller normalizes the request first.
export const TIER_DEFAULT_RATINGS = {
  beginner: 1000,
  intermediate: 1400,
  pro: 1700,
  gm: 2100,
};

// Per-puzzle base reward in SOL, keyed by canonical short form.
export const TIER_BASE_REWARD = {
  beginner: 0.001,
  intermediate: 0.003,
  pro: 0.008,
  gm: 0.02,
};

// All long + short forms, useful for Joi's `.valid(...)` and for any UI
// that wants to enumerate every accepted spelling.
export const TIER_NAMES_ALL = [
  ...TIER_NAMES,
  ...Object.keys(TIER_ALIASES),
];
