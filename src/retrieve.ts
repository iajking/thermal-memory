import type { MemoryEntry, RecallOptions } from "./types.js";

/**
 * Retrieve memories ranked by temperature, optionally filtered by tags and context.
 *
 * Matching works through partial cue activation:
 * - Hot memories have lower activation thresholds (easier to match)
 * - Tag overlap and keyword matching contribute to relevance score
 * - Final rank = relevance × currentTemp (heat-weighted)
 */
export function recall(entries: MemoryEntry[], options: RecallOptions = {}): MemoryEntry[] {
  const { context, tags, limit = 10, minTemp = 0.1 } = options;

  // Filter by minimum temperature
  let candidates = entries.filter((e) => e.currentTemp >= minTemp);

  // Score each candidate
  const scored = candidates.map((entry) => {
    let relevance = 1.0; // base relevance (all memories start equal)

    // Tag matching
    if (tags && tags.length > 0) {
      const entryTagSet = new Set(entry.tags.map((t) => t.toLowerCase()));
      const matchCount = tags.filter((t) => entryTagSet.has(t.toLowerCase())).length;
      if (matchCount === 0) {
        // No tag match — lower relevance but don't exclude
        // (hot memories can still surface through context match)
        relevance *= 0.3;
      } else {
        relevance *= 0.5 + 0.5 * (matchCount / tags.length);
      }
    }

    // Context keyword matching
    if (context) {
      const contextWords = new Set(
        context.toLowerCase().split(/\s+/).filter((w) => w.length > 3),
      );
      const entryText = `${entry.core} ${entry.detail}`.toLowerCase();
      const entryWords = new Set(
        entryText.split(/\s+/).filter((w) => w.length > 3),
      );

      const overlap = [...contextWords].filter((w) => entryWords.has(w)).length;
      if (contextWords.size > 0) {
        const overlapRatio = overlap / contextWords.size;
        relevance *= 0.3 + 0.7 * overlapRatio;
      }
    }

    // Activation threshold — hot memories activate on weaker cues
    const activationThreshold = 1.0 - entry.currentTemp;
    const activated = relevance >= activationThreshold;

    // Final score: relevance × temperature (heat-weighted retrieval)
    const score = activated ? relevance * entry.currentTemp : 0;

    return { entry, score };
  });

  // Sort by score descending, filter out zero-scored
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.entry);
}

/**
 * Get the hottest N memories regardless of context.
 * Useful for "what do I know that matters most?"
 */
export function hottest(entries: MemoryEntry[], n: number = 10): MemoryEntry[] {
  return [...entries]
    .sort((a, b) => b.currentTemp - a.currentTemp)
    .slice(0, n);
}
