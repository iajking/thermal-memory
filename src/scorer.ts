import type { SalienceSignals, SalienceWeights, MemoryEntry } from "./types.js";
import { DEFAULT_CONFIG } from "./config.js";

/**
 * Score salience from explicit signals.
 * Returns temperature 0.0–1.0.
 */
export function scoreFromSignals(
  signals: Partial<SalienceSignals>,
  weights: SalienceWeights = DEFAULT_CONFIG.weights,
): number {
  const s: SalienceSignals = {
    decisionChange: 0,
    humanOriginated: 0,
    hardWon: 0,
    recurrence: 0,
    realWorldImpact: 0,
    connectiveDensity: 0,
    ...signals,
  };

  const raw =
    s.decisionChange * weights.decisionChange +
    s.humanOriginated * weights.humanOriginated +
    s.hardWon * weights.hardWon +
    s.recurrence * weights.recurrence +
    s.realWorldImpact * weights.realWorldImpact +
    s.connectiveDensity * weights.connectiveDensity;

  return Math.max(0, Math.min(1, raw));
}

/**
 * Rule-based auto-scorer.
 * Analyzes text content for salience heuristics.
 * Returns temperature 0.0–1.0.
 */
export function autoScore(
  core: string,
  detail: string,
  existingMemories: MemoryEntry[],
  weights: SalienceWeights = DEFAULT_CONFIG.weights,
): number {
  const text = `${core} ${detail}`.toLowerCase();

  // Decision change — keywords suggesting a redirect or pivot
  const decisionKeywords = [
    "instead", "changed", "pivot", "switch", "actually", "realized",
    "wrong approach", "different direction", "redirected", "decided against",
  ];
  const decisionChange = decisionKeywords.some((k) => text.includes(k)) ? 0.8 : 0.1;

  // Human-originated — references to user preferences, corrections
  const humanKeywords = [
    "user said", "user wants", "user prefers", "human", "told me",
    "corrected", "feedback", "preference", "asked for", "requested",
  ];
  const humanOriginated = humanKeywords.some((k) => text.includes(k)) ? 0.8 : 0.1;

  // Hard-won — mentions of struggle, debugging, multiple attempts
  const hardWonKeywords = [
    "debug", "finally", "after multiple", "took a while", "struggled",
    "failed", "retry", "attempt", "workaround", "broke", "fixed",
  ];
  const hardWon = hardWonKeywords.some((k) => text.includes(k)) ? 0.7 : 0.1;

  // Recurrence — check if similar tags/content exist in memory
  const coreWords = new Set(core.toLowerCase().split(/\s+/).filter((w) => w.length > 4));
  let overlapCount = 0;
  for (const mem of existingMemories) {
    const memWords = new Set(mem.core.toLowerCase().split(/\s+/).filter((w) => w.length > 4));
    const overlap = [...coreWords].filter((w) => memWords.has(w)).length;
    if (overlap >= 2) overlapCount++;
  }
  const recurrence = Math.min(1, overlapCount * 0.3);

  // Real-world impact — mentions of shipping, deploying, production
  const impactKeywords = [
    "shipped", "deployed", "production", "pushed", "live", "released",
    "published", "merged", "committed", "installed", "built",
  ];
  const realWorldImpact = impactKeywords.some((k) => text.includes(k)) ? 0.7 : 0.1;

  // Connective density — rough heuristic: more tags = more connected
  // (actual connection scoring happens post-record via connections field)
  const connectiveDensity = 0.2; // baseline, updated when connections are added

  return scoreFromSignals(
    { decisionChange, humanOriginated, hardWon, recurrence, realWorldImpact, connectiveDensity },
    weights,
  );
}
