export { ThermalMemory } from "./thermal.js";
export { scoreFromSignals, autoScore } from "./scorer.js";
export { applyDecay, decayAll, reinforce } from "./decay.js";
export { recall, hottest } from "./retrieve.js";
export { resolveConfig, DEFAULT_CONFIG } from "./config.js";
export { loadStore, saveStore } from "./store.js";

export type {
  MemoryEntry,
  RecordInput,
  RecallOptions,
  SalienceSignals,
  SalienceWeights,
  ThermalConfig,
} from "./types.js";
