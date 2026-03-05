import { join } from "node:path";
import { homedir } from "node:os";
import type { ThermalConfig, SalienceWeights } from "./types.js";

const DEFAULT_WEIGHTS: SalienceWeights = {
  decisionChange: 0.25,
  humanOriginated: 0.20,
  hardWon: 0.15,
  recurrence: 0.15,
  realWorldImpact: 0.15,
  connectiveDensity: 0.10,
};

export const DEFAULT_CONFIG: ThermalConfig = {
  storePath: join(homedir(), ".thermal-memory", "memories.json"),
  floorRatio: 0.4,
  decayRate: 0.001,
  detailDecayMultiplier: 3,
  reheatBoost: 0.15,
  weights: DEFAULT_WEIGHTS,
};

/** Merge partial user config with defaults. */
export function resolveConfig(partial?: Partial<ThermalConfig>): ThermalConfig {
  if (!partial) return { ...DEFAULT_CONFIG };
  return {
    ...DEFAULT_CONFIG,
    ...partial,
    weights: {
      ...DEFAULT_CONFIG.weights,
      ...partial.weights,
    },
  };
}
