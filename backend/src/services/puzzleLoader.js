import { supabase } from '../config/supabase.js';
import { parse } from 'csv-parse/sync';

let puzzleCache = null;
let isLoading = false;
let loadError = null;

/**
 * Check if puzzles are ready
 */
export function isPuzzlesReady() {
  return puzzleCache !== null;
}

/**
 * Load puzzles from Supabase Storage
 * Caches in memory after first load
 */
export async function loadPuzzles() {
  if (puzzleCache) {
    return puzzleCache;
  }

  if (isLoading) {
    // Wait for existing load to complete
    while (isLoading) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    // After loading finishes, check for errors or cache
    if (loadError) {
      throw loadError;
    }
    if (!puzzleCache) {
      throw new Error('Puzzle loading completed but cache is empty');
    }
    return puzzleCache;
  }

  try {
    isLoading = true;
    loadError = null;
    console.log('Loading puzzles from Supabase Storage...');

    // Download CSV from Supabase Storage
    const { data, error } = await supabase.storage
      .from('puzzles')
      .download('lichess_puzzles.csv');

    if (error) {
      throw new Error(`Failed to download puzzles: ${error.message}`);
    }

    const text = await data.text();

    // Parse CSV
    puzzleCache = parse(text, {
      columns: true,
      skip_empty_lines: true,
      cast: (value, context) => {
        // Convert rating to number
        if (context.column === 'rating' || context.column === 'Rating') {
          return parseInt(value, 10);
        }
        return value;
      }
    });

    console.log(`✅ Loaded ${puzzleCache.length} puzzles into memory`);
    return puzzleCache;

  } catch (err) {
    console.error('Error loading puzzles:', err);
    loadError = err;
    throw err;
  } finally {
    isLoading = false;
  }
}

/**
 * Get a random puzzle within rating range
 */
export function getPuzzleByRating(min, max) {
  if (!puzzleCache) {
    throw new Error('Puzzles not loaded. Call loadPuzzles() first.');
  }

  const filtered = puzzleCache.filter(puzzle => {
    const rating = puzzle.rating || puzzle.Rating;
    return rating >= min && rating <= max;
  });

  if (filtered.length === 0) {
    throw new Error(`No puzzles found in rating range ${min}-${max}`);
  }

  const randomIndex = Math.floor(Math.random() * filtered.length);
  return filtered[randomIndex];
}

/**
 * Get puzzle by ID
 */
export function getPuzzleById(puzzleId) {
  if (!puzzleCache) {
    throw new Error('Puzzles not loaded. Call loadPuzzles() first.');
  }

  return puzzleCache.find(p =>
    p.puzzle_id === puzzleId ||
    p.PuzzleId === puzzleId ||
    p.id === puzzleId
  );
}

/**
 * Clear cache (useful for testing or reloading)
 */
export function clearCache() {
  puzzleCache = null;
  console.log('Puzzle cache cleared');
}
