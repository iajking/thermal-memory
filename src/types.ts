/** A single memory entry with temperature-weighted salience. */
export interface MemoryEntry {
  id: string;
  createdAt: number;

  /** What happened and why it mattered (1-2 sentences). Decays slowly. */
  core: string;
  /** Surrounding context, specifics, exact data. Decays faster. */
  detail: string;

  /** Temperature at write time, set by salience scorer (0.0–1.0). */
  initialTemp: number;
  /** Current decayed temperature. Never drops below floor. */
  currentTemp: number;
  /** Minimum temperature = initialTemp × floorRatio. */
  floor: number;

  /** Topic tags for retrieval matching. */
  tags: string[];
  /** IDs of related memories. More connections = more load-bearing. */
  connections: string[];
  /** Number of times this memory was retrieved and used. */
  reinforceCount: number;
  /** Timestamp of last retrieval or reinforcement. */
  lastAccessed: number;
}

/** Input for recording a new memory. */
export interface RecordInput {
  core: string;
  detail?: string;
  tags?: string[];
  connections?: string[];
  /** Override auto-scored temperature (0.0–1.0). */
  initialTemp?: number;
}

/** Options for recalling memories. */
export interface RecallOptions {
  /** Current context string to match against. */
  context?: string;
  /** Only return memories with specific tags. */
  tags?: string[];
  /** Maximum number of entries to return. */
  limit?: number;
  /** Minimum temperature threshold (default: 0.1). */
  minTemp?: number;
}

/** Salience signals used by the scorer. */
export interface SalienceSignals {
  /** Did this change a decision or redirect an approach? (0.0–1.0) */
  decisionChange: number;
  /** Did this come directly from the human? (0.0–1.0) */
  humanOriginated: number;
  /** Was this hard-won — multiple attempts, debugging? (0.0–1.0) */
  hardWon: number;
  /** Has this topic come up before? (0.0–1.0) */
  recurrence: number;
  /** Did this affect something real — shipped, deployed? (0.0–1.0) */
  realWorldImpact: number;
  /** Does this connect to multiple other memories? (0.0–1.0) */
  connectiveDensity: number;
}

/** Configuration for the thermal memory system. */
export interface ThermalConfig {
  /** Path to the memory store file. Default: ~/.thermal-memory/memories.json */
  storePath: string;
  /** Ratio for computing floor from initialTemp. Default: 0.4 */
  floorRatio: number;
  /** Base decay rate (lambda). Higher = faster decay. Default: 0.001 */
  decayRate: number;
  /** Detail decays this many times faster than core. Default: 3 */
  detailDecayMultiplier: number;
  /** Temperature boost when a memory is reinforced. Default: 0.15 */
  reheatBoost: number;
  /** Default salience signal weights. */
  weights: SalienceWeights;
}

/** Weights for each salience signal (should sum to ~1.0). */
export interface SalienceWeights {
  decisionChange: number;
  humanOriginated: number;
  hardWon: number;
  recurrence: number;
  realWorldImpact: number;
  connectiveDensity: number;
}
