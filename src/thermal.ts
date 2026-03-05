import { randomUUID } from "node:crypto";
import type {
  MemoryEntry,
  RecordInput,
  RecallOptions,
  ThermalConfig,
  SalienceSignals,
} from "./types.js";
import { resolveConfig } from "./config.js";
import { autoScore, scoreFromSignals } from "./scorer.js";
import { applyDecay, decayAll, reinforce } from "./decay.js";
import { loadStore, saveStore } from "./store.js";
import { recall, hottest } from "./retrieve.js";

export class ThermalMemory {
  private entries: MemoryEntry[];
  private config: ThermalConfig;
  private dirty = false;

  constructor(config?: Partial<ThermalConfig>) {
    this.config = resolveConfig(config);
    this.entries = loadStore(this.config.storePath);
  }

  /** Record a new memory. Auto-scores temperature if not provided. */
  record(input: RecordInput, signals?: Partial<SalienceSignals>): MemoryEntry {
    const now = Date.now();
    const detail = input.detail ?? "";

    // Determine temperature
    let temp: number;
    if (input.initialTemp !== undefined) {
      temp = Math.max(0, Math.min(1, input.initialTemp));
    } else if (signals) {
      temp = scoreFromSignals(signals, this.config.weights);
    } else {
      temp = autoScore(input.core, detail, this.entries, this.config.weights);
    }

    const entry: MemoryEntry = {
      id: randomUUID(),
      createdAt: now,
      core: input.core,
      detail,
      initialTemp: temp,
      currentTemp: temp,
      floor: temp * this.config.floorRatio,
      tags: input.tags ?? [],
      connections: input.connections ?? [],
      reinforceCount: 0,
      lastAccessed: now,
    };

    this.entries.push(entry);
    this.dirty = true;
    return entry;
  }

  /** Retrieve memories ranked by heat and relevance. */
  recall(options?: RecallOptions): MemoryEntry[] {
    // Apply decay before retrieval so temperatures are current
    decayAll(this.entries, this.config);
    this.dirty = true;
    return recall(this.entries, options);
  }

  /** Get the hottest N memories. */
  hottest(n: number = 10): MemoryEntry[] {
    decayAll(this.entries, this.config);
    this.dirty = true;
    return hottest(this.entries, n);
  }

  /** Reinforce a memory (it was retrieved and actually used). */
  reinforce(id: string): MemoryEntry | null {
    const entry = this.entries.find((e) => e.id === id);
    if (!entry) return null;
    reinforce(entry, this.config);
    this.dirty = true;
    return entry;
  }

  /** Add a connection between two memories. */
  connect(idA: string, idB: string): boolean {
    const a = this.entries.find((e) => e.id === idA);
    const b = this.entries.find((e) => e.id === idB);
    if (!a || !b) return false;
    if (!a.connections.includes(idB)) a.connections.push(idB);
    if (!b.connections.includes(idA)) b.connections.push(idA);
    this.dirty = true;
    return true;
  }

  /** Get a single memory by ID. */
  get(id: string): MemoryEntry | null {
    const entry = this.entries.find((e) => e.id === id);
    if (!entry) return null;
    applyDecay(entry, this.config);
    return entry;
  }

  /** Remove a memory by ID. */
  forget(id: string): boolean {
    const idx = this.entries.findIndex((e) => e.id === id);
    if (idx === -1) return false;
    this.entries.splice(idx, 1);
    // Remove from connections
    for (const entry of this.entries) {
      entry.connections = entry.connections.filter((c) => c !== id);
    }
    this.dirty = true;
    return true;
  }

  /** Apply decay to all memories. */
  decay(): number {
    const count = decayAll(this.entries, this.config);
    if (count > 0) this.dirty = true;
    return count;
  }

  /** Get all entries (for inspection/export). */
  all(): MemoryEntry[] {
    return [...this.entries];
  }

  /** Number of stored memories. */
  get size(): number {
    return this.entries.length;
  }

  /** Persist to disk. Call this when you're done writing. */
  save(): void {
    if (this.dirty) {
      saveStore(this.config.storePath, this.entries);
      this.dirty = false;
    }
  }

  /** Reload from disk (discard unsaved changes). */
  reload(): void {
    this.entries = loadStore(this.config.storePath);
    this.dirty = false;
  }
}
